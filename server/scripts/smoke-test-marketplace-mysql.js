require('dotenv').config();
const repositories = require('../repositories');

async function smokeTest() {
    console.log('--- Marketplace MySQL Smoke Test ---');
    console.log(`Mode: ${process.env.PERSISTENCE_ADAPTER || 'DEFAULT'}`);
    
    if (process.env.PERSISTENCE_ADAPTER !== 'mysql') {
        console.warn('[WARN] PERSISTENCE_ADAPTER is not set to mysql. Forcing mysql mode for test if possible...');
        // Note: repositories/index.js chooses based on env, so we should have set it in shell.
    }

    try {
        // 1. Initialize
        await repositories.initialize();
        console.log('[PASS] Repositories initialized.');

        const sessionId = `smoke_test_session_${Date.now()}`;
        const userId = `smoke_test_user_${Date.now()}`;

        // 2. Offer Session
        console.log('[TEST] Offer Sessions...');
        const offerSessionId = `ofs_smoke_${Date.now()}`;
        await repositories.offerSessions.create({
            offer_session_id: offerSessionId,
            session_id: sessionId,
            input_specs: { book_type: 'HARDCOVER', pages: 200 },
            offers: [{ id: 'off_1', total_price: 100 }],
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString()
        });
        
        const session = await repositories.offerSessions.getById(offerSessionId);
        if (!session || session.offer_session_id !== offerSessionId) throw new Error('Offer session retrieval failed');
        console.log('[PASS] Offer session created and retrieved.');

        // 3. Production File
        console.log('[TEST] Production Files...');
        const fileId = `pf_smoke_${Date.now()}`;
        await repositories.productionFiles.create({
            file_id: fileId,
            session_id: sessionId,
            role: 'INTERIOR_PDF',
            filename: 'test.pdf',
            status: 'UPLOADED',
            storage: { provider: 'LOCAL', key: 'test.pdf' },
            checksum: 'sha256-dummy',
            created_at: new Date().toISOString()
        });

        const file = await repositories.productionFiles.getById(fileId);
        if (!file || file.file_id !== fileId) throw new Error('Production file retrieval failed');
        console.log('[PASS] Production file created and retrieved.');

        // 4. Order Intent
        console.log('[TEST] Order Intents...');
        const intentId = `oi_smoke_${Date.now()}`;
        const publicRef = `REF-SMOKE-${Date.now()}`;
        await repositories.orderIntents.create({
            order_intent_id: intentId,
            public_ref: publicRef,
            session_id: sessionId,
            user_id: userId,
            status: 'FILES_UPLOADED',
            lifecycle: { payment_status: 'NOT_STARTED' },
            offer: { offer_session_id: offerSessionId, offer_id: 'off_1' },
            production_files: { 
                interior_pdf_file_id: fileId,
                files: [{ role: 'INTERIOR_PDF', file_id: fileId }]
            },
            created_at: new Date().toISOString()
        });

        const intent = await repositories.orderIntents.getById(intentId);
        if (!intent || intent.order_intent_id !== intentId) throw new Error('Order intent retrieval failed');
        
        const intentByRef = await repositories.orderIntents.getByPublicRef(publicRef);
        if (!intentByRef || intentByRef.order_intent_id !== intentId) throw new Error('Order intent retrieval by ref failed');
        console.log('[PASS] Order intent created and retrieved by ID and Ref.');

        // 5. Update Status
        console.log('[TEST] Status Updates...');
        await repositories.orderIntents.updateStatus(intentId, 'PAID', { payment_status: 'PAID' });
        const updatedIntent = await repositories.orderIntents.getById(intentId);
        if (updatedIntent.status !== 'PAID' || updatedIntent.lifecycle.payment_status !== 'PAID') {
            throw new Error('Order intent status update failed');
        }
        console.log('[PASS] Order intent status updated.');

        // 6. Audit Events
        console.log('[TEST] Audit Events...');
        await repositories.auditEvents.append({
            entity_type: 'ORDER_INTENT',
            entity_id: intentId,
            event_type: 'SMOKE_TEST_EVENT',
            actor_type: 'SYSTEM',
            payload: { ok: true }
        });
        console.log('[PASS] Audit event appended.');

        console.log('\n--- SMOKE TEST SUMMARY: PASS ---');
        process.exit(0);

    } catch (err) {
        console.error(`\n--- SMOKE TEST SUMMARY: FAIL ---`);
        console.error(`Error: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
}

smokeTest();
