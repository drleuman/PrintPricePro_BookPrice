/**
 * Phase 37.3 MySQL Repository Schema Compliance Test
 * Verifies that the MySQL repository does not use 'payload_json' in any of its queries (inserts, updates, selects).
 */

const assert = require('assert');
const path = require('path');

console.log('=== MySQL Repository Schema Compliance Test ===');

// 1. Mock mysqlClient query function
const mysqlClient = require('../repositories/adapters/mysql/mysqlClient');
const queriesExecuted = [];

mysqlClient.query = async function(sql, params) {
    queriesExecuted.push({ sql, params });
    
    // Return appropriate mock results to avoid mapper exceptions
    const mockRow = {
        order_intent_id: 'oi_test_123',
        public_ref: 'REF-TEST-123',
        session_id: 'session_test_123',
        cart_id: 'cart_test_123',
        user_id: 'user_test_123',
        status: 'CREATED',
        payload: JSON.stringify({ book_type: 'HARDCOVER' }),
        lifecycle: '{}',
        lifecycle_json: '{}',
        offer: '{}',
        offer_json: '{}',
        production_files: '{}',
        production_files_json: '{}',
        customer: '{}',
        customer_json: '{}',
        totals: '{}',
        totals_json: '{}',
        preflight: '{}',
        preflight_json: '{}',
        invoice: '{}',
        invoice_json: '{}',
        payment: '{}',
        payment_json: '{}',
        control_plane: '{}',
        control_plane_json: '{}',
        printhouse_handoff: '{}',
        printhouse_handoff_json: '{}',
        exception: '{}',
        exception_json: '{}',
        production_files_history: '[]',
        production_files_history_json: '[]',
        metadata_json: '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    if (sql.trim().toUpperCase().startsWith('SELECT COUNT(*)')) {
        return [{ count: 1 }];
    }
    
    return [mockRow];
};

// 2. Load orderIntentMysqlRepository
const repository = require('../repositories/adapters/mysql/orderIntentMysqlRepository');

async function runTests() {
    let failed = false;

    // Helper to check for payload_json in executed queries
    function checkQueries(actionName) {
        console.log(`[CHECK] Verifying queries for: ${actionName}`);
        for (const q of queriesExecuted) {
            if (q.sql.toLowerCase().includes('payload_json')) {
                console.error(`❌ FAIL: Query contains 'payload_json':\nSQL: ${q.sql}\nParams: ${JSON.stringify(q.params)}`);
                failed = true;
            }
        }
        queriesExecuted.length = 0; // Clear for next test
    }

    try {
        // Test 1: create
        console.log('\nTesting: repository.create()');
        await repository.create({
            order_intent_id: 'oi_test_123',
            public_ref: 'REF-TEST-123',
            session_id: 'session_test_123',
            status: 'CREATED',
            payload: { book_type: 'HARDCOVER' }
        });
        checkQueries('create()');

        // Test 2: getById
        console.log('\nTesting: repository.getById()');
        await repository.getById('oi_test_123');
        checkQueries('getById()');

        // Test 3: getByPublicRef
        console.log('\nTesting: repository.getByPublicRef()');
        await repository.getByPublicRef('REF-TEST-123');
        checkQueries('getByPublicRef()');

        // Test 4: getByControlPlaneOrderId
        console.log('\nTesting: repository.getByControlPlaneOrderId()');
        await repository.getByControlPlaneOrderId('cp_order_123');
        checkQueries('getByControlPlaneOrderId()');

        // Test 5: listBySession
        console.log('\nTesting: repository.listBySession()');
        await repository.listBySession('session_test_123');
        checkQueries('listBySession()');

        // Test 6: listByUser
        console.log('\nTesting: repository.listByUser()');
        await repository.listByUser('user_test_123');
        checkQueries('listByUser()');

        // Test 7: update
        console.log('\nTesting: repository.update()');
        await repository.update('oi_test_123', {
            status: 'PROCESSING',
            payload: { book_type: 'PAPERBACK', pages: 150 },
            metadata: { source: 'unit_test' },
            lifecycle: { updated: true }
        });
        checkQueries('update()');

        // Test 8: updateStatus
        console.log('\nTesting: repository.updateStatus()');
        await repository.updateStatus('oi_test_123', 'PAID', { payment_status: 'PAID' });
        checkQueries('updateStatus()');

        // Test 9: findAbandoned
        console.log('\nTesting: repository.findAbandoned()');
        await repository.findAbandoned(new Date());
        checkQueries('findAbandoned()');

        // Test 10: health
        console.log('\nTesting: repository.health()');
        await repository.health();
        checkQueries('health()');

        if (failed) {
            console.error('\n❌ SCHEMA COMPLIANCE CHECK FAILED!');
            process.exit(1);
        } else {
            console.log('\n🎉 ALL SCHEMA COMPLIANCE CHECKS PASSED SUCCESSFULLY! No references to payload_json found. 🎉');
            process.exit(0);
        }
    } catch (err) {
        console.error('\n❌ Unexpected error during compliance tests:', err);
        process.exit(1);
    }
}

runTests();
