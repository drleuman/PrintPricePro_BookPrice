const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../../../storage');
const AUDIT_LOG = path.join(STORAGE_DIR, 'audit.jsonl');

// Ensure directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

module.exports = {
    async append(event) {
        const record = {
            ...event,
            created_at: event.created_at || new Date().toISOString()
        };
        try {
            fs.appendFileSync(AUDIT_LOG, JSON.stringify(record) + '\n');
            // In JSON mode, we just log to console as well
            console.log(`[AUDIT_EVENT][${record.event_type}] entity=${record.entity_type}:${record.entity_id}`);
            return true;
        } catch (err) {
            console.error(`[AUDIT_LOG_APPEND_FAILED] ${err.message}`);
            return false;
        }
    },

    async listByEntity(entity_type, entity_id) {
        if (!fs.existsSync(AUDIT_LOG)) return [];
        try {
            const data = fs.readFileSync(AUDIT_LOG, 'utf8');
            return data.split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line))
                .filter(e => e.entity_type === entity_type && e.entity_id === entity_id);
        } catch (err) {
            console.error(`[AUDIT_LOG_READ_FAILED] ${err.message}`);
            return [];
        }
    },

    async health() {
        const exists = fs.existsSync(AUDIT_LOG);
        return { ok: true, log_exists: exists, mode: 'json' };
    }
};
