const { query } = require('./mysqlClient');

function mapFromDb(row) {
    if (!row) return null;
    return {
        order_intent_id: row.order_intent_id,
        public_ref: row.public_ref,
        session_id: row.session_id,
        cart_id: row.cart_id,
        user_id: row.user_id,
        status: row.status,
        payload: typeof (row.payload || row.payload_json) === 'string' ? JSON.parse(row.payload || row.payload_json) : (row.payload || row.payload_json),
        lifecycle: typeof (row.lifecycle || row.lifecycle_json) === 'string' ? JSON.parse(row.lifecycle || row.lifecycle_json) : (row.lifecycle || row.lifecycle_json),
        offer: typeof (row.offer || row.offer_json) === 'string' ? JSON.parse(row.offer || row.offer_json) : (row.offer || row.offer_json),
        production_files: typeof (row.production_files || row.production_files_json) === 'string' ? JSON.parse(row.production_files || row.production_files_json) : (row.production_files || row.production_files_json),
        customer: typeof (row.customer || row.customer_json) === 'string' ? JSON.parse(row.customer || row.customer_json) : (row.customer || row.customer_json),
        totals: typeof (row.totals || row.totals_json) === 'string' ? JSON.parse(row.totals || row.totals_json) : (row.totals || row.totals_json),
        preflight: typeof (row.preflight || row.preflight_json) === 'string' ? JSON.parse(row.preflight || row.preflight_json) : (row.preflight || row.preflight_json),
        invoice: typeof (row.invoice || row.invoice_json) === 'string' ? JSON.parse(row.invoice || row.invoice_json) : (row.invoice || row.invoice_json),
        payment: typeof (row.payment || row.payment_json) === 'string' ? JSON.parse(row.payment || row.payment_json) : (row.payment || row.payment_json),
        control_plane: typeof (row.control_plane || row.control_plane_json) === 'string' ? JSON.parse(row.control_plane || row.control_plane_json) : (row.control_plane || row.control_plane_json),
        printhouse_handoff: typeof (row.printhouse_handoff || row.printhouse_handoff_json) === 'string' ? JSON.parse(row.printhouse_handoff || row.printhouse_handoff_json) : (row.printhouse_handoff || row.printhouse_handoff_json),
        exception: typeof (row.exception || row.exception_json) === 'string' ? JSON.parse(row.exception || row.exception_json) : (row.exception || row.exception_json),
        production_files_history: typeof (row.production_files_history || row.production_files_history_json) === 'string' ? JSON.parse(row.production_files_history || row.production_files_history_json) : (row.production_files_history || row.production_files_history_json),
        metadata: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json,
        created_at: row.created_at,
        updated_at: row.updated_at,
        cancelled_at: row.cancelled_at,
        cancellation_reason: row.cancellation_reason
    };
}

