require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3001;

// SECRETS
if (!process.env.SESSION_SECRET || !process.env.SIGNING_SECRET) {
    console.error('[FATAL] SESSION_SECRET and SIGNING_SECRET are required.');
    process.exit(1);
}
const SESSION_SECRET = process.env.SESSION_SECRET;
const SIGNING_SECRET = process.env.SIGNING_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// CONTROL PLANE / BPE CONFIG
const CONTROL_PLANE_BASE_URL = process.env.CONTROL_PLANE_URL || "http://127.0.0.1:8081";
const CONTROL_PLANE_API_KEY =
  process.env.CONTROL_PLANE_API_KEY ||
  process.env.CONTROL_PLANE_TOKEN ||
  process.env.PPOS_CONTROL_TOKEN ||
  "ppp_secret_api_key_v1";

const IDENTITY_API_URL =
  process.env.CONTROL_PLANE_AUTH_URL ||
  process.env.IDENTITY_API_URL ||
  CONTROL_PLANE_BASE_URL;

const authLoginUrl = `${IDENTITY_API_URL}/api/auth/login`;
const authRegisterUrl = `${IDENTITY_API_URL}/api/auth/register`;

const BPE_MARKETPLACE_OFFERS_URL =
    process.env.BPE_MARKETPLACE_OFFERS_URL ||
    `${CONTROL_PLANE_BASE_URL}/api/marketplace/offers`;

const buildControlPlaneHeaders = () => ({
    "Authorization": `Bearer ${CONTROL_PLANE_API_KEY}`,
    "Content-Type": "application/json",
    "x-source-app": "PrintPricePro_BookPrice"
});

// ADAPTIVE VAULT (In-memory for v5.2 hardening)
const carts = new Map();
const sessionVault = new Map();

// SECURITY MIDDLEWARE
app.use(helmet());
app.use(cookieParser(SESSION_SECRET));
app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "http://localhost:3001"],
    credentials: true
}));

app.use(express.json({ limit: '1mb' })); // v5.3: Increased limit for rich payloads

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests from this IP, please try again later." }
});
app.use('/api/', apiLimiter);

// 🔴 UTILS: ADAPTIVE HELPERS
const generateHmac = (data) => {
    return crypto.createHmac('sha256', SIGNING_SECRET).update(JSON.stringify(data)).digest('hex');
};

const validateUrlAgainstSsrf = (urlString) => {
    if (!urlString) return false;
    try {
        const url = new URL(urlString);
        if (url.protocol !== 'https:') return false;
        
        const hostname = url.hostname.toLowerCase();
        
        // 1. Reject localhost and loopback
        const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
        if (localHosts.includes(hostname)) return false;
        
        // 2. Reject private IPv4 ranges
        // 10.x.x.x
        if (hostname.startsWith('10.')) return false;
        // 172.16.x.x - 172.31.x.x
        if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return false;
        // 192.168.x.x
        if (hostname.startsWith('192.168.')) return false;
        
        // 3. Reject link-local (169.254.x.x)
        if (hostname.startsWith('169.254.')) return false;
        
        // 4. Reject .local hosts
        if (hostname.endsWith('.local')) return false;

        return true;
    } catch (e) {
        return false;
    }
};

// ---- Production File Helpers (v5.3) ----

const isServerBackedProductionFile = (file) => {
    return Boolean(
        ['UPLOADED', 'VALIDATED'].includes(file?.status) &&
        file?.filename &&
        Number(file?.size_bytes) > 0 &&
        file?.file_id &&
        file?.storage_url
    );
};

const isClientDeclaredProductionFile = (file) => {
    return Boolean(
        file?.status === 'SELECTED' &&
        file?.filename &&
        Number(file?.size_bytes) > 0
    );
};

const isExternalLinkDeclared = (file) => {
    return Boolean(
        file?.source_type === 'DOWNLOAD_URL' &&
        ['LINK_PROVIDED', 'LINK_PENDING_FETCH'].includes(file?.status) &&
        validateUrlAgainstSsrf(file?.download_url)
    );
};

