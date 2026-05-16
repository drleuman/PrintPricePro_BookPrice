const { query } = require('./mysqlClient');

function mapFromDb(row) {
    if (!row) return null;
    return {
        offer_session_id: row.offer_session_id,
        session_id: row.session_id,
        cart_id: row.cart_id,
        user_id: row.user_id,
        input_specs: typeof row.input_specs_json === 'string' ? JSON.parse(row.input_specs_json) : row.input_specs_json,
        normalized_specs: typeof row.normalized_specs_json === 'string' ? JSON.parse(row.normalized_specs_json) : row.normalized_specs_json,
        offers: typeof row.offers_json === 'string' ? JSON.parse(row.offers_json) : row.offers_json,
        selected_offer_id: row.selected_offer_id,
        expires_at: row.expires_at,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

module.exports = {
    async create(record) {
        const sql = `
            INSERT INTO marketplace_offer_sessions (
                offer_session_id, session_id, cart_id, user_id, 
                input_specs_json, normalized_specs_json, offers_json, 
                expires_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            record.offer_session_id, record.session_id, record.cart_id, record.user_id,
            JSON.stringify(record.input_specs || {}), 
            JSON.stringify(record.normalized_specs || {}), 
            JSON.stringify(record.offers || []),
            record.expires_at, 
            record.created_at || new Date().toISOString(), 
            new Date().toISOString()
        ];
        
        await query(sql, params);
        console.log(`[MYSQL_REPO][OFFER_SESSION_CREATED] id=${record.offer_session_id}`);
        return this.getById(record.offer_session_id);
    },

    async getById(offer_session_id) {
        const rows = await query('SELECT * FROM marketplace_offer_sessions WHERE offer_session_id = ?', [offer_session_id]);
        return mapFromDb(rows[0]);
    },

    async getOffer(offer_session_id, offer_id) {
        const session = await this.getById(offer_session_id);
        if (!session) return null;
        return session.offers?.find(o => o.offer_id === offer_id) || null;
    },

    async markSelectedOffer(offer_session_id, offer_id) {
        const sql = 'UPDATE marketplace_offer_sessions SET selected_offer_id = ?, updated_at = ? WHERE offer_session_id = ?';
        const result = await query(sql, [offer_id, new Date().toISOString(), offer_session_id]);
        return result.affectedRows > 0;
    },

    async listExpired(cutoffDate) {
        const sql = 'SELECT * FROM marketplace_offer_sessions WHERE expires_at < ?';
        const rows = await query(sql, [cutoffDate.toISOString()]);
        return rows.map(mapFromDb);
    },

    async health() {
        const rows = await query('SELECT COUNT(*) as count FROM marketplace_offer_sessions');
        return { ok: true, count: rows[0].count, mode: 'mysql' };
    }
};
