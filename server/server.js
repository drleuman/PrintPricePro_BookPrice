/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const axios = require('axios');
const https = require('https');
const path = require('path');
const WebSocket = require('ws');
const { URLSearchParams, URL } = require('url');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;
const externalApiBaseUrl = 'https://generativelanguage.googleapis.com';
const externalWsBaseUrl = 'wss://generativelanguage.googleapis.com';
// Support either API key env-var variant
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
const sessionSecret = process.env.SESSION_SECRET || 'pp-secure-session-fallback-secret-2025';

// 0. Enterprise In-Memory Session Store (Simulated for single-server prod)
const sessionStore = new Map();
const SESSION_MAX_REQUESTS = 50; // Max prompts per session per 24h

// Cleanup store periodically to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of sessionStore.entries()) {
        if (now - data.lastSeen > 24 * 60 * 60 * 1000) {
            sessionStore.delete(id);
        }
    }
}, 60 * 60 * 1000);

const staticPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, 'public');


if (!apiKey) {
    // Only log an error, don't exit. The server will serve apps without proxy functionality
    console.error("Warning: GEMINI_API_KEY or API_KEY environment variable is not set! Proxy functionality will be disabled.");
}
else {
    console.log("API KEY FOUND (proxy will use this)")
}

app.use(cookieParser(sessionSecret));

// 1. Set Security Headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for some development modes/lib behavior
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://printprice.pro", "wss://generativelanguage.googleapis.com"],
            imgSrc: ["'self'", "data:", "https://printprice.pro"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            frameAncestors: ["'none'"], // Prevent clickjacking
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// 2. Global Request Limits (Internal & External)
// Strict default limits (Excluding proxy to allow larger JSON uploads)
app.use((req, res, next) => {
    if (req.path.startsWith('/api-proxy')) return next();
    express.json({ limit: '100kb' })(req, res, next);
});
app.use((req, res, next) => {
    if (req.path.startsWith('/api-proxy')) return next();
    express.urlencoded({ extended: true, limit: '100kb' })(req, res, next);
});

// 3. Strict CORS with Allowlist
const allowedOrigins = new Set(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5173', 'https://printprice.pro', 'https://app.printprice.pro', 'https://budget.printprice.pro']);
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl) or allowed origins
        if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-App-Proxy-Key'],
    credentials: true // Required for signed cookies
}));

// Set Vary: Origin to prevent cache poisoning
app.use((req, res, next) => {
    res.setHeader('Vary', 'Origin');
    next();
});

// Rate limiter for the proxy
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Set ratelimit window at 15min (in ms)
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // no `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
        console.warn(`Rate limit exceeded for IP: ${req.ip}. Path: ${req.path}`);
        res.status(options.statusCode).send(options.message);
    }
});

// Apply the rate limiter to the /api-proxy route before the main proxy logic
app.use('/api-proxy', proxyLimiter);

// 4. Proxy Authentication Middleware (Option 1: Signed Cookie)
const proxyAuth = (req, res, next) => {
    if (req.method === 'OPTIONS') return next();

    // 1. Check for signed session cookie
    const sessionToken = req.signedCookies['pp_session'];
    if (sessionToken === 'active') {
        return next();
    }

    // 2. Auto-initialize session for legitimate UI origins
    // This handles cases where Apache/Nginx serves the HTML directly
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
        console.log(`Auto-initializing session for origin: ${origin}`);
        return next();
    }

    // 3. Fallback to header key
    const proxyKey = req.headers['x-app-proxy-key'];
    const expectedKey = process.env.INTERNAL_PROXY_KEY || 'dev-fallback-secret-key';

    if (proxyKey && proxyKey === expectedKey) {
        return next();
    }

    console.warn(`Unauthorized proxy access attempt from IP: ${req.ip} (Origin: ${origin || 'none'})`);
    return res.status(401).json({ error: 'Unauthorized: Session or Origin validation failed' });
};

app.use('/api-proxy', proxyAuth);