module.exports = {
    async create(record) {
        const sql = `
            INSERT INTO marketplace_order_intents (
                order_intent_id, public_ref, session_id, cart_id, user_id, status,
                payload,
                lifecycle, lifecycle_json, 
                offer, offer_json, 
                production_files, production_files_json, 
                customer, customer_json,
                totals, totals_json, 
                preflight, preflight_json, 
                invoice, invoice_json, 
                payment, payment_json,
                control_plane, control_plane_json, 
                printhouse_handoff, printhouse_handoff_json, 
                exception, exception_json, 
                production_files_history, production_files_history_json,
                metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const safeJson = (val) => val === undefined ? null : JSON.stringify(val);

        const params = [
            record.order_intent_id, record.public_ref, record.session_id, record.cart_id || null, record.user_id || null, record.status,
            safeJson(record.payload),
            safeJson(record.lifecycle), safeJson(record.lifecycle),
            safeJson(record.offer), safeJson(record.offer),
            safeJson(record.production_files), safeJson(record.production_files),
            safeJson(record.customer), safeJson(record.customer),
            safeJson(record.totals), safeJson(record.totals),
            safeJson(record.preflight), safeJson(record.preflight),
            safeJson(record.invoice), safeJson(record.invoice),
            safeJson(record.payment), safeJson(record.payment),
            safeJson(record.control_plane), safeJson(record.control_plane),
            safeJson(record.printhouse_handoff), safeJson(record.printhouse_handoff),
            safeJson(record.exception), safeJson(record.exception),
            safeJson(record.production_files_history), safeJson(record.production_files_history),
            safeJson(record.metadata),
            record.created_at || new Date().toISOString(), new Date().toISOString()
        ];
        
        await query(sql, params);
        console.log(`[MYSQL_REPO][ORDER_INTENT_CREATED] id=${record.order_intent_id} ref=${record.public_ref}`);
        return this.getById(record.order_intent_id);
    },

    async getById(order_intent_id) {
        const rows = await query('SELECT * FROM marketplace_order_intents WHERE order_intent_id = ?', [order_intent_id]);
        return mapFromDb(rows[0]);
    },

    async getByPublicRef(public_ref) {
        const rows = await query('SELECT * FROM marketplace_order_intents WHERE public_ref = ?', [public_ref]);
        return mapFromDb(rows[0]);
    },

    async listBySession(session_id) {
        const rows = await query('SELECT * FROM marketplace_order_intents WHERE session_id = ?', [session_id]);
        return rows.map(mapFromDb);
    },

    async listByUser(user_id) {
        const rows = await query('SELECT * FROM marketplace_order_intents WHERE user_id = ?', [user_id]);
        return rows.map(mapFromDb);
    },

    async update(order_intent_id, patch) {
        const fields = [];
        const params = [];
        
        const jsonFields = [
            'payload', 'lifecycle', 'offer', 'production_files', 'customer', 'totals', 
            'preflight', 'invoice', 'payment', 'control_plane', 'printhouse_handoff', 
            'exception', 'production_files_history', 'metadata'
        ];
        
        jsonFields.forEach(key => {
            if (key in patch) {
                const val = patch[key] === undefined ? null : JSON.stringify(patch[key]);
                fields.push(`${key} = ?`);
                params.push(val);
                // Also update the _json version for compatibility
                fields.push(`${key}_json = ?`);
                params.push(val);
            }
        });
        
        if ('status' in patch) {
            fields.push('status = ?');
            params.push(patch.status);
        }
        
        if (fields.length === 0) return this.getById(order_intent_id);
        
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(order_intent_id);
        
        await query(`UPDATE marketplace_order_intents SET ${fields.join(', ')} WHERE order_intent_id = ?`, params);
        return this.getById(order_intent_id);
    },

    async updateStatus(order_intent_id, status, lifecyclePatch = {}) {
        // More specific update for status and lifecycle
        const sql = `
            UPDATE marketplace_order_intents 
            SET status = ?, 
                lifecycle_json = JSON_MERGE_PATCH(COALESCE(lifecycle_json, '{}'), ?),
                updated_at = ? 
            WHERE order_intent_id = ?
        `;
        const params = [status, JSON.stringify(lifecyclePatch), new Date().toISOString(), order_intent_id];
        const result = await query(sql, params);
        return result.affectedRows > 0;
    },

    async findAbandoned(cutoffDate) {
        const sql = `
            SELECT * FROM marketplace_order_intents 
            WHERE status NOT IN ('CANCELLED', 'CONTROL_PLANE_ORDER_CREATED')
            AND (JSON_UNQUOTE(JSON_EXTRACT(payment_json, "$.status")) != 'PAID' OR payment_json IS NULL)
            AND created_at < ?
        `;
        const rows = await query(sql, [cutoffDate.toISOString()]);
        return rows.map(mapFromDb);
    },

    async health() {
        const rows = await query('SELECT COUNT(*) as count FROM marketplace_order_intents');
        const exceptionStats = await query(`
            SELECT 
                JSON_UNQUOTE(JSON_EXTRACT(exception_json, '$.status')) as status,
                COUNT(*) as count
            FROM marketplace_order_intents
            WHERE exception_json IS NOT NULL
            GROUP BY status
        `);
        
        return { 
            ok: true, 
            count: rows[0].count, 
            mode: 'mysql',
            exceptions: exceptionStats.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {})
        };
    }
};
