/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const WebSocket = require('ws');
const { URLSearchParams, URL } = require('url');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

// 🔴 BOOTSTRAP: FAIL-CLOSED MANDATORY VALIDATION (v5.2)
const verifyEnvironment = () => {
    const required = ['SESSION_SECRET', 'SIGNING_SECRET', 'GEMINI_API_KEY'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        console.error(`[FATAL] CRITICAL_SECURITY_FAILURE: Missing environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
};
verifyEnvironment();

const app = express();
const port = process.env.PORT || 3000;
const externalApiBaseUrl = 'https://generativelanguage.googleapis.com';
const externalWsBaseUrl = 'wss://generativelanguage.googleapis.com';
const bpeEstimatesUrl = 'https://bpe.printprice.pro/api/estimates';
const apiKey = process.env.GEMINI_API_KEY;
const sessionSecret = process.env.SESSION_SECRET;
const signingSecret = process.env.SIGNING_SECRET;

app.set('trust proxy', 1); // For Cloudflare headers

/**
 * 🔴 ADAPTIVE VAULT (v5.2): SELF-DEFENDING STORE
 */
class AdaptiveVault {
    constructor() {
        this.sessions = new Map(); // id -> { abuseScore, requests, lastPayload, lastSeen }
        this.nonces = new Map(); // nonce -> expiry
        this.pendingRequests = 0;
    }

    getSession(id) {
        if (!this.sessions.has(id)) {
            this.sessions.set(id, { abuseScore: 0, requests: 0, lastSeen: Date.now(), lastPayload: null });
        }
        const data = this.sessions.get(id);
        data.lastSeen = Date.now();
        return data;
    }

    isNonceReplayed(nonce) {
        if (this.nonces.has(nonce)) return true;
        this.nonces.set(nonce, Date.now() + 600000); // 10 min TTL
        return false;
    }

    trackStart() { this.pendingRequests++; }
    trackEnd() { this.pendingRequests = Math.max(0, this.pendingRequests - 1); }

    cleanup() {
        const now = Date.now();
        for (const [id, data] of this.sessions.entries()) if (now - data.lastSeen > 86400000) this.sessions.delete(id);
        for (const [nonce, exp] of this.nonces.entries()) if (now > exp) this.nonces.delete(nonce);
    }
}
const vault = new AdaptiveVault();
setInterval(() => vault.cleanup(), 300000);

const staticPath = path.join(__dirname, '..', 'dist');

app.use(cookieParser(sessionSecret));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://printprice.pro", "wss://generativelanguage.googleapis.com"],
            imgSrc: ["'self'", "data:", "https://printprice.pro"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            frameAncestors: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin' }
}));

app.use(cors({
    origin: (origin, callback) => {
        const allowed = new Set(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5173', 'https://printprice.pro', 'https://app.printprice.pro', 'https://budget.printprice.pro']);
        if (!origin || allowed.has(origin)) callback(null, true);
        else callback(new Error('CORS Lockout.'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Security-Token', 'X-Nonce'],
    credentials: true
}));

app.use(express.json({ limit: '20kb' }));

// 🔴 UTILS: ADAPTIVE HELPERS
const canonicalize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
        sorted[key] = (typeof obj[key] === 'string') ? obj[key].trim() : canonicalize(obj[key]);
    });
    return sorted;
};

const mintToken = (sessionId, nonce, timestamp, context) => {
    return crypto.createHmac('sha256', signingSecret).update(`${sessionId}${nonce}${timestamp}${context}`).digest('hex');
};

const injectLatency = (score) => {
    if (score > 40) return 5000; // Red
    if (score > 25) return 2000; // Orange
    if (score > 15) return 500;  // Yellow
    return 0;
};

// 🔴 ADAPTIVE RESPONSE HARDENER (v5.2)
const hardenResponse = (offers, score) => {
    return offers.map(offer => {
        let cost = parseFloat(offer.total_cost || offer.total_price || 0);
        const pid = crypto.createHash('sha256').update(String(offer.id || 'p')).digest('hex').substring(0, 10);

        // Tier 0: Normal (Rounded)
        if (score <= 15) {
            cost = Math.round(cost);
            return { id: pid, print_house: "Standard Partner", total_cost: cost, currency: offer.currency || 'EUR', estimated_delivery_time: offer.estimated_delivery_time };
        }

        // Tier 1: Degraded (Nearest 5)
        if (score <= 25) {
            cost = Math.round(cost / 5) * 5;
            return { id: pid, print_house: "Partner (Adaptive Mode)", total_cost: cost, currency: offer.currency || 'EUR', status: "Estimated" };
        }

        // Tier 2: Range Mode (Min-Max) - Deterministic
        if (score <= 40) {
            const min = Math.round(cost * 0.95);
            const max = Math.round(cost * 1.05);
            return { id: pid, print_house: "Public Estimate Range", range: `${min} - ${max} ${offer.currency || 'EUR'}`, status: "Range" };
        }

        // Tier 3: Redacted / Fallback
        return { id: pid, print_house: "Specialized Quote Required", message: "Pattern-based restriction active. Contact support for high-precision pricing." };
    });
};

// 🔴 ENDPOINTS (v5.2 ADAPTIVE DEFENSE)

const bootLimiter = rateLimit({ windowMs: 60000, max: 20 });
const calcLimiter = rateLimit({ windowMs: 60000, max: 10, keyGenerator: (req) => req.ip });

// Challenge/Token issuance bound to payload context
app.post('/api/security/challenge', bootLimiter, (req, res) => {
    const { payload_context } = req.body;
    if (!payload_context) return res.status(400).json({ error: 'Payload context required for bind.' });

    const sessionId = req.signedCookies['pp_session_id'] || crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const token = mintToken(sessionId, nonce, timestamp, payload_context);

    if (!req.signedCookies['pp_session_id']) {
        res.cookie('pp_session_id', sessionId, { httpOnly: true, signed: true, secure: true, sameSite: 'Lax' });
    }
    res.json({ token, nonce, timestamp });
});

// Final Protected Gateway
app.post('/api/budget/calculate', calcLimiter, async (req, res) => {
    const { security_token, nonce, timestamp, hp_field } = req.body;
    const sessionId = req.signedCookies['pp_session_id'];

    const ipChain = req.ips.length ? req.ips.join(',') : req.ip;
    const session = vault.getSession(sessionId);

    // 1. CHALLENGE BINDING & REPLAY CHECK (Layer 1 & 3)
    const cleanPayload = canonicalize({ ...req.body });
    delete cleanPayload.security_token; delete cleanPayload.nonce; delete cleanPayload.timestamp; delete cleanPayload.hp_field;
    const payloadContext = crypto.createHash('sha256').update(JSON.stringify(Array.isArray(cleanPayload.interior_pages) ? cleanPayload.interior_pages : [cleanPayload.copies, cleanPayload.interior_pages, cleanPayload.book_size])).digest('hex');

    if (!sessionId || !security_token || !nonce) return res.status(403).json({ error: 'Auth deficit.' });
    if (await vault.isNonceReplayed(nonce)) { session.abuseScore += 20; return res.status(403).json({ error: 'Replay blocked.' }); }
    if (Math.abs(Date.now() - parseInt(timestamp)) > 300000) return res.status(403).json({ error: 'Session stalled.' });
    if (security_token !== mintToken(sessionId, nonce, timestamp, payloadContext)) {
        session.abuseScore += 15;
        return res.status(403).json({ error: 'Integrity binding failed. Token context mismatch.' });
    }
    if (hp_field) { session.abuseScore += 25; return res.status(403).json({ error: 'Honeypot violation.' }); }

    // 2. ADAPTIVE FRICTION (Layer 6)
    if (session.lastPayload) {
        const diffs = Object.keys(cleanPayload).filter(k => cleanPayload[k] !== session.lastPayload[k]);
        if (diffs.length === 1) session.abuseScore += 5; // Parameter Sweep
        if (diffs.length === 0) session.abuseScore += 2; // Hammering
    }
    session.requests++; session.lastPayload = cleanPayload;
    const delay = injectLatency(session.abuseScore);

    if (session.abuseScore > 50) return res.status(429).json({ error: 'Infrastructure Safeguard: Excessive traffic pattern.' });

    try {
        if (delay > 0) await new Promise(r => setTimeout(r, delay));

        vault.trackStart();
        const response = await axios.post(bpeEstimatesUrl, cleanPayload, { timeout: 15000 });
        vault.trackEnd();

        // 3. ADAPTIVE RESPONSE DEGRADATION (Layer 5)
        const hardened = hardenResponse(response.data.print_houses ?? response.data, session.abuseScore);

        console.log(`[AUDIT] ADAPTIVE_NODE Calc session=${sessionId} AAS=${session.abuseScore} Latency=${delay} IP=${ipChain}`);
        res.json({ success: true, offers: hardened, mode: session.abuseScore > 10 ? "Degraded" : "Precise" });

    } catch (err) {
        vault.trackEnd();
        console.error(`[BRIDGE_FAULT] Trace: ${err.message}`);
        res.status(502).json({ error: 'Infrastructure Safeguard: External node timeout or upstream BPE fault. Calculation failed to bridge safely.' });
    }
});

// 🛒 CART (In-Memory, session-bound)
const carts = new Map(); // sessionId -> CartItem[]

app.post('/api/cart/add', (req, res) => {
    const sessionId = req.signedCookies['pp_session_id'];
    if (!sessionId) return res.status(401).json({ error: 'No session.' });
    const { specs, offer } = req.body;
    if (!specs || !offer) return res.status(400).json({ error: 'specs and offer required.' });
    const cart = carts.get(sessionId) || [];
    const item = { id: crypto.randomBytes(8).toString('hex'), specs, offer, addedAt: new Date().toISOString() };
    cart.push(item);
    carts.set(sessionId, cart);
    res.json({ success: true, item_id: item.id, cart_count: cart.length });
});

app.get('/api/cart', (req, res) => {
    const sessionId = req.signedCookies['pp_session_id'];
    if (!sessionId) return res.status(401).json({ error: 'No session.' });
    res.json({ items: carts.get(sessionId) || [] });
});

app.delete('/api/cart/items/:itemId', (req, res) => {
    const sessionId = req.signedCookies['pp_session_id'];
    if (!sessionId) return res.status(401).json({ error: 'No session.' });
    const cart = (carts.get(sessionId) || []).filter(i => i.id !== req.params.itemId);
    carts.set(sessionId, cart);
    res.json({ success: true, cart_count: cart.length });
});

app.post('/api/cart/checkout', (req, res) => {
    const sessionId = req.signedCookies['pp_session_id'];
    if (!sessionId) return res.status(401).json({ error: 'No session.' });
    const cart = carts.get(sessionId) || [];
    if (!cart.length) return res.status(400).json({ error: 'Cart is empty.' });
    const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
    console.log(`[ORDER] ${orderId} session=${sessionId} items=${cart.length}`, JSON.stringify(cart));
    carts.set(sessionId, []);
    res.json({ success: true, order_id: orderId });
});

// 🔴 REPO BRIDGE (Restricted Allowlists)
const bridgeAuth = (req, res, next) => {
    if (req.signedCookies['pp_session_id']) return next();
    return res.status(401).json({ error: 'Unauthorized Bridge Path.' });
};

app.use('/api-bridge', bridgeAuth);

// 🤖 PPP-AI CHAT: Native Gemini handler (replaces missing WP plugin endpoint)
app.post('/api-bridge/wp-json/ppp-ai/v1/chat', async (req, res) => {
    const { system_prompt, messages, ui_state } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array required.' });
    }

    const systemText = `${system_prompt || ''}\n\nCurrent UI State (read-only context):\n${JSON.stringify(ui_state || {})}`;

    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const geminiPayload = {
        system_instruction: { parts: [{ text: systemText }] },
        contents,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    };

    try {
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        const url = `${externalApiBaseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const result = await axios.post(url, geminiPayload, { timeout: 30000 });

        const text = result.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = { reply: text, specs_patch: {} }; }

        console.log(`[PPP_AI_CHAT] session=${req.signedCookies['pp_session_id']} model=${model}`);
        res.json(parsed);
    } catch (err) {
        console.error('[PPP_AI_CHAT] Gemini error:', err.message);
        res.status(502).json({ error: 'AI service unavailable.' });
    }
});

