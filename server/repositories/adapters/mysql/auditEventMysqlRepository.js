const { query } = require('./mysqlClient');
const crypto = require('crypto');

module.exports = {
    async append(event) {
        const sql = `
            INSERT INTO marketplace_audit_events (
                event_id, entity_type, entity_id, event_type, 
                actor_type, actor_id, session_id, ip_hash, 
                payload_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const event_id = event.event_id || `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const params = [
            event_id,
            event.entity_type,
            event.entity_id,
            event.event_type,
            event.actor_type || 'SYSTEM',
            event.actor_id,
            event.session_id,
            event.ip ? crypto.createHash('sha256').update(event.ip).digest('hex') : null,
            JSON.stringify(event.payload || {}),
            event.created_at || new Date().toISOString()
        ];
        
        try {
            await query(sql, params);
            console.log(`[MYSQL_REPO][AUDIT_EVENT_APPENDED] id=${event_id} type=${event.event_type}`);
            return true;
        } catch (err) {
            console.error(`[MYSQL_REPO][AUDIT_EVENT_FAILED] ${err.message}`);
            return false;
        }
    },

    async listByEntity(entity_type, entity_id) {
        const sql = 'SELECT * FROM marketplace_audit_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC';
        const rows = await query(sql, [entity_type, entity_id]);
        return rows.map(row => ({
            ...row,
            payload: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json
        }));
    },

    async health() {
        const rows = await query('SELECT COUNT(*) as count FROM marketplace_audit_events');
        return { ok: true, count: rows[0].count, mode: 'mysql' };
    }
};