// 5. Enterprise Business Logic Validation (BPE)
const validateBPE = (req, res, next) => {
    try {
        if (req.method !== 'POST') return next();
        if (!req.body) return next();

        const { copies, pages, format, paper } = req.body;

        // Skip if it's not a pricing request (e.g., chat message)
        if (copies === undefined && pages === undefined) return next();

        // Strict numerical ranges to prevent pricing fraud
        if (copies !== undefined && (typeof copies !== 'number' || copies < 1 || copies > 100000)) {
            return res.status(400).json({ error: 'Validation Error: Invalid copies count (1-100,000)' });
        }
        if (pages !== undefined && (typeof pages !== 'number' || pages < 1 || pages > 5000)) {
            return res.status(400).json({ error: 'Validation Error: Invalid page count (1-5,000)' });
        }

        // Type validation for enums
        const allowedFormats = ['A4', 'A5', 'Executive', 'Custom'];
        if (format && !allowedFormats.includes(format)) {
            return res.status(400).json({ error: 'Validation Error: Invalid book format' });
        }

        next();
    } catch (err) {
        console.error('Validation Error in validateBPE:', err);
        res.status(400).json({ error: 'Bad Request', details: 'Invalid payload structure' });
    }
};

// Larger limit ONLY for proxy
app.use('/api-proxy', express.json({ limit: '2mb' }));
app.use('/api-proxy', validateBPE);
app.use('/api-proxy', async (req, res, next) => {
    console.log(req.ip);
    // If the request is an upgrade request, it's for WebSockets, so pass to next middleware/handler
    if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
        return next(); // Pass to the WebSocket upgrade handler
    }

    if (req.method === 'OPTIONS') {
        // Preflight handled by cors middleware, but reinforcement for proxy specifically
        return res.sendStatus(200);
    }

    // REDACTED: No body logging in production
    try {
        // AI Budget Guard Logic
        const sessionToken = req.signedCookies['pp_session_id'] || req.ip; // Fallback to IP if cookies disabled
        const sessionData = sessionStore.get(sessionToken) || { requests: 0, lastSeen: Date.now() };

        if (sessionData.requests >= SESSION_MAX_REQUESTS) {
            console.warn(`AI Budget Guard triggered: Session ${sessionToken} exceeded quota.`);
            return res.status(429).json({ error: 'AI Quota Exceeded for this session. Please try again tomorrow.' });
        }

        // Increment usage
        sessionData.requests += 1;
        sessionData.lastSeen = Date.now();
        sessionStore.set(sessionToken, sessionData);

        // Construct the target URL by taking the part of the path after /api-proxy/
        const targetPath = req.url.startsWith('/') ? req.url.substring(1) : req.url;
        // Prepare headers for the outgoing request
        const outgoingHeaders = {};
        // Copy most headers from the incoming request
        for (const header in req.headers) {
            // Exclude host-specific headers and others that might cause issues upstream
            if (!['host', 'connection', 'content-length', 'transfer-encoding', 'upgrade', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions'].includes(header.toLowerCase())) {
                outgoingHeaders[header] = req.headers[header];
            }
        }

        // Determine target URL and specific headers
        let apiUrl;
        const isGemini = targetPath.startsWith('v1beta') || targetPath.startsWith('v1');

        if (isGemini) {
            apiUrl = `${externalApiBaseUrl}/${targetPath}`;
            outgoingHeaders['X-Goog-Api-Key'] = apiKey;
        } else {
            // Default to WordPress proxy for wp-json and other paths
            apiUrl = `https://printprice.pro/${targetPath}`;
        }

        console.log(`HTTP Proxy: [${req.method}] ${req.url} -> ${apiUrl}`);

        // Set Content-Type from original request if present (for relevant methods)
        if (req.headers['content-type'] && ['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
            outgoingHeaders['Content-Type'] = req.headers['content-type'];
        } else if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
            // Default Content-Type to application/json if no content type for post/put/patch
            outgoingHeaders['Content-Type'] = 'application/json';
        }

        // For GET or DELETE requests, ensure Content-Type is NOT sent,
        // even if the client erroneously included it.
        if (['GET', 'DELETE'].includes(req.method.toUpperCase())) {
            delete outgoingHeaders['Content-Type']; // Case-sensitive common practice
            delete outgoingHeaders['content-type']; // Just in case
        }

        // Ensure 'accept' is reasonable if not set
        if (!outgoingHeaders['accept']) {
            outgoingHeaders['accept'] = '*/*';
        }


        const axiosConfig = {
            method: req.method,
            url: apiUrl,
            headers: outgoingHeaders,
            responseType: 'stream',
            timeout: 10000, // 10 second timeout for external API calls
            validateStatus: function (status) {
                return true; // Accept any status code, we'll pipe it through
            },
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
            axiosConfig.data = req.body;
        }
        // For GET, DELETE, etc., axiosConfig.data will remain undefined,
        // and axios will not send a request body.

        const apiResponse = await axios(axiosConfig);

        // Pass through response headers from Gemini API to the client
        for (const header in apiResponse.headers) {
            res.setHeader(header, apiResponse.headers[header]);
        }
        res.status(apiResponse.status);

        // Ensure session cookies are set if this was an auto-init request
        if (!req.signedCookies['pp_session']) {
            res.cookie('pp_session', 'active', {
                httpOnly: true,
                signed: true,
                secure: process.env.NODE_ENV === 'production' || true, // Force secure for budget subdomain
                sameSite: 'Lax',
                maxAge: 24 * 60 * 60 * 1000
            });
            if (!req.signedCookies['pp_session_id']) {
                res.cookie('pp_session_id', require('crypto').randomBytes(16).toString('hex'), {
                    httpOnly: true,
                    signed: true,
                    secure: process.env.NODE_ENV === 'production' || true,
                    sameSite: 'Lax',
                    maxAge: 24 * 60 * 60 * 1000
                });
            }
        }


        apiResponse.data.on('data', (chunk) => {
            res.write(chunk);
        });

        apiResponse.data.on('end', () => {
            res.end();
        });

        apiResponse.data.on('error', (err) => {
            console.error('Error during streaming data from target API:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Proxy error during streaming from target' });
            } else {
                // If headers already sent, we can't send a JSON error, just end the response.
                res.end();
            }
        });

    } catch (error) {
        console.error('Proxy error before request to target API:', error);
        if (!res.headersSent) {
            if (error.response) {
                const errorData = {
                    status: error.response.status,
                    message: error.response.data?.error?.message || 'Proxy error from upstream API',
                    details: error.response.data?.error?.details || null
                };
                res.status(error.response.status).json(errorData);
            } else {
                res.status(500).json({ error: 'Proxy setup error', message: error.message });
            }
        }
    }
});

