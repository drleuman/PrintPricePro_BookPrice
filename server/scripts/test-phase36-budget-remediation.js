const express = require('express');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const MOCK_PORT = 8081;
const BUDGET_PORT = 3001;

// 1. Create Mock Control Plane
const mockApp = express();
mockApp.use(express.json());

mockApp.get('/api/marketplace/orders/:orderId/customer-action/:token', (req, res) => {
    const { orderId, token } = req.params;
    if (token === 'invalid_token') {
        return res.status(401).json({ error: "UNAUTHORIZED", message: "Token is invalid or expired." });
    }
    if (token === 'nested_token') {
        return res.json({
            success: true,
            action: {
                requiredFiles: ["INTERIOR_PDF"],
                blockers: ["Bleed issues"],
                message: "Nested layout check"
            }
        });
    }
    return res.json({
        orderId,
        requiredFiles: ["INTERIOR_PDF", "COVER_PDF"],
        blockers: ["Interior bleed issues", "Cover spine too narrow"],
        message: "Please fix layout issues.",
        expiresAt: "2029-12-31T23:59:59Z",
        tokenHash: "super_secret_token_hash_should_be_stripped",
        metadata: { internal: "should_be_stripped" }
    });
});

mockApp.post('/api/admin/marketplace/orders/:orderId/remediation/reupload', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing authorization header" });
    }
    
    // Return response containing sensitive keys to verify stripping
    return res.json({
        ok: true,
        registered: true,
        role: req.body.role,
        tokenHash: "secret_hash",
        metadata_json: { key: "secret_metadata" },
        storageRoot: "/var/www/vhosts/printprice.pro/server/storage",
        filePath: "/var/www/vhosts/printprice.pro/server/storage/production-files/pf_test.pdf"
    });
});

mockApp.post('/api/admin/marketplace/orders/:orderId/remediation/run', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Missing authorization header" });
    }
    return res.json({
        status: "RESOLVED",
        message: "Remediation validation succeeded",
        debug_raw_log: "detailed log files with path /var/www/vhosts/..."
    });
});

let mockServer;
let budgetProcess;