const hasRequiredProductionFiles = (productionFiles) => {
    const interior = productionFiles?.interior_pdf;
    const cover = productionFiles?.cover_spine_back_pdf;

    const isInteriorValid = isClientDeclaredProductionFile(interior) || 
                           isServerBackedProductionFile(interior) || 
                           isExternalLinkDeclared(interior);

    const isCoverValid = isClientDeclaredProductionFile(cover) || 
                        isServerBackedProductionFile(cover) || 
                        isExternalLinkDeclared(cover);

    return Boolean(
        productionFiles?.required === true &&
        Array.isArray(productionFiles?.required_files) &&
        productionFiles.required_files.includes('INTERIOR_PDF') &&
        productionFiles.required_files.includes('COVER_SPINE_BACK_PDF') &&
        isInteriorValid &&
        isCoverValid
    );
};

const normalizeProductionFilesWorkflowStatus = (productionFiles) => {
    const interiorStatus = productionFiles?.interior_pdf?.status;
    const coverStatus = productionFiles?.cover_spine_back_pdf?.status;
    const interiorSource = productionFiles?.interior_pdf?.source_type;
    const coverSource = productionFiles?.cover_spine_back_pdf?.source_type;

    if (interiorStatus === 'VALIDATED' && coverStatus === 'VALIDATED') {
        return 'FILES_VALIDATED';
    }

    if (
        interiorStatus === 'ERROR' ||
        coverStatus === 'ERROR' ||
        interiorStatus === 'REJECTED' ||
        coverStatus === 'REJECTED'
    ) {
        return 'FILES_REJECTED';
    }

    const hasDownloadUrl = interiorSource === 'DOWNLOAD_URL' || coverSource === 'DOWNLOAD_URL';
    const hasUpload = interiorSource === 'UPLOAD' || coverSource === 'UPLOAD';

    if (hasDownloadUrl && hasUpload) {
        return 'FILES_MIXED_DECLARED';
    }

    if (hasDownloadUrl) {
        return 'FILES_FETCH_REQUIRED';
    }

    return 'FILES_SELECTED';
};

const enrichProductionFilesMetadata = (productionFiles) => {
    const interior = productionFiles?.interior_pdf;
    const cover = productionFiles?.cover_spine_back_pdf;
    
    const hasAnyLink = interior?.source_type === 'DOWNLOAD_URL' || cover?.source_type === 'DOWNLOAD_URL';
    const hasAnyUpload = interior?.source_type === 'UPLOAD' || cover?.source_type === 'UPLOAD';

    let storageStatus = 'CLIENT_DECLARED_ONLY';
    if (hasAnyLink && hasAnyUpload) {
        storageStatus = 'MIXED_CLIENT_DECLARED';
    } else if (hasAnyLink) {
        storageStatus = 'EXTERNAL_LINK_DECLARED';
    }

    return {
        required: true,
        status: normalizeProductionFilesWorkflowStatus(productionFiles),
        required_files: ['INTERIOR_PDF', 'COVER_SPINE_BACK_PDF'],
        interior_pdf: interior,
        cover_spine_back_pdf: cover,
        storage_status: storageStatus,
        server_upload_required: hasAnyUpload,
        server_fetch_required: hasAnyLink,
        validation_scope: 'CLIENT_DECLARED_ONLY',
        invoice_blocked_until: 'FILES_INGESTED_AND_VALIDATED'
    };
};

const mapProductionFilesToOrderStatus = (productionFiles) => {
    const workflowStatus = normalizeProductionFilesWorkflowStatus(productionFiles);
    if (workflowStatus === 'FILES_VALIDATED') return 'FILES_VALIDATED';
    return 'FILES_PENDING';
};

