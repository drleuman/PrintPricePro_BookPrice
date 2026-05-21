const express = require('express');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MOCK_PORT = 8081;
const BUDGET_PORT = 3001;

const ADMIN_TOKEN = 'test_admin_token';
const CONTROL_TOKEN = 'test_control_token';
const SESSION_SECRET = 'test_session_secret_long_value_here_to_satisfy_checks_minimum_32_bytes';

// 1. Helper to sign session cookies for ownership check
function signCookie(val, secret) {
    const signature = crypto
        .createHmac('sha256', secret)
        .update(val)
        .digest('base64')
        .replace(/\=+$/, '');
    return 's:' + val + '.' + signature;
}

// 2. Create Mock Control Plane
const mockApp = express();
mockApp.use(express.json());

// Verify Bearer Token middleware
function verifyControlToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${CONTROL_TOKEN}`) {
        console.error(`[Mock ControlPlane] Unauthorized request: expected "Bearer ${CONTROL_TOKEN}", got "${auth}"`);
        return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid control plane auth token." });
    }
    next();
}

// GET /api/admin/marketplace/orders/:orderId/invoice/status
mockApp.get('/api/admin/marketplace/orders/:orderId/invoice/status', verifyControlToken, (req, res) => {
    const { orderId } = req.params;
    
    // Return mock response containing sensitive keys to verify stripping,
    // plus bank transfer instructions to verify preservation.
    return res.json({
        ok: true,
        orderId,
        orderStatus: "PROCESSING",
        invoiceReady: true,
        tokenHash: "super_secret_token_hash",
        metadata_json: { "debug": "internal" },
        raw_debug_info: "should be stripped",
        secrets: "strip me",
        internal_path: "/var/www/root/private",
        blockers: [],
        invoice: {
            invoiceNumber: "INV-CP-999",
            amount: 250.00,
            currency: "EUR",
            iban: "DE89370400440532013000",
            bic: "DBEUM2SXXX",
            beneficiary: "PrintPricePro GmbH",
            reference: "REF-999",
            token: "secret_invoice_token",
            secret_path: "C:\\Windows\\System32"
        },
        payment: {
            status: "PENDING",
            amount: 250.00,
            currency: "EUR",
            token: "secret_payment_token"
        },
        readiness: {
            status: "READY"
        }
    });
});

// POST /api/admin/marketplace/orders/:orderId/invoice/generate
mockApp.post('/api/admin/marketplace/orders/:orderId/invoice/generate', verifyControlToken, (req, res) => {
    const { orderId } = req.params;

    if (orderId === 'cp_order_blocked') {
        return res.status(422).json({
            ok: false,
            status: "INVOICE_BLOCKED",
            blockers: ["Preflight check failed on cover", "Missing spine artwork"],
            tokenHash: "error_token",
            secret_debug_path: "/var/www/error"
        });
    }

    return res.json({
        ok: true,
        invoice: {
            invoiceNumber: "INV-CP-999",
            amount: 250.00,
            currency: "EUR",
            iban: "DE89370400440532013000",
            bic: "DBEUM2SXXX",
            beneficiary: "PrintPricePro GmbH",
            reference: "REF-999"
        },
        payment: {
            status: "PENDING",
            amount: 250.00,
            currency: "EUR"
        }
    });
});

let mockServer;
let budgetProcess;

const STORAGE_DIR = path.join(__dirname, '../storage/order-intents');
const INDEX_FILE = path.join(STORAGE_DIR, 'index.json');
let indexBackup = null;
const INDEX_EXISTS = fs.existsSync(INDEX_FILE);

function backupDb() {
    if (INDEX_EXISTS) {
        indexBackup = fs.readFileSync(INDEX_FILE, 'utf8');
        console.log("[Backup] Backed up existing order-intents index.json");
    }
}

function restoreDb() {
    if (INDEX_EXISTS && indexBackup !== null) {
        fs.writeFileSync(INDEX_FILE, indexBackup);
        console.log("[Backup] Restored order-intents index.json");
    } else if (fs.existsSync(INDEX_FILE)) {
        fs.unlinkSync(INDEX_FILE);
        console.log("[Backup] Cleaned up temporary order-intents index.json");
    }
}

function seedIntents() {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    const testIntents = {
        "intent_cp_normal": {
            order_intent_id: "intent_cp_normal",
            public_ref: "ref_cp_normal",
            session_id: "session_normal",
            status: "PREFLIGHT_VALIDATED",
            preflight: { status: "PASSED" },
            control_plane: { order_id: "cp_order_normal", status: "CREATED", order_ref: "cp_ref_normal" },
            totals: { grand_total: 250.00, currency: "EUR" }
        },
        "intent_cp_blocked": {
            order_intent_id: "intent_cp_blocked",
            public_ref: "ref_cp_blocked",
            session_id: "session_blocked",
            status: "PREFLIGHT_VALIDATED",
            preflight: { status: "PASSED" },
            control_plane: { order_id: "cp_order_blocked", status: "CREATED", order_ref: "cp_ref_blocked" },
            totals: { grand_total: 250.00, currency: "EUR" }
        },
        "intent_legacy": {
            order_intent_id: "intent_legacy",
            public_ref: "ref_legacy",
            session_id: "session_legacy",
            status: "PREFLIGHT_VALIDATED",
            preflight: { status: "PASSED" },
            totals: { grand_total: 100.00, currency: "USD" },
            lifecycle: { invoice_status: "NOT_CREATED", payment_status: "NOT_STARTED" }
        }
    };
    fs.writeFileSync(INDEX_FILE, JSON.stringify(testIntents, null, 2));
    console.log("[Seed] Wrote test order-intents to index.json");
}

async function runTests() {
    console.log("=== Phase 37.2 Budget Invoice Proxy integration Tests ===");

    backupDb();
    seedIntents();

    // Start Mock Control Plane
    mockServer = mockApp.listen(MOCK_PORT, () => {
        console.log(`[Mock ControlPlane] Listening on port ${MOCK_PORT}`);
    });

    // Start Budget Server
    console.log("[Budget Server] Starting server.js...");
    const env = {
        ...process.env,
        SESSION_SECRET: SESSION_SECRET,
        SIGNING_SECRET: 'test_signing_secret_long_value_here_to_satisfy_checks_minimum_32_bytes',
        OFFER_SIGNING_SECRET: 'test_offer_signing_secret_long_value_here_to_satisfy_checks_minimum_64_bytes',
        PORT: BUDGET_PORT,
        CONTROL_PLANE_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        CONTROL_PLANE_INTERNAL_URL: `http://127.0.0.1:${MOCK_PORT}`,
        PPOS_CONTROL_TOKEN: CONTROL_TOKEN,
        CONTROL_PLANE_API_KEY: CONTROL_TOKEN,
        ADMIN_API_TOKEN: ADMIN_TOKEN,
        PAYMENTS_ENABLED: 'true',
        PAYMENT_PROVIDER: 'bank_transfer',
        BANK_TRANSFER_ENABLED: 'true',
        BANK_TRANSFER_REFERENCE_PREFIX: 'BPE',
        PERSISTENCE_ADAPTER: 'json',
        CLEANUP_ENABLED: 'false',
        RATE_LIMIT_ENABLED: 'false',
        PPOS_ENABLE_PHASE37_SMOKE_ACCESS: 'true',
        NODE_ENV: 'test'
    };

    budgetProcess = spawn('node', [path.join(__dirname, '../server.js')], { env });

    budgetProcess.stdout.on('data', (data) => {
        const text = data.toString();
        // console.log(`[Budget stdout] ${text.trim()}`);
    });

    budgetProcess.stderr.on('data', (data) => {
        console.error(`[Budget stderr] ${data.toString().trim()}`);
    });

    // Wait for Budget server to initialize
    console.log("Waiting 3 seconds for Budget server to initialize...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    const client = axios.create({
        baseURL: `http://127.0.0.1:${BUDGET_PORT}`,
        validateStatus: () => true // Don't throw on non-2xx status
    });

    let exitCode = 0;

    try {
        // Test 1: GET invoice/status - Owner Access
        console.log("\n[Test 1] GET /api/marketplace-order/:cpOrderId/invoice/status - Owner Access");
        const signedCookie = signCookie('session_normal', SESSION_SECRET);
        const res1 = await client.get('/api/marketplace-order/cp_order_normal/invoice/status', {
            headers: {
                'Cookie': `pp_session_id=${encodeURIComponent(signedCookie)}`
            }
        });
        console.log(`Status: ${res1.status}`);
        console.log("Body:", JSON.stringify(res1.data, null, 2));

        if (res1.status !== 200) throw new Error("Test 1 failed: Status should be 200");
        if (res1.data.tokenHash || res1.data.secrets || res1.data.internal_path || res1.data.raw_debug_info) {
            throw new Error("Test 1 failed: Sensitive root fields were not stripped!");
        }
        if (res1.data.invoice.token || res1.data.invoice.secret_path) {
            throw new Error("Test 1 failed: Sensitive nested fields were not stripped!");
        }
        if (res1.data.invoice.iban !== "DE89370400440532013000" || res1.data.invoice.bic !== "DBEUM2SXXX") {
            throw new Error("Test 1 failed: Bank transfer instructions (iban, bic) were stripped!");
        }
        console.log("✅ Test 1 Passed: Request authorized, sensitive fields stripped, bank transfer instructions preserved.");

        // Test 2: GET invoice/status - Admin Access
        console.log("\n[Test 2] GET /api/marketplace-order/:cpOrderId/invoice/status - Admin Access");
        const res2 = await client.get('/api/marketplace-order/cp_order_normal/invoice/status', {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });
        console.log(`Status: ${res2.status}`);
        if (res2.status !== 200) throw new Error(`Test 2 failed: Status should be 200, got ${res2.status}`);
        console.log("✅ Test 2 Passed: Request authorized for admin.");

        // Test 3: GET invoice/status - Access Denied (Wrong Session)
        console.log("\n[Test 3] GET /api/marketplace-order/:cpOrderId/invoice/status - Access Denied (Wrong Session)");
        const wrongCookie = signCookie('session_wrong', SESSION_SECRET);
        const res3 = await client.get('/api/marketplace-order/cp_order_normal/invoice/status', {
            headers: {
                'Cookie': `pp_session_id=${encodeURIComponent(wrongCookie)}`
            }
        });
        console.log(`Status: ${res3.status}`);
        console.log("Body:", res3.data);
        if (res3.status !== 403) throw new Error(`Test 3 failed: Status should be 403, got ${res3.status}`);
        if (res3.data.error !== 'ACCESS_DENIED') throw new Error("Test 3 failed: Error should be ACCESS_DENIED");
        console.log("✅ Test 3 Passed: Access denied for wrong session.");

        // Test 4: GET invoice/status - Not Found (No Intent)
        console.log("\n[Test 4] GET /api/marketplace-order/:cpOrderId/invoice/status - Not Found (No Intent)");
        const res4 = await client.get('/api/marketplace-order/cp_order_nonexistent/invoice/status');
        console.log(`Status: ${res4.status}`);
        console.log("Body:", res4.data);
        if (res4.status !== 404) throw new Error(`Test 4 failed: Status should be 404, got ${res4.status}`);
        if (res4.data.error !== 'ORDER_INTENT_NOT_FOUND_FOR_CP_ORDER') {
            throw new Error("Test 4 failed: Error should be ORDER_INTENT_NOT_FOUND_FOR_CP_ORDER");
        }
        console.log("✅ Test 4 Passed: Returned 404 ORDER_INTENT_NOT_FOUND_FOR_CP_ORDER when intent not found.");

        // Test 5: POST invoice/generate - Success
        console.log("\n[Test 5] POST /api/marketplace-order/:cpOrderId/invoice/generate - Success");
        const res5 = await client.post('/api/marketplace-order/cp_order_normal/invoice/generate', {}, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });
        console.log(`Status: ${res5.status}`);
        console.log("Body:", JSON.stringify(res5.data, null, 2));
        if (res5.status !== 200) throw new Error(`Test 5 failed: Status should be 200, got ${res5.status}`);
        if (res5.data.invoice.iban !== "DE89370400440532013000") {
            throw new Error("Test 5 failed: IBAN was stripped!");
        }
        console.log("✅ Test 5 Passed: Successfully generated invoice through proxy.");

        // Test 6: POST invoice/generate - CP 422 Blocked Pass-through
        console.log("\n[Test 6] POST /api/marketplace-order/:cpOrderId/invoice/generate - CP 422 Blocked Pass-through");
        const res6 = await client.post('/api/marketplace-order/cp_order_blocked/invoice/generate', {}, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });
        console.log(`Status: ${res6.status}`);
        console.log("Body:", JSON.stringify(res6.data, null, 2));
        if (res6.status !== 422) throw new Error(`Test 6 failed: Status should be 422, got ${res6.status}`);
        if (res6.data.status !== 'INVOICE_BLOCKED') throw new Error("Test 6 failed: status should be INVOICE_BLOCKED");
        if (res6.data.tokenHash || res6.data.secret_debug_path) {
            throw new Error("Test 6 failed: Sensitive error response fields were not stripped!");
        }
        console.log("✅ Test 6 Passed: CP business blocks passed through as 422 and sanitized.");

        // Test 7: GET payment/status - Reduced Shape
        console.log("\n[Test 7] GET /api/marketplace-order/:cpOrderId/payment/status - Reduced Shape");
        const res7 = await client.get('/api/marketplace-order/cp_order_normal/payment/status', {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });
        console.log(`Status: ${res7.status}`);
        console.log("Body:", JSON.stringify(res7.data, null, 2));
        if (res7.status !== 200) throw new Error(`Test 7 failed: Status should be 200, got ${res7.status}`);
        
        const expectedKeys = ['ok', 'orderId', 'orderStatus', 'invoiceReady', 'payment', 'invoiceNumber', 'amount', 'currency'];
        const actualKeys = Object.keys(res7.data);
        for (const key of expectedKeys) {
            if (!(key in res7.data)) {
                throw new Error(`Test 7 failed: Missing key '${key}' in reduced shape`);
            }
        }
        for (const key of actualKeys) {
            if (!expectedKeys.includes(key)) {
                throw new Error(`Test 7 failed: Unexpected key '${key}' in reduced shape`);
            }
        }
        if (res7.data.payment.token) {
            throw new Error("Test 7 failed: Nested token in payment object was not stripped!");
        }
        console.log("✅ Test 7 Passed: Successfully returned reduced polling shape and sanitized nested fields.");

        // Test 8: POST billing/create - CP-Backed Intent (409 USE_CP_INVOICE_PROXY)
        console.log("\n[Test 8] POST /api/order-intents/:id/billing/create - CP-Backed Intent");
        const res8 = await client.post('/api/order-intents/intent_cp_normal/billing/create', {}, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });
        console.log(`Status: ${res8.status}`);
        console.log("Body:", JSON.stringify(res8.data, null, 2));
        if (res8.status !== 409) throw new Error(`Test 8 failed: Status should be 409, got ${res8.status}`);
        if (res8.data.error !== 'USE_CP_INVOICE_PROXY') throw new Error("Test 8 failed: Error should be USE_CP_INVOICE_PROXY");
        if (res8.data.cpOrderId !== 'cp_order_normal') throw new Error("Test 8 failed: cpOrderId should be cp_order_normal");
        console.log("✅ Test 8 Passed: Guardrail successfully blocked local billing and returned 409 USE_CP_INVOICE_PROXY.");

        // Test 9: POST billing/create - Legacy Intent (Bypass Proxy)
        console.log("\n[Test 9] POST /api/order-intents/:id/billing/create - Legacy Intent (Bypass Proxy)");
        const res9 = await client.post('/api/order-intents/intent_legacy/billing/create', {}, {
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });
        console.log(`Status: ${res9.status}`);
        console.log("Body:", JSON.stringify(res9.data, null, 2));
        if (res9.status !== 200) throw new Error(`Test 9 failed: Status should be 200, got ${res9.status}`);
        if (!res9.data.ok || !res9.data.invoice || !res9.data.payment) {
            throw new Error("Test 9 failed: Response missing expected legacy billing objects");
        }
        console.log("✅ Test 9 Passed: Legacy intent continues to use local billing flow unchanged.");

        // Test 10: Normal request without access remains denied
        console.log("\n[Test 10] GET /api/marketplace-order/:cpOrderId/invoice/status - Normal request without access (No Headers)");
        const res10 = await client.get('/api/marketplace-order/cp_order_normal/invoice/status');
        console.log(`Status: ${res10.status}`);
        if (res10.status !== 403) throw new Error(`Test 10 failed: Status should be 403, got ${res10.status}`);
        console.log("✅ Test 10 Passed: Normal request without access remains denied.");

        // Test 11: Smoke header with valid bearer succeeds
        console.log("\n[Test 11] GET /api/marketplace-order/:cpOrderId/invoice/status - Smoke header with valid bearer");
        const res11 = await client.get('/api/marketplace-order/cp_order_normal/invoice/status', {
            headers: {
                'X-PPOS-Smoke-Access': 'phase37',
                'Authorization': `Bearer ${CONTROL_TOKEN}`
            }
        });
        console.log(`Status: ${res11.status}`);
        if (res11.status !== 200) throw new Error(`Test 11 failed: Status should be 200, got ${res11.status}`);
        console.log("✅ Test 11 Passed: Smoke header with valid bearer succeeds.");

        // Test 12: Smoke header with invalid bearer is denied
        console.log("\n[Test 12] GET /api/marketplace-order/:cpOrderId/invoice/status - Smoke header with invalid bearer");
        const res12 = await client.get('/api/marketplace-order/cp_order_normal/invoice/status', {
            headers: {
                'X-PPOS-Smoke-Access': 'phase37',
                'Authorization': `Bearer invalid_token`
            }
        });
        console.log(`Status: ${res12.status}`);
        if (res12.status !== 403) throw new Error(`Test 12 failed: Status should be 403, got ${res12.status}`);
        console.log("✅ Test 12 Passed: Smoke header with invalid bearer is denied.");

        console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");
    } catch (err) {
        console.error("\n❌ TEST SUITE FAILED:", err.message);
        exitCode = 1;
    } finally {
        cleanup();
        restoreDb();
        process.exit(exitCode);
    }
}

function cleanup() {
    console.log("\nCleaning up processes...");
    if (budgetProcess) {
        budgetProcess.kill();
    }
    if (mockServer) {
        mockServer.close();
    }
}

process.on('SIGINT', () => { cleanup(); restoreDb(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); restoreDb(); process.exit(1); });

runTests();
