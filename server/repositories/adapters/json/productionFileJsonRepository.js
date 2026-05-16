const fs = require('fs');
const path = require('path');

const PRODUCTION_FILES_DIR = path.join(__dirname, '../../../storage/production-files');
const PRODUCTION_FILES_INDEX = path.join(PRODUCTION_FILES_DIR, 'index.json');

// Ensure directory exists
if (!fs.existsSync(PRODUCTION_FILES_DIR)) {
    fs.mkdirSync(PRODUCTION_FILES_DIR, { recursive: true });
}

const loadIndex = () => {
    try {
        if (!fs.existsSync(PRODUCTION_FILES_INDEX)) return {};
        const data = fs.readFileSync(PRODUCTION_FILES_INDEX, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`[PRODUCTION_FILE_INDEX_READ_FAILED] ${err.message}`);
        return {};
    }
};

const saveIndex = (index) => {
    try {
        const tempPath = `${PRODUCTION_FILES_INDEX}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(index, null, 2));
        fs.renameSync(tempPath, PRODUCTION_FILES_INDEX);
        return true;
    } catch (err) {
        console.error(`[PRODUCTION_FILE_INDEX_WRITE_FAILED] ${err.message}`);
        return false;
    }
};

module.exports = {
    async create(record) {
        const index = loadIndex();
        index[record.file_id] = {
            ...record,
            created_at: record.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        saveIndex(index);
        console.log(`[JSON_REPO][PRODUCTION_FILE_CREATED] file_id=${record.file_id}`);
        return index[record.file_id];
    },

    async getById(file_id) {
        const index = loadIndex();
        return index[file_id];
    },

    async listByAssociation({ cart_id, session_id, order_ref, user_id }) {
        const index = loadIndex();
        return Object.values(index).filter(file => {
            if (cart_id && file.associations?.cart_id === cart_id) return true;
            if (session_id && file.associations?.session_id === session_id) return true;
            if (order_ref && file.associations?.order_ref === order_ref) return true;
            if (user_id && String(file.associations?.user_id) === String(user_id)) return true;
            return false;
        });
    },

    async updateAssociation(file_id, associations) {
        const index = loadIndex();
        if (index[file_id]) {
            index[file_id].associations = {
                ...index[file_id].associations,
                ...associations
            };
            index[file_id].updated_at = new Date().toISOString();
            saveIndex(index);
            return true;
        }
        return false;
    },

    async updateStatus(file_id, status, patch = {}) {
        const index = loadIndex();
        if (index[file_id]) {
            index[file_id] = {
                ...index[file_id],
                status,
                ...patch,
                updated_at: new Date().toISOString()
            };
            saveIndex(index);
            return true;
        }
        return false;
    },

    async markDeleted(file_id, reason) {
        const index = loadIndex();
        if (index[file_id]) {
            index[file_id].status = 'DELETED';
            index[file_id].deletion_reason = reason;
            index[file_id].deleted_at = new Date().toISOString();
            index[file_id].updated_at = new Date().toISOString();
            saveIndex(index);
            return true;
        }
        return false;
    },

    async findOrphans(cutoffDate) {
        const index = loadIndex();
        return Object.values(index).filter(file => {
            if (file.status === 'DELETED') return false;
            const updatedAt = new Date(file.updated_at);
            // Orphan: No intent associated and older than cutoff
            return !file.associations?.order_intent_id && updatedAt < cutoffDate;
        });
    },

    async health() {
        return { ok: true, count: Object.keys(loadIndex()).length, mode: 'json' };
    }
};