app.all('/api-bridge/*', async (req, res) => {
    const target = req.params[0] || req.url.substring(12);
    let url;
    if (target.startsWith('v1/models/gemini')) url = `${externalApiBaseUrl}/${target}`;
    else if (target.includes('wp-json/ppp-ai') || target.includes('wp-json/custom-print')) url = `https://printprice.pro/${target}`;
    else return res.status(403).json({ error: 'Target Restricted.' });

    const headers = { 'Content-Type': 'application/json' };
    if (url.includes('googleapis.com')) headers['X-Goog-Api-Key'] = apiKey;

    try {
        const result = await axios({ method: req.method, url, headers, data: req.body, timeout: 15000 });
        res.status(result.status).json(result.data);
    } catch (err) { res.status(err.response?.status || 500).json(err.response?.data || { error: 'Bridge Bridge Error' }); }
});

app.get('/', (req, res) => {
    fs.readFile(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8', (err, data) => {
        if (err) return res.status(404).send('Portal missing.');
        res.send(data);
    });
});
app.use(express.static(path.join(__dirname, '..', 'dist')));

const server = app.listen(port, () => {
    console.log(`[NODE_START] Adaptive Pricing Infrastructure v5.2 active on ${port}.`);
    console.log("[SECURITY] Fail-Closed bootstrap verified. Adaptive defense layer active.");
});

// Hardened WebSocket (v5.2)
if (apiKey) {
    const wss = new WebSocket.Server({ noServer: true });
    server.on('upgrade', (request, socket, head) => {
        const u = new URL(request.url, `http://${request.headers.host}`);
        if (u.pathname.startsWith('/api-bridge/v1/models/gemini')) {
            wss.handleUpgrade(request, socket, head, (clientWs) => {
                const upWs = new WebSocket(`${externalWsBaseUrl}${u.pathname.substring(12)}?key=${apiKey}`);
                upWs.on('message', m => clientWs.readyState === WebSocket.OPEN && clientWs.send(m));
                clientWs.on('message', m => upWs.readyState === WebSocket.OPEN && upWs.send(m));
                clientWs.on('close', () => upWs.close());
            });
        }
    });
}
