const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, '../../../../storage/notification-events');
const INDEX_FILE = path.join(STORAGE_PATH, 'index.json');

function ensureDir() {
    if (!fs.existsSync(STORAGE_PATH)) {
        fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }
    if (!fs.existsSync(INDEX_FILE)) {
        fs.writeFileSync(INDEX_FILE, JSON.stringify({}, null, 2));
    }
}

function loadIndex() {
    ensureDir();
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
}

function saveIndex(index) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

module.exports = {
    async create(event) {
        const index = loadIndex();
        index[event.notification_id] = {
            ...event,
            created_at: event.created_at || new Date().toISOString()
        };
        saveIndex(index);
        console.log(`[JSON_REPO][NOTIFICATION_CREATED] id=${event.notification_id} event=${event.event_type}`);
        return event;
    },

    async updateStatus(notification_id, status, patch = {}) {
        const index = loadIndex();
        if (index[notification_id]) {
            index[notification_id].status = status;
            if (status === 'SENT') {
                index[notification_id].sent_at = new Date().toISOString();
            }
            if (patch.error) {
                index[notification_id].error = patch.error;
            }
            saveIndex(index);
            return true;
        }
        return false;
    },

    async getById(notification_id) {
        const index = loadIndex();
        return index[notification_id] || null;
    },

    async findDuplicate(order_intent_id, event_type) {
        const index = loadIndex();
        const list = Object.values(index);
        return list.find(e => 
            e.order_intent_id === order_intent_id && 
            e.event_type === event_type && 
            ['SENT', 'PENDING'].includes(e.status)
        ) || null;
    },

    async listByOrderIntent(order_intent_id) {
        const index = loadIndex();
        return Object.values(index)
            .filter(e => e.order_intent_id === order_intent_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },

    async health() {
        const index = loadIndex();
        const list = Object.values(index);
        const byStatus = {};
        list.forEach(e => {
            byStatus[e.status] = (byStatus[e.status] || 0) + 1;
        });
        return {
            total: list.length,
            by_status: byStatus
        };
    }
};