// 🔐 SECURITY: Challenge Context
app.post('/api/security/challenge', (req, res) => {
    const context = req.body?.payload_context || req.body?.context;

    if (!context) {
        return res.status(400).json({ error: "Challenge payload_context required." });
    }

    const sessionId =
        req.signedCookies['pp_session_id'] ||
        crypto.randomBytes(16).toString('hex');

    if (!req.signedCookies['pp_session_id']) {
        res.cookie('pp_session_id', sessionId, {
            signed: true,
            httpOnly: true,
            sameSite: 'Lax',
            secure: true,
            maxAge: 24 * 60 * 60 * 1000
        });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const token = crypto
        .createHmac('sha256', SIGNING_SECRET)
        .update(`${sessionId}${nonce}${timestamp}${context}`)
        .digest('hex');

    res.json({ success: true, token, nonce, timestamp });
});

// 🧠 AI CHAT PROXY — frontend contract -> Gemini contract
app.post('/api/ai/chat', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "AI Service not configured." });
    }

    const { system_prompt, messages, ui_state } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array required." });
    }

    const systemText = `${system_prompt || ''}

Current UI State (read-only context):
${JSON.stringify(ui_state || {})}`;

    const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }]
    }));

    const geminiPayload = {
        system_instruction: {
            parts: [{ text: systemText }]
        },
        contents,
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
        }
    };

    try {
        const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

        console.log(`[PPP_AI_CHAT] session=${req.signedCookies?.pp_session_id || 'anonymous'} model=${model}`);
        const response = await axios.post(geminiUrl, geminiPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        const text =
            response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            response.data?.response ||
            '';

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = { reply: text };
        }

        const normalized = {
            ...parsed,
            reply:
                parsed.reply ||
                parsed.response ||
                parsed.text ||
                parsed.message ||
                ''
        };

        res.json(normalized);
    } catch (err) {
        console.error("[AI_PROXY_ERROR]", err.response?.data || err.message);
        res.status(err.response?.status || 502).json({
            error: "AI service unavailable.",
            details: err.response?.data || err.message
        });
    }
});

// 🔐 AUTH LOGIN PROXY
app.post('/api/auth/login',
    rateLimit({ windowMs: 60000, max: 10 }),
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 1 }),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid credentials format.' });
        }

        const { email, password } = req.body;

        try {
            const response = await axios.post(authLoginUrl, { email, password }, {
                headers: buildControlPlaneHeaders(),
                timeout: 10000,
            });

            res.status(response.status).json(response.data);
        } catch (err) {
            console.error('[AUTH_LOGIN_PROXY_ERROR]', err.response?.data || err.message);
            res.status(err.response?.status || 502).json(
                err.response?.data || { error: 'Auth service unavailable.' }
            );
        }
    }
);

// 🔐 AUTH REGISTER PROXY
app.post('/api/auth/register',
    rateLimit({ windowMs: 60000, max: 5 }),
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 1 }),
        body('role').optional().isIn(['AUTHOR', 'PUBLISHER', 'PRINT_HOUSE', 'PRINTHOUSE', 'DEVELOPER']),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: 'Invalid registration data.' });
        }

        const { email, password, role } = req.body;

        try {
            const response = await axios.post(authRegisterUrl, { email, password, role }, {
                headers: buildControlPlaneHeaders(),
                timeout: 10000,
            });

            res.status(response.status).json(response.data);
        } catch (err) {
            console.error('[AUTH_REGISTER_PROXY_ERROR]', err.response?.data || err.message);
            res.status(err.response?.status || 502).json(
                err.response?.data || { error: 'Auth service unavailable.' }
            );
        }
    }
);

