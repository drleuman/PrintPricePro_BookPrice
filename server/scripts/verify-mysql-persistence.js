require('dotenv').config();
const mysql = require('mysql2/promise');
const { initializeSchema } = require('../repositories/adapters/mysql/schema');
const auditEventMysql = require('../repositories/adapters/mysql/auditEventMysqlRepository');

async function verify() {
    console.log('--- MySQL Persistence Verification ---');
    console.log(`Time: ${new Date().toISOString()}`);

    const config = {
        host: process.env.MYSQL_HOST || 'localhost',
        port: process.env.MYSQL_PORT || 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    };

    if (!config.user || !config.database) {
        console.error('[FAIL] Missing MySQL credentials in .env');
        process.exit(1);
    }

    let connection;
    try {
        console.log(`[CHECK] Connecting to ${config.host}:${config.port}/${config.database}...`);
        connection = await mysql.createConnection(config);
        console.log('[PASS] Connection established.');

        // 1. Verify Tables
        console.log('[CHECK] Verifying schema...');
        const [tables] = await connection.execute('SHOW TABLES');
        const tableList = tables.map(t => Object.values(t)[0]);
        
        const requiredTables = [
            'marketplace_production_files',
            'marketplace_offer_sessions',
            'marketplace_order_intents',
            'marketplace_audit_events'
        ];

        for (const table of requiredTables) {
            if (tableList.includes(table)) {
                console.log(`[PASS] Table exists: ${table}`);
            } else {
                console.error(`[FAIL] Missing table: ${table}`);
                throw new Error(`Schema incomplete: ${table}`);
            }
        }

        // 2. Verify Columns for one table (Order Intents)
        console.log('[CHECK] Verifying columns for marketplace_order_intents...');
        const [columns] = await connection.execute('DESCRIBE marketplace_order_intents');
        const colNames = columns.map(c => c.Field);
        const requiredCols = ['order_intent_id', 'public_ref', 'session_id', 'status', 'lifecycle', 'payload'];
        
        for (const col of requiredCols) {
            if (colNames.includes(col)) {
                // Check if it's JSON type for JSON columns
                const colDef = columns.find(c => c.Field === col);
                console.log(`[PASS] Column exists: ${col} (${colDef.Type})`);
            } else {
                console.error(`[FAIL] Missing column: ${col}`);
                throw new Error(`Schema drift: ${col}`);
            }
        }

        // 3. Test Audit Event Insertion (Forensic Trace)
        console.log('[CHECK] Testing audit event insertion...');
        const testEvent = {
            entity_type: 'SYSTEM',
            entity_id: 'VERIFY_SCRIPT',
            event_type: 'PERSISTENCE_VERIFIED',
            actor_type: 'SYSTEM',
            payload: { message: 'MySQL Persistence Verification Success', timestamp: new Date().toISOString() }
        };
        
        // We use the repository directly if possible, or raw SQL
        await connection.execute(
            `INSERT INTO marketplace_audit_events (entity_type, entity_id, event_type, actor_type, payload, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [testEvent.entity_type, testEvent.entity_id, testEvent.event_type, testEvent.actor_type, JSON.stringify(testEvent.payload)]
        );
        console.log('[PASS] Test audit event inserted.');

        console.log('\n--- VERIFICATION SUMMARY: PASS ---');
        process.exit(0);

    } catch (err) {
        console.error(`\n--- VERIFICATION SUMMARY: FAIL ---`);
        console.error(`Error: ${err.message}`);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

verify();
