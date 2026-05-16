require('dotenv').config();
const fs = require('fs');
const path = require('path');
const productionFileMysql = require('../repositories/adapters/mysql/productionFileMysqlRepository');
const offerSessionMysql = require('../repositories/adapters/mysql/offerSessionMysqlRepository');
const orderIntentMysql = require('../repositories/adapters/mysql/orderIntentMysqlRepository');
const { initializeSchema } = require('../repositories/adapters/mysql/schema');

const dryRun = process.argv.includes('--dry-run');

async function migrate() {
    console.log(`[MIGRATION_STARTED] dry_run=${dryRun}`);
    console.log(`Target: ${process.env.MYSQL_DATABASE}@${process.env.MYSQL_HOST}`);
    
    if (!dryRun) {
        await initializeSchema();
    }

    const stats = {
        productionFiles: { imported: 0, skipped: 0, error: 0 },
        offerSessions: { imported: 0, skipped: 0, error: 0 },
        orderIntents: { imported: 0, skipped: 0, error: 0 }
    };

    // Helper to get absolute path from server root
    const getStoragePath = (subDir) => path.join(__dirname, '../storage', subDir, 'index.json');

    // 1. Production Files
    console.log('[MIGRATING_PRODUCTION_FILES]');
    const filesIndex = getStoragePath('production-files');
    if (fs.existsSync(filesIndex)) {
        try {
            const data = JSON.parse(fs.readFileSync(filesIndex, 'utf8'));
            for (const record of Object.values(data)) {
                try {
                    const existing = dryRun ? null : await productionFileMysql.getById(record.file_id);
                    if (!existing) {
                        if (!dryRun) await productionFileMysql.create(record);
                        stats.productionFiles.imported++;
                    } else {
                        stats.productionFiles.skipped++;
                    }
                } catch (err) {
                    console.error(`[ERROR] File ${record.file_id}: ${err.message}`);
                    stats.productionFiles.error++;
                }
            }
        } catch (err) {
            console.error(`[CRITICAL] Failed to parse production-files index: ${err.message}`);
        }
    }

    // 2. Offer Sessions
    console.log('[MIGRATING_OFFER_SESSIONS]');
    const sessionsIndex = getStoragePath('offer-sessions');
    if (fs.existsSync(sessionsIndex)) {
        try {
            const data = JSON.parse(fs.readFileSync(sessionsIndex, 'utf8'));
            for (const record of Object.values(data)) {
                try {
                    const existing = dryRun ? null : await offerSessionMysql.getById(record.offer_session_id);
                    if (!existing) {
                        if (!dryRun) await offerSessionMysql.create(record);
                        stats.offerSessions.imported++;
                    } else {
                        stats.offerSessions.skipped++;
                    }
                } catch (err) {
                    console.error(`[ERROR] Session ${record.offer_session_id}: ${err.message}`);
                    stats.offerSessions.error++;
                }
            }
        } catch (err) {
            console.error(`[CRITICAL] Failed to parse offer-sessions index: ${err.message}`);
        }
    }

    // 3. Order Intents
    console.log('[MIGRATING_ORDER_INTENTS]');
    const intentsIndex = getStoragePath('order-intents');
    if (fs.existsSync(intentsIndex)) {
        try {
            const data = JSON.parse(fs.readFileSync(intentsIndex, 'utf8'));
            for (const record of Object.values(data)) {
                try {
                    const existing = dryRun ? null : await orderIntentMysql.getById(record.order_intent_id);
                    if (!existing) {
                        if (!dryRun) await orderIntentMysql.create(record);
                        stats.orderIntents.imported++;
                    } else {
                        stats.orderIntents.skipped++;
                    }
                } catch (err) {
                    console.error(`[ERROR] Intent ${record.order_intent_id}: ${err.message}`);
                    stats.orderIntents.error++;
                }
            }
        } catch (err) {
            console.error(`[CRITICAL] Failed to parse order-intents index: ${err.message}`);
        }
    }

    console.log('\n[MIGRATION_COMPLETED]');
    console.log('Summary:');
    console.table(stats);
    
    if (Object.values(stats).some(s => s.error > 0)) {
        process.exit(1);
    }
    process.exit(0);
}

migrate().catch(err => {
    console.error(`[MIGRATION_FAILED] ${err.message}`);
    process.exit(1);
});