// 📊 BPE PROXY: Budget Calculation
app.post('/api/budget/calculate', [
    body('copies').isInt({ min: 1 }),
    body('interior_pages').isInt({ min: 0 }),
    body('delivery_country').isString().isLength({ min: 2, max: 2 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const sessionId = req.signedCookies['pp_session_id'] || crypto.randomBytes(16).toString('hex');
    if (!req.signedCookies['pp_session_id']) {
        res.cookie('pp_session_id', sessionId, { signed: true, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    }

    try {
        // In v5.2 this proxies to the actual BPE marketplace endpoint
        const bpeUrl = BPE_MARKETPLACE_OFFERS_URL;
        const headers = buildControlPlaneHeaders();

        console.log(`[BPE_PROXY_REQUEST] session=${sessionId} country=${req.body.delivery_country}`);
        const response = await axios.post(bpeUrl, req.body, { headers, timeout: 10000 });
        
        res.json(response.data);
    } catch (err) {
        console.error("[BPE_PROXY_ERROR]", err.message);
        res.status(502).json({ error: "Failed to fetch quotes from Book Price Engine." });
    }
});

// 🛒 CART API (Session-bound)
app.get('/api/cart', (req, res) => {
    const sessionId = req.signedCookies['pp_session_id'];
    if (!sessionId) return res.json({ success: true, cart: [] });
    res.json({ success: true, cart: carts.get(sessionId) || [] });
});

app.post('/api/cart/add', (req, res) => {
    const sessionId = req.signedCookies['pp_session_id'];
    if (!sessionId) return res.status(401).json({ error: 'No session.' });

    const { specs, offer, pricing, allOffers, recommendedOffer, recommendedOfferId, selectedBy, metadata } = req.body;

    // 1. Structural Validation
    if (!specs || !offer || !pricing) {
        return res.status(400).json({ error: 'specs, offer and pricing are required.' });
    }

    // 2. Business Logic Validation
    if (Number(specs.copies) <= 0 || Number(specs.interior_pages) <= 0) {
        return res.status(400).json({ error: 'Invalid specifications.' });
    }

    if (!/^[A-Z]{2}$/i.test(String(specs.delivery_country || ''))) {
        return res.status(400).json({ error: 'Invalid delivery country.' });
    }

    // 3. Precision Gating
    if (offer.checkout_allowed === false || offer.status === 'Range') {
        return res.status(400).json({ error: 'This quote is not precise enough for checkout.' });
    }

    // 4. Price Integrity
    const totalPrice = Number(pricing.total_price ?? offer.total_price ?? offer.total_cost);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        return res.status(400).json({ error: 'Invalid selected offer price.' });
    }

    const cart = carts.get(sessionId) || [];
    if (cart.length >= 5) return res.status(400).json({ error: "Cart limit reached." });

    const newItem = {
        id: `item_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        specs: {
            ...specs,
            delivery_country: String(specs.delivery_country || '').toUpperCase(),
        },
        offer,
        pricing: {
            ...pricing,
            total_price: totalPrice,
            currency: pricing.currency || offer.currency || 'EUR',
        },
        allOffers: Array.isArray(allOffers) ? allOffers : [],
        recommendedOffer: recommendedOffer || null,
        recommendedOfferId: recommendedOfferId || null,
        selectedBy: selectedBy || 'CUSTOMER',
        metadata: {
            ...metadata,
            contract: 'BPE_MARKETPLACE_NATIVE',
            source: 'PRINTPRICE_APP',
            bpe_endpoint: '/api/marketplace/offers',
            payment_status: metadata?.payment_status || 'PENDING',
        },
        addedAt: new Date().toISOString(),
    };

    cart.push(newItem);
    carts.set(sessionId, cart);
    res.json({ success: true, item_id: newItem.id, cart_count: cart.length });
});

app.delete('/api/cart/items/:id', (req, res) => {
    const sessionId = req.signedCookies['pp_session_id'];
    if (!sessionId) return res.status(401).json({ error: 'No session.' });

    let cart = carts.get(sessionId) || [];
    cart = cart.filter(i => i.id !== req.params.id);
    carts.set(sessionId, cart);
    res.json({ success: true, cart_count: cart.length });
});

// 🚀 CHECKOUT API (v5.3 Hardened)
app.post('/api/cart/checkout', async (req, res) => {
    const sessionId = req.signedCookies['pp_session_id'];
    if (!sessionId) return res.status(401).json({ error: 'No session.' });

    const cart = carts.get(sessionId) || [];
    if (!cart.length) return res.status(400).json({ error: 'Cart is empty.' });

    const { user, user_id, metadata } = req.body;
    const targetUserId = user?.user_id || user_id;
    if (!targetUserId) {
        return res.status(401).json({ error: 'Checkout requires a logged-in user.' });
    }

    const productionFiles = metadata?.production_files;

    // v5.3: Mandatory production files validation
    if (!hasRequiredProductionFiles(productionFiles)) {
        return res.status(400).json({
            error: 'Production files (PDFs or HTTPS links) are required before checkout.'
        });
    }

    const controlPlaneOrdersUrl = `${CONTROL_PLANE_BASE_URL}/api/admin/orders`;
    const headers = buildControlPlaneHeaders();

    const createdOrders = [];
    try {
        for (const item of cart) {
            const order_ref = `app_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            const source_ref = `ppp_app_checkout_${Date.now()}`;
            
            /** @type {import('../types').ControlPlaneOrderPayload} */
            const payload = {
                source: "PRINTPRICE_APP",
                source_ref: source_ref,
                order_ref: order_ref,
                user_id: targetUserId,
                customer: {
                    id: targetUserId,
                    email: user?.email || 'customer@example.com',
                    name: user?.name || 'Customer',
                    role: user?.role || 'AUTHOR',
                    billing: user?.billing || {},
                    delivery: user?.delivery || { country: item.specs.delivery_country }
                },
                specs: item.specs,
                pricing: {
                    currency: item.pricing.currency,
                    selected_by: "CUSTOMER",
                    customer_selected_offer_id: item.offer.id,
                    recommended_offer_id: item.recommendedOfferId || null,
                    total_price: item.pricing.total_price,
                    total_cost: item.pricing.total_cost,
                    margin: item.pricing.margin,
                    margin_percent: item.pricing.margin_percent
                },
                delivery: {
                    country: item.specs.delivery_country,
                    lead_time_days: item.offer.lead_time_days,
                    estimated_delivery_time: item.offer.estimated_delivery_time || ''
                },
                metadata_json: {
                    contract: "BPE_MARKETPLACE_NATIVE",
                    app: "PrintPricePro_BookPrice",
                    bpe_endpoint: "/api/marketplace/offers",
                    payment_status: "PENDING",
                    customer_selected_offer: item.offer,
                    offers_snapshot: item.allOffers,
                    chat_context: item.metadata?.chat_context || {},
                    ui_context: item.metadata?.ui_context || {},
                    // v5.3 enriched metadata
                    production_files: enrichProductionFilesMetadata(productionFiles),
                    invoice_payment: {
                        invoice_status: 'PENDING_FILES',
                        payment_status: 'PENDING'
                    }
                },
                status: mapProductionFilesToOrderStatus(productionFiles)
            };

            const response = await axios.post(controlPlaneOrdersUrl, payload, { headers, timeout: 15000 });
            createdOrders.push(response.data.order || response.data);
        }

        // Clear cart after successful checkout
        carts.set(sessionId, []);
        
        const firstOrder = createdOrders[0] || {};
        const firstRef = firstOrder.order_ref || firstOrder.orderRef || null;

        res.json({ 
            success: true, 
            order_ref: firstRef,
            orders: createdOrders,
            payment_url: null, // v5.3: Blocked until validation
            checkout_url: null,
            message: "Order request created. Payment pending until production files are ingested and validated."
        });
    } catch (err) {
        console.error("[CHECKOUT_ERROR]", err.message);
        res.status(502).json({ error: "Failed to submit order to Control Plane." });
    }
});

app.listen(PORT, () => {
    console.log(`v5.2 Adversarial Node Server running on port ${PORT}`);
});
