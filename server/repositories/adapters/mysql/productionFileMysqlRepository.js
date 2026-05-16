const { query } = require('./mysqlClient');

/**
 * Maps a database row to the standard Production File record structure.
 */
function mapFromDb(row) {
    if (!row) return null;
    return {
        file_id: row.file_id,
        role: row.role,
        filename: row.filename,
        safe_filename: row.safe_filename,
        size_bytes: Number(row.size_bytes),
        mime_type: row.mime_type,
        status: row.status,
        source_type: row.source_type,
        checksum: {
            algorithm: row.checksum_algorithm,
            value: row.checksum_value
        },
        storage: {
            provider: row.storage_provider,
            key: row.storage_key
        },
        associations: {
            cart_id: row.cart_id,
            session_id: row.session_id,
            order_intent_id: row.order_intent_id,
            order_ref: row.order_ref,
            user_id: row.user_id
        },
        validation: typeof row.validation_json === 'string' ? JSON.parse(row.validation_json) : row.validation_json,
        replacement: typeof row.replacement_json === 'string' ? JSON.parse(row.replacement_json) : row.replacement_json,
        metadata: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at
    };
}

module.exports = {
    async create(record) {
        const sql = `
            INSERT INTO marketplace_production_files (
                file_id, role, filename, safe_filename, size_bytes, mime_type, 
                status, source_type, checksum_algorithm, checksum_value, 
                storage_provider, storage_key, session_id, cart_id, 
                order_intent_id, order_ref, user_id, 
                validation_json, replacement_json, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            record.file_id, record.role, record.filename, record.safe_filename, record.size_bytes, record.mime_type,
            record.status, record.source_type, record.checksum?.algorithm, record.checksum?.value,
            record.storage?.provider, record.storage?.key, 
            record.associations?.session_id, record.associations?.cart_id, 
            record.associations?.order_intent_id, record.associations?.order_ref, record.associations?.user_id,
            JSON.stringify(record.validation || {}), JSON.stringify(record.replacement || {}), JSON.stringify(record.metadata || {}),
            record.created_at || new Date().toISOString(), new Date().toISOString()
        ];
        
        await query(sql, params);
        console.log(`[MYSQL_REPO][PRODUCTION_FILE_CREATED] file_id=${record.file_id}`);
        return this.getById(record.file_id);
    },

    async getById(file_id) {
        const rows = await query('SELECT * FROM marketplace_production_files WHERE file_id = ?', [file_id]);
        return mapFromDb(rows[0]);
    },

    async listByAssociation({ cart_id, session_id, order_ref, user_id }) {
        let sql = 'SELECT * FROM marketplace_production_files WHERE 1=0';
        const params = [];
        
        if (cart_id) { sql += ' OR cart_id = ?'; params.push(cart_id); }
        if (session_id) { sql += ' OR session_id = ?'; params.push(session_id); }
        if (order_ref) { sql += ' OR order_ref = ?'; params.push(order_ref); }
        if (user_id) { sql += ' OR user_id = ?'; params.push(user_id); }
        
        const rows = await query(sql, params);
        return rows.map(mapFromDb);
    },

    async updateAssociation(file_id, associations) {
        const fields = [];
        const params = [];
        
        if ('cart_id' in associations) { fields.push('cart_id = ?'); params.push(associations.cart_id); }
        if ('session_id' in associations) { fields.push('session_id = ?'); params.push(associations.session_id); }
        if ('order_intent_id' in associations) { fields.push('order_intent_id = ?'); params.push(associations.order_intent_id); }
        if ('order_ref' in associations) { fields.push('order_ref = ?'); params.push(associations.order_ref); }
        if ('user_id' in associations) { fields.push('user_id = ?'); params.push(associations.user_id); }
        
        if (fields.length === 0) return true;
        
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(file_id);
        
        const result = await query(`UPDATE marketplace_production_files SET ${fields.join(', ')} WHERE file_id = ?`, params);
        return result.affectedRows > 0;
    },

    async updateStatus(file_id, status, patch = {}) {
        const fields = ['status = ?', 'updated_at = ?'];
        const params = [status, new Date().toISOString()];
        
        if (patch.validation) {
            fields.push('validation_json = ?');
            params.push(JSON.stringify(patch.validation));
        }
        
        if (patch.replacement) {
            fields.push('replacement_json = ?');
            params.push(JSON.stringify(patch.replacement));
        }
        
        params.push(file_id);
        const result = await query(`UPDATE marketplace_production_files SET ${fields.join(', ')} WHERE file_id = ?`, params);
        return result.affectedRows > 0;
    },

    async markDeleted(file_id, reason) {
        const sql = 'UPDATE marketplace_production_files SET status = ?, deleted_at = ?, updated_at = ?, metadata_json = JSON_SET(COALESCE(metadata_json, "{}"), "$.deletion_reason", ?) WHERE file_id = ?';
        const now = new Date().toISOString();
        const result = await query(sql, ['DELETED', now, now, reason, file_id]);
        return result.affectedRows > 0;
    },

    async findOrphans(cutoffDate) {
        const sql = 'SELECT * FROM marketplace_production_files WHERE order_intent_id IS NULL AND status != "DELETED" AND updated_at < ?';
        const rows = await query(sql, [cutoffDate.toISOString()]);
        return rows.map(mapFromDb);
    },

    async health() {
        const rows = await query('SELECT COUNT(*) as count FROM marketplace_production_files');
        return { ok: true, count: rows[0].count, mode: 'mysql' };
    }
};
