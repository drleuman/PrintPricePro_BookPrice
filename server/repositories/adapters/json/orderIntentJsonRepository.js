const fs = require('fs');
const path = require('path');

const ORDER_INTENTS_DIR = path.join(__dirname, '../../../storage/order-intents');
const ORDER_INTENTS_INDEX = path.join(ORDER_INTENTS_DIR, 'index.json');

// Ensure directory exists
if (!fs.existsSync(ORDER_INTENTS_DIR)) {
    fs.mkdirSync(ORDER_INTENTS_DIR, { recursive: true });
}

const loadIndex = () => {
    try {
        if (!fs.existsSync(ORDER_INTENTS_INDEX)) return {};
        const data = fs.readFileSync(ORDER_INTENTS_INDEX, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`[ORDER_INTENT_INDEX_READ_FAILED] ${err.message}`);
        return {};
    }
};

const saveIndex = (index) => {
    try {
        const tempPath = `${ORDER_INTENTS_INDEX}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(index, null, 2));
        fs.renameSync(tempPath, ORDER_INTENTS_INDEX);
        return true;
    } catch (err) {
        console.error(`[ORDER_INTENT_INDEX_WRITE_FAILED] ${err.message}`);
        return false;
    }
};

module.exports = {
    async create(record) {
        const index = loadIndex();
        index[record.order_intent_id] = {
            ...record,
            created_at: record.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        saveIndex(index);
        console.log(`[JSON_REPO][ORDER_INTENT_CREATED] id=${record.order_intent_id} ref=${record.public_ref}`);
        return index[record.order_intent_id];
    },

    async getById(order_intent_id) {
        const index = loadIndex();
        return index[order_intent_id];
    },

    async getByPublicRef(public_ref) {
        const index = loadIndex();
        return Object.values(index).find(oi => oi.public_ref === public_ref);
    },

    async listBySession(session_id) {
        const index = loadIndex();
        return Object.values(index).filter(oi => oi.session_id === session_id);
    },

    async listByUser(user_id) {
        const index = loadIndex();
        return Object.values(index).filter(oi => String(oi.user_id) === String(user_id));
    },

    async update(order_intent_id, patch) {
        const index = loadIndex();
        if (index[order_intent_id]) {
            index[order_intent_id] = {
                ...index[order_intent_id],
                ...patch,
                updated_at: new Date().toISOString()
            };
            saveIndex(index);
            return index[order_intent_id];
        }
        return null;
    },

    async updateStatus(order_intent_id, status, lifecyclePatch = {}) {
        const index = loadIndex();
        if (index[order_intent_id]) {
            index[order_intent_id].status = status;
            index[order_intent_id].lifecycle = {
                ...(index[order_intent_id].lifecycle || {}),
                ...lifecyclePatch
            };
            index[order_intent_id].updated_at = new Date().toISOString();
            saveIndex(index);
            return true;
        }
        return false;
    },

    async findAbandoned(cutoffDate) {
        const index = loadIndex();
        return Object.values(index).filter(intent => {
            if (['CANCELLED', 'CONTROL_PLANE_ORDER_CREATED'].includes(intent.status)) return false;
            const createdAt = new Date(intent.created_at);
            // Abandoned: Not paid and older than cutoff
            return intent.payment?.status !== 'PAID' && createdAt < cutoffDate;
        });
    },

    async health() {
        const index = loadIndex();
        const allIntents = Object.values(index);
        const exceptions = allIntents.reduce((acc, oi) => {
            if (oi.exception?.status) {
                acc[oi.exception.status] = (acc[oi.exception.status] || 0) + 1;
            }
            return acc;
        }, {});

        return { 
            ok: true, 
            count: allIntents.length, 
            mode: 'json',
            exceptions 
        };
    }
};