async function runTests() {
    console.log("=== Phase 36.8 Budget Remediation Integration Tests ===");
    
    // Start Mock Control Plane
    mockServer = mockApp.listen(MOCK_PORT, () => {
        console.log(`[Mock ControlPlane] Listening on port ${MOCK_PORT}`);
    });

    // Start Budget Server
    console.log("[Budget Server] Starting server.js...");
    const env = {
        ...process.env,
        SESSION_SECRET: 'test_session_secret_long_value_here_to_satisfy_checks_minimum_32_bytes',
        SIGNING_SECRET: 'test_signing_secret_long_value_here_to_satisfy_checks_minimum_32_bytes',
        OFFER_SIGNING_SECRET: 'test_offer_signing_secret_long_value_here_to_satisfy_checks_minimum_64_bytes',
        PORT: BUDGET_PORT,
        CONTROL_PLANE_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        CONTROL_PLANE_INTERNAL_URL: `http://127.0.0.1:${MOCK_PORT}`,
        PPOS_CONTROL_TOKEN: 'test_control_token',
        CONTROL_PLANE_API_KEY: 'test_control_token',
        PERSISTENCE_ADAPTER: 'memory',
        CLEANUP_ENABLED: 'false',
        RATE_LIMIT_ENABLED: 'false',
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

    // Wait for Budget server to be ready
    console.log("Waiting 3 seconds for Budget server to initialize...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    const client = axios.create({
        baseURL: `http://127.0.0.1:${BUDGET_PORT}`,
        validateStatus: () => true // Don't throw on non-2xx status
    });

    let exitCode = 0;

    try {
        // Test 1: GET customer action - valid token
        console.log("\n[Test 1] GET /api/customer-action/:orderId/:token - Valid Token");
        const res1 = await client.get('/api/customer-action/ord_123/valid_token');
        console.log(`Status: ${res1.status}`);
        console.log("Body:", res1.data);
        if (res1.status !== 200) throw new Error("Test 1 failed: Status should be 200");
        if (res1.data.tokenHash || res1.data.metadata) {
            throw new Error("Test 1 failed: Sensitive fields (tokenHash, metadata) were not stripped!");
        }
        console.log("✅ Test 1 Passed: Response returned 200 and is properly sanitized.");

        // Test 2: GET customer action - invalid token
        console.log("\n[Test 2] GET /api/customer-action/:orderId/:token - Invalid Token");
        const res2 = await client.get('/api/customer-action/ord_123/invalid_token');
        console.log(`Status: ${res2.status}`);
        if (res2.status !== 401 && res2.status !== 403) {
            throw new Error(`Test 2 failed: Status should be 401/403, got ${res2.status}`);
        }
        console.log("✅ Test 2 Passed: Invalid token correctly rejected.");

        // Test 3: POST upload - invalid PDF magic bytes
        console.log("\n[Test 3] POST upload - Invalid magic bytes");
        const form3 = new FormData();
        form3.append('role', 'INTERIOR_PDF');
        form3.append('file', new Blob([Buffer.from('NOT A PDF FILE')], { type: 'application/pdf' }), 'test.pdf');
        
        const res3 = await client.post('/api/customer-action/ord_123/valid_token/upload', form3, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        console.log(`Status: ${res3.status}`);
        console.log("Body:", res3.data);
        if (res3.status !== 400) throw new Error("Test 3 failed: Status should be 400");
        if (res3.data.error !== 'INVALID_PDF_SIGNATURE') throw new Error("Test 3 failed: Error code should be INVALID_PDF_SIGNATURE");
        console.log("✅ Test 3 Passed: Magic bytes check successfully blocked non-PDF file.");

        // Test 4: POST upload - unsupported role
        console.log("\n[Test 4] POST upload - Unsupported role");
        const form4 = new FormData();
        form4.append('role', 'BACK_PDF');
        form4.append('file', new Blob([Buffer.from('%PDF-1.4\n%')], { type: 'application/pdf' }), 'test.pdf');

        const res4 = await client.post('/api/customer-action/ord_123/valid_token/upload', form4, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        console.log(`Status: ${res4.status}`);
        console.log("Body:", res4.data);
        if (res4.status !== 400) throw new Error("Test 4 failed: Status should be 400");
        if (res4.data.error !== 'INVALID_ROLE') throw new Error("Test 4 failed: Should report INVALID_ROLE");
        console.log("✅ Test 4 Passed: Unsupported role successfully rejected.");

        // Test 5: POST upload - role not in requiredFiles list
        console.log("\n[Test 5] POST upload - Role not required");
        const mockAppWithDifferentRequired = express();
        mockAppWithDifferentRequired.get('/api/marketplace/orders/:orderId/customer-action/:token', (req, res) => {
            return res.json({
                orderId: "ord_123",
                requiredFiles: ["INTERIOR_PDF"] // COVER_PDF is NOT required
            });
        });
        const tempPort = 8082;
        const tempServer = mockAppWithDifferentRequired.listen(tempPort);
        
        // Spawn test budget process targeting tempPort
        const tempEnv = { 
            ...env, 
            PORT: BUDGET_PORT + 2, 
            CONTROL_PLANE_BASE_URL: `http://127.0.0.1:${tempPort}`,
            CONTROL_PLANE_INTERNAL_URL: `http://127.0.0.1:${tempPort}`
        };
        const tempBudgetProcess = spawn('node', [path.join(__dirname, '../server.js')], { env: tempEnv });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const tempClient = axios.create({ baseURL: `http://127.0.0.1:${BUDGET_PORT + 2}`, validateStatus: () => true });
        const form5 = new FormData();
        form5.append('role', 'COVER_PDF'); // Not required
        form5.append('file', new Blob([Buffer.from('%PDF-1.4\n%')], { type: 'application/pdf' }), 'test.pdf');
        
        const res5 = await tempClient.post(`/api/customer-action/ord_123/valid_token/upload`, form5, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        console.log(`Status: ${res5.status}`);
        console.log("Body:", res5.data);
        
        tempBudgetProcess.kill();
        tempServer.close();

        if (res5.status !== 400) throw new Error("Test 5 failed: Status should be 400");
        if (res5.data.error !== 'ROLE_NOT_REQUIRED') throw new Error("Test 5 failed: Should report ROLE_NOT_REQUIRED");
        if (!Array.isArray(res5.data.requiredFiles)) throw new Error("Test 5 failed: Response must include requiredFiles diagnostic array");
        console.log("✅ Test 5 Passed: Role not listed in customerAction requiredFiles was rejected with diagnostics.");

        // Test 6: POST upload - Valid upload and sanitization of ControlPlane response
        console.log("\n[Test 6] POST upload - Valid Upload");
        const form6 = new FormData();
        form6.append('role', 'INTERIOR_PDF');
        form6.append('file', new Blob([Buffer.from('%PDF-1.4\n%')], { type: 'application/pdf' }), 'test.pdf');

        const res6 = await client.post('/api/customer-action/ord_123/valid_token/upload', form6, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        console.log(`Status: ${res6.status}`);
        console.log("Body:", res6.data);
        if (res6.status !== 200) throw new Error("Test 6 failed: Status should be 200");
        if (!res6.data.ok || !res6.data.metadata) throw new Error("Test 6 failed: Response structure invalid");
        
        // Assert sanitization
        const cpRes = res6.data.controlPlaneResponse;
        if (cpRes.tokenHash || cpRes.metadata_json || cpRes.storageRoot || cpRes.filePath) {
            throw new Error("Test 6 failed: ControlPlane response was not properly sanitized!");
        }
        console.log("✅ Test 6 Passed: Valid PDF uploaded successfully and response sanitized.");

        // Test 7: POST run - Valid execution
        console.log("\n[Test 7] POST run - Valid Execution");
        const res7 = await client.post('/api/customer-action/ord_123/valid_token/run');
        console.log(`Status: ${res7.status}`);
        console.log("Body:", res7.data);
        if (res7.status !== 200) throw new Error("Test 7 failed: Status should be 200");
        if (res7.data.debug_raw_log) {
            throw new Error("Test 7 failed: Run response was not sanitized!");
        }
        console.log("✅ Test 7 Passed: Remediation validation run triggered and sanitized.");

        // Test 8: GET customer action - nested token shape normalization
        console.log("\n[Test 8] GET /api/customer-action/:orderId/:token - Nested Token Shape Normalization");
        const res8 = await client.get('/api/customer-action/ord_123/nested_token');
        console.log(`Status: ${res8.status}`);
        console.log("Body:", res8.data);
        if (res8.status !== 200) throw new Error("Test 8 failed: Status should be 200");
        if (!Array.isArray(res8.data.requiredFiles) || res8.data.requiredFiles[0] !== "INTERIOR_PDF") {
            throw new Error("Test 8 failed: requiredFiles was not properly normalized!");
        }
        if (res8.data.blockers[0] !== "Bleed issues") {
            throw new Error("Test 8 failed: blockers was not properly normalized!");
        }
        console.log("✅ Test 8 Passed: Nested shape normalized correctly.");

        // Test 9: GET /remediation/:orderId/:token - SPA fallback
        console.log("\n[Test 9] GET /remediation/:orderId/:token - SPA Fallback");
        const res9 = await client.get('/remediation/ord_123/valid_token');
        console.log(`Status: ${res9.status}`);
        if (res9.status !== 200 && res9.status !== 404) {
            throw new Error(`Test 9 failed: SPA fallback status should be 200 or 404, got ${res9.status}`);
        }
        if (res9.status === 404 && !res9.data.includes("Frontend build dist/index.html not found")) {
            throw new Error(`Test 9 failed: SPA fallback error text invalid, got: ${res9.data}`);
        }
        console.log("✅ Test 9 Passed: SPA fallback route handled correctly.");

        console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉");
    } catch (err) {
        console.error("\n❌ TEST SUITE FAILED:", err.message);
        exitCode = 1;
    } finally {
        cleanup();
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

// Trap termination signals to ensure cleanup runs
process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('SIGTERM', () => { cleanup(); process.exit(1); });

runTests();