const webSocketInterceptorScriptTag = `<script src="/public/websocket-interceptor.js" defer></script>`;

// Prepare service worker registration script content
const serviceWorkerRegistrationScript = `
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load' , () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
} else {
  console.log('Service workers are not supported in this browser.');
}
</script>
`;

// Serve index.html or placeholder based on API key and file availability
app.get('/', (req, res) => {
    const placeholderPath = path.join(publicPath, 'placeholder.html');

    // Try to serve index.html
    console.log("LOG: Route '/' accessed. Attempting to serve index.html.");
    const indexPath = path.join(staticPath, 'index.html');

    fs.readFile(indexPath, 'utf8', (err, indexHtmlData) => {
        if (err) {
            // index.html not found or unreadable, serve the original placeholder
            console.log('LOG: index.html not found or unreadable. Falling back to original placeholder.');
            return res.sendFile(placeholderPath);
        }

        // If API key is not set, serve original HTML without injection
        if (!apiKey) {
            console.log("LOG: API key not set. Serving original index.html without script injections.");
            return res.sendFile(indexPath);
        }

        // index.html found and apiKey set, inject scripts
        console.log("LOG: index.html read successfully. Injecting scripts.");
        let injectedHtml = indexHtmlData;


        if (injectedHtml.includes('<head>')) {
            // Inject WebSocket interceptor first, then service worker script
            injectedHtml = injectedHtml.replace(
                '<head>',
                `<head>${webSocketInterceptorScriptTag}${serviceWorkerRegistrationScript}`
            );
            console.log("LOG: Scripts injected into <head>.");
        } else {
            console.warn("WARNING: <head> tag not found in index.html. Prepending scripts to the beginning of the file as a fallback.");
            injectedHtml = `${webSocketInterceptorScriptTag}${serviceWorkerRegistrationScript}${indexHtmlData}`;
        }
        // Set Signed HttpOnly Cookie to authorize the proxy for this session
        // Using a unique session ID for tracking
        const sessionId = req.signedCookies['pp_session_id'] || require('crypto').randomBytes(16).toString('hex');

        res.cookie('pp_session', 'active', {
            httpOnly: true,
            signed: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.cookie('pp_session_id', sessionId, {
            httpOnly: true,
            signed: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.send(injectedHtml);
    });
});

app.get('/service-worker.js', (req, res) => {
    return res.sendFile(path.join(publicPath, 'service-worker.js'));
});

app.use('/public', express.static(publicPath));
app.use(express.static(staticPath));

// Start the HTTP server
const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`HTTP proxy active on /api-proxy/**`);
    console.log(`WebSocket proxy active on /api-proxy/**`);
});

// Create WebSocket server and attach it to the HTTP server
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const pathname = requestUrl.pathname;

    if (pathname.startsWith('/api-proxy/')) {
        if (!apiKey) {
            console.error("WebSocket proxy: API key not configured. Closing connection.");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (clientWs) => {
            const sessionToken = request.signedCookies['pp_session_id'] || request.socket.remoteAddress;
            const sessionData = sessionStore.get(sessionToken) || { requests: 0, lastSeen: Date.now(), wsConnections: 0 };

            // Limit concurrent WS connections per session
            if (sessionData.wsConnections >= 3) {
                console.warn(`WS connection limit reached for session ${sessionToken}`);
                clientWs.close(1008, 'Simultaneous connection limit reached');
                return;
            }

            sessionData.wsConnections += 1;
            sessionStore.set(sessionToken, sessionData);

            let msgCount = 0;
            const MSG_RATE_LIMIT = 20; // max messages per 10 seconds
            const msgResetInterval = setInterval(() => { msgCount = 0; }, 10000);

            console.log('Client WebSocket connected to proxy for path:', pathname);

            const targetPathSegment = pathname.substring('/api-proxy'.length);
            const clientQuery = new URLSearchParams(requestUrl.search);
            clientQuery.set('key', apiKey);
            const targetGeminiWsUrl = `${externalWsBaseUrl}${targetPathSegment}?${clientQuery.toString()}`;

            // REDACTED: Log redacted URL (no secrets)
            console.log(`Attempting to connect to target WebSocket: ${externalWsBaseUrl}${targetPathSegment}?[REDACTED]`);

            const geminiWs = new WebSocket(targetGeminiWsUrl, {
                protocol: request.headers['sec-websocket-protocol'],
            });

            const messageQueue = [];

            geminiWs.on('open', () => {
                console.log('Proxy connected to Gemini WebSocket');
                // Send any queued messages
                while (messageQueue.length > 0) {
                    const message = messageQueue.shift();
                    if (geminiWs.readyState === WebSocket.OPEN) {
                        // console.log('Sending queued message from client -> Gemini');
                        geminiWs.send(message);
                    } else {
                        // Should not happen if we are in 'open' event, but good for safety
                        console.warn('Gemini WebSocket not open when trying to send queued message. Re-queuing.');
                        messageQueue.unshift(message); // Add it back to the front
                        break; // Stop processing queue for now
                    }
                }
            });

            geminiWs.on('message', (message) => {
                // console.log('Message from Gemini -> client');
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(message);
                }
            });

            geminiWs.on('close', (code, reason) => {
                console.log(`Gemini WebSocket closed: ${code} ${reason.toString()}`);
                if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
                    clientWs.close(code, reason.toString());
                }
            });

            geminiWs.on('error', (error) => {
                console.error('Error on Gemini WebSocket connection:', error);
                if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
                    clientWs.close(1011, 'Upstream WebSocket error');
                }
            });

            clientWs.on('message', (message) => {
                msgCount++;
                if (msgCount > MSG_RATE_LIMIT) {
                    console.warn(`WebSocket flood detected for session ${sessionToken}`);
                    return; // Drop message if flooded
                }

                if (geminiWs.readyState === WebSocket.OPEN) {
                    // console.log('Message from client -> Gemini');
                    geminiWs.send(message);
                } else if (geminiWs.readyState === WebSocket.CONNECTING) {
                    // console.log('Queueing message from client -> Gemini (Gemini still connecting)');
                    messageQueue.push(message);
                } else {
                    console.warn('Client sent message but Gemini WebSocket is not open or connecting. Message dropped.');
                }
            });

            clientWs.on('close', (code, reason) => {
                clearInterval(msgResetInterval);
                const currentSession = sessionStore.get(sessionToken);
                if (currentSession) {
                    currentSession.wsConnections = Math.max(0, currentSession.wsConnections - 1);
                    sessionStore.set(sessionToken, currentSession);
                }
                console.log(`Client WebSocket closed: ${code} ${reason.toString()}`);
                if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
                    geminiWs.close(code, reason.toString());
                }
            });

            clientWs.on('error', (error) => {
                console.error('Error on client WebSocket connection:', error);
                if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
                    geminiWs.close(1011, 'Client WebSocket error');
                }
            });
        });
    } else {
        console.log(`WebSocket upgrade request for non-proxy path: ${pathname}. Closing connection.`);
        socket.destroy();
    }
});

// Final JSON Error Handler to prevent HTML leakage
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: req.path.startsWith('/api-proxy') ? 'Proxy Failed' : err.message
    });
});
