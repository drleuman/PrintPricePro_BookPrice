/**
 * Security Chaos Test Script
 * Simulates various attack vectors to verify hardening effectiveness.
 */

const axios = require('axios');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:3000';
const PROXY_URL = `${BASE_URL}/api-proxy/v1beta/models/gemini-1.5-flash:generateContent`;
const PROXY_KEY = 'dev-fallback-secret-key'; // Matches server default

async function runTests() {
    console.log("🚀 Starting Security Chaos Tests...\n");

    // 1. Test: Missing Auth
    try {
        console.log("Test 1: Proxy call without auth...");
        await axios.post(PROXY_URL, {});
    } catch (e) {
        console.log(`✅ Result: Blocked as expected (${e.response?.status})\n`);
    }

    // 2. Test: Price Manipulation (Business Logic)
    try {
        console.log("Test 2: Price manipulation (negative copies)...");
        await axios.post(PROXY_URL, { copies: -500, pages: 100 }, {
            headers: { 'X-App-Proxy-Key': PROXY_KEY }
        });
    } catch (e) {
        console.log(`✅ Result: Blocked as expected (${e.response?.status}: ${e.response?.data?.error})\n`);
    }

    // 3. Test: Body Size Limit
    try {
        console.log("Test 3: Large payload attack (3MB)...");
        const largeData = 'A'.repeat(3 * 1024 * 1024);
        await axios.post(PROXY_URL, { data: largeData }, {
            headers: { 'X-App-Proxy-Key': PROXY_KEY }
        });
    } catch (e) {
        console.log(`✅ Result: Blocked as expected (${e.response?.status})\n`);
    }

    // 4. Test: AI Budget Guard (Quota Exhaustion)
    console.log("Test 4: Simulating AI Quota Exhaustion (51 requests)...");
    let blocked = false;
    for (let i = 0; i < 55; i++) {
        try {
            await axios.post(PROXY_URL, { test: i }, {
                headers: { 'X-App-Proxy-Key': PROXY_KEY }
            });
        } catch (e) {
            if (e.response?.status === 429) {
                console.log(`✅ Result: Quota blocked at request ${i}\n`);
                blocked = true;
                break;
            }
        }
    }
    if (!blocked) console.log("❌ Result: Budget guard failed!");

    // 5. Test: WebSocket Throttling
    console.log("Test 5: WebSocket flood simulation...");
    const ws = new WebSocket(`${BASE_URL.replace('http', 'ws')}/api-proxy/v1beta/models/gemini-1.5-flash:streamGenerateContent`, {
        headers: { 'X-App-Proxy-Key': PROXY_KEY }
    });

    ws.on('open', () => {
        console.log("WS Opened, sending 50 messages...");
        for (let i = 0; i < 50; i++) {
            ws.send(JSON.stringify({ msg: i }));
        }
        setTimeout(() => {
            console.log("✅ Check server logs for 'WebSocket flood detected'");
            ws.close();
        }, 2000);
    });

    ws.on('error', (e) => console.log("WS Error:", e.message));
}

runTests();
