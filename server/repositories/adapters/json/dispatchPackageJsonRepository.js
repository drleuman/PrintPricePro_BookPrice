const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../../../storage/dispatch-packages');
const INDEX_FILE = path.join(STORAGE_DIR, 'index.json');

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

const loadIndex = () => {
    try {
        if (!fs.existsSync(INDEX_FILE)) return {};
        const data = fs.readFileSync(INDEX_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`[DISPATCH_PACKAGE_INDEX_READ_FAILED] ${err.message}`);
        return {};
    }
};

const saveIndex = (index) => {
    try {
        const tempPath = `${INDEX_FILE}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(index, null, 2));
        fs.renameSync(tempPath, INDEX_FILE);
        return true;
    } catch (err) {
        console.error(`[DISPATCH_PACKAGE_INDEX_WRITE_FAILED] ${err.message}`);
        return false;
    }
};

module.exports = {
    async create(pkg) {
        const index = loadIndex();
        index[pkg.package_id] = {
            ...pkg,
            created_at: pkg.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        saveIndex(index);
        console.log(`[JSON_REPO][DISPATCH_PACKAGE_CREATED] id=${pkg.package_id}`);
        return index[pkg.package_id];
    },

    async getById(package_id) {
        const index = loadIndex();
        return index[package_id];
    },

    async getByOrderIntentId(order_intent_id) {
        const index = loadIndex();
        return Object.values(index).find(p => p.order_intent_id === order_intent_id);
    },

    async updateStatus(package_id, status, patch = {}) {
        const index = loadIndex();
        if (index[package_id]) {
            index[package_id].status = status || index[package_id].status;
            if (status === 'REVOKED') {
                index[package_id].revoked_at = new Date().toISOString();
            }
            if (patch.access) {
                index[package_id].access = { ...index[package_id].access, ...patch.access };
            }
            index[package_id].updated_at = new Date().toISOString();
            saveIndex(index);
            return true;
        }
        return false;
    },

    async updateProductionQueue(package_id, queueData) {
        const index = loadIndex();
        if (index[package_id]) {
            index[package_id].production_queue = queueData;
            index[package_id].updated_at = new Date().toISOString();
            saveIndex(index);
            return true;
        }
        return false;
    },

    async listByPrinthouse(printhouse_id, filters = {}) {
        const index = loadIndex();
        let list = Object.values(index);
        
        if (printhouse_id) {
            list = list.filter(p => p.printhouse_id === printhouse_id);
        }
        
        if (filters.status) {
            list = list.filter(p => p.production_queue?.status === filters.status);
        }
        
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        if (filters.limit) {
            const start = parseInt(filters.offset || 0);
            list = list.slice(start, start + parseInt(filters.limit));
        }
        
        return list;
    },

    async incrementAccess(package_id) {
        const index = loadIndex();
        if (index[package_id]) {
            index[package_id].access = {
                ...(index[package_id].access || {}),
                access_count: ((index[package_id].access?.access_count) || 0) + 1,
                last_accessed_at: new Date().toISOString()
            };
            index[package_id].updated_at = new Date().toISOString();
            saveIndex(index);
            return true;
        }
        return false;
    },

    async health() {
        const index = loadIndex();
        const list = Object.values(index);
        
        const byStatus = {};
        const byQueueStatus = {};
        
        list.forEach(p => {
            byStatus[p.status] = (byStatus[p.status] || 0) + 1;
            const qStatus = p.production_queue?.status || 'null';
            byQueueStatus[qStatus] = (byQueueStatus[qStatus] || 0) + 1;
        });
        
        return {
            total: list.length,
            by_status: byStatus,
            by_queue_status: byQueueStatus
        };
    }
};
