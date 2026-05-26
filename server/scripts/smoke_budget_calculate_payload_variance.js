/**
 * Smoke test: Verifies budget/BPE calculations preserve input specifications,
 * show price variance, and prevent static/fallback offer pricing.
 */

'use strict';

// Set up env variables before requiring server.js
process.env.NODE_ENV = 'test';
process.env.PERSISTENCE_ADAPTER = 'json';
process.env.PORT = '3009';
process.env.SESSION_SECRET = 'smoke_session_secret_12345';
process.env.SIGNING_SECRET = 'smoke_signing_secret_12345';
process.env.OFFER_SIGNING_SECRET = 'smoke_offer_signing_secret_12345';
process.env.BPE_JWT_SECRET = process.env.BPE_JWT_SECRET || 'smoke_bpe_jwt_secret_12345';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore SSL validation for local tests calling remote BPE

// Force the legacy URL so we test that resolveBpeMarketplaceOffersUrl intercepts and resolves it to bpe.printprice.pro
process.env.BPE_MARKETPLACE_OFFERS_URL = 'http://127.0.0.1:8081/api/marketplace/offers';

const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Start the Express budget server
console.log('[SMOKE_TEST] Starting budget server...');
require('../server.js');

const baseUrl = 'http://127.0.0.1:3009';

// Define our three test cases
const CaseA = {
  copies: 100,
  interior_pages: 200,
  delivery_country: 'MX',
  book_size: 'A5'
};

const CaseB = {
  copies: 1800,
  interior_pages: 360,
  delivery_country: 'ES',
  book_size: 'A5'
};

const CaseC = {
  copies: 6000,
  interior_pages: 120,
  delivery_country: 'DE',
  book_size: 'A4'
};

async function runRequest(spec, label) {
  try {
    const res = await axios.post(`${baseUrl}/api/budget/calculate`, spec, { timeout: 15000 });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, status: err.response?.status, data: err.response?.data, message: err.message };
  }
}

async function startTest() {
  // Wait a moment for server initialization
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n[SMOKE_TEST] Running Case A...');
  const resA = await runRequest(CaseA, 'Case A');

  console.log('\n[SMOKE_TEST] Running Case B...');
  const resB = await runRequest(CaseB, 'Case B');

  console.log('\n[SMOKE_TEST] Running Case C...');
  const resC = await runRequest(CaseC, 'Case C');

  let failed = false;
  const errors = [];

  // Assertions
  const checkCase = (res, spec, label) => {
    if (!res.ok) {
      errors.push(`${label} failed: ${res.message} - ${JSON.stringify(res.data)}`);
      failed = true;
      return null;
    }
    
    const body = res.data;
    if (!body.ok) {
      errors.push(`${label} returned ok:false`);
      failed = true;
      return null;
    }

    if (!Array.isArray(body.offers)) {
      errors.push(`${label} returned invalid offers shape`);
      failed = true;
      return null;
    }

    console.log(`[SMOKE_TEST] ${label} response returned ${body.offers.length} offers`);
    return body;
  };

  const bodyA = checkCase(resA, CaseA, 'Case A');
  const bodyB = checkCase(resB, CaseB, 'Case B');
  const bodyC = checkCase(resC, CaseC, 'Case C');

  if (failed) {
    console.error('[SMOKE_TEST] Request validation failed:');
    console.error(errors.join('\n'));
    process.exit(1);
  }

  // Specs validation
  const verifySpecs = (body, inputSpec, label) => {
    if (!body || body.offers.length === 0) return;
    const sampleOffer = body.offers[0];
    const respSpecs = sampleOffer.specs || {};
    
    if (Number(respSpecs.copies) !== inputSpec.copies) {
      errors.push(`${label} copies mismatch: expected ${inputSpec.copies}, got ${respSpecs.copies}`);
      failed = true;
    }
    if (Number(respSpecs.interior_pages) !== inputSpec.interior_pages) {
      errors.push(`${label} interior_pages mismatch: expected ${inputSpec.interior_pages}, got ${respSpecs.interior_pages}`);
      failed = true;
    }
    if (respSpecs.delivery_country?.toUpperCase() !== inputSpec.delivery_country.toUpperCase()) {
      errors.push(`${label} delivery_country mismatch: expected ${inputSpec.delivery_country}, got ${respSpecs.delivery_country}`);
      failed = true;
    }
  };

  verifySpecs(bodyA, CaseA, 'Case A');
  verifySpecs(bodyB, CaseB, 'Case B');
  verifySpecs(bodyC, CaseC, 'Case C');

  if (failed) {
    console.error('[SMOKE_TEST] Specs validation failed:');
    console.error(errors.join('\n'));
    process.exit(1);
  }

  // Price Variance check
  const getOfferPrices = (body) => {
    if (!body || !body.offers) return [];
    return body.offers.map(o => Number(o.total_price));
  };

  const pricesA = getOfferPrices(bodyA);
  const pricesB = getOfferPrices(bodyB);
  const pricesC = getOfferPrices(bodyC);

  console.log('\n--- PRICE SUMMARY ---');
  console.log('Case A (MX, 100 copies, 200 pages):', pricesA);
  console.log('Case B (ES, 1800 copies, 360 pages):', pricesB);
  console.log('Case C (DE, 6000 copies, 120 pages):', pricesC);

  // Fallback checks
  const fallbackPrices = [2607.2429, 2718.3, 2752.1571];
  const containsFallback = (prices) => {
    return prices.some(p => fallbackPrices.some(fp => Math.abs(p - fp) < 0.01));
  };

  if (containsFallback(pricesA) || containsFallback(pricesB) || containsFallback(pricesC)) {
    console.error('\n[SMOKE_TEST] BPE_STATIC_PRICING_DETECTED: Static default offers returned.');
    process.exit(1);
  }

  // Assert price variance between B and C
  if (pricesB.length > 0 && pricesC.length > 0) {
    const pricesBStr = pricesB.sort().join(',');
    const pricesCStr = pricesC.sort().join(',');
    if (pricesBStr === pricesCStr) {
      console.error('\n[SMOKE_TEST] Prices are identical between Case B and Case C! BPE_STATIC_PRICING_DETECTED');
      process.exit(1);
    }
  } else {
    console.error('\n[SMOKE_TEST] Failed: Case B or Case C returned 0 offers, cannot verify price variance.');
    process.exit(1);
  }

  console.log('\n[SMOKE_TEST] SUCCESS: Price variance validated, BPE fallback protection certified.');
  process.exit(0);
}

startTest().catch(err => {
  console.error('[SMOKE_TEST] Unhandled error:', err);
  process.exit(1);
});
