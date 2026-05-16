const { query } = require('./mysqlClient');

/**
 * Maps a database row to a Notification Event object.
 */
const mapRowToEvent = (row) => {
    if (!row) return null;
    return {
        notification_id: row.notification_id,
        order_intent_id: row.order_intent_id,
        public_ref: row.public_ref,
        recipient_email: row.recipient_email,
        event_type: row.event_type,
        provider: row.provider,
        status: row.status,
        subject: row.subject,
        payload: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json,
        error: typeof row.error_json === 'string' ? JSON.parse(row.error_json) : row.error_json,
        created_at: row.created_at,
        sent_at: row.sent_at
    };
};

module.exports = {
    async create(event) {
        const { 
            notification_id, order_intent_id, public_ref, recipient_email, 
            event_type, provider, status, subject, payload, error, created_at 
        } = event;
        
        await query(
            `INSERT INTO marketplace_notification_events 
            (notification_id, order_intent_id, public_ref, recipient_email, event_type, provider, status, subject, payload_json, error_json, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                notification_id, order_intent_id, public_ref, recipient_email,
                event_type, provider, status, subject,
                JSON.stringify(payload || {}),
                JSON.stringify(error || null),
                created_at || new Date().toISOString()
            ]
        );
        return event;
    },

    async updateStatus(notification_id, status, patch = {}) {
        const fields = ['status = ?'];
        const params = [status];

        if (status === 'SENT') {
            fields.push('sent_at = NOW()');
        }

        if (patch.error) {
            fields.push('error_json = ?');
            params.push(JSON.stringify(patch.error));
        }

        params.push(notification_id);

        await query(
            `UPDATE marketplace_notification_events SET ${fields.join(', ')} WHERE notification_id = ?`,
            params
        );
        return true;
    },

    async getById(notification_id) {
        const rows = await query(`SELECT * FROM marketplace_notification_events WHERE notification_id = ?`, [notification_id]);
        return mapRowToEvent(rows[0]);
    },

    async findDuplicate(order_intent_id, event_type) {
        const rows = await query(
            `SELECT * FROM marketplace_notification_events 
             WHERE order_intent_id = ? AND event_type = ? AND status IN ('SENT', 'PENDING')
             ORDER BY created_at DESC LIMIT 1`,
            [order_intent_id, event_type]
        );
        return mapRowToEvent(rows[0]);
    },

    async listByOrderIntent(order_intent_id) {
        const rows = await query(
            `SELECT * FROM marketplace_notification_events WHERE order_intent_id = ? ORDER BY created_at DESC`,
            [order_intent_id]
        );
        return rows.map(mapRowToEvent);
    },

    async health() {
        const total = await query(`SELECT COUNT(*) as count FROM marketplace_notification_events`);
        const byStatus = await query(`SELECT status, COUNT(*) as count FROM marketplace_notification_events GROUP BY status`);
        
        return {
            total: total[0].count,
            by_status: byStatus.reduce((acc, row) => ({ ...acc, [row.status]: row.count }), {})
        };
    }
};
