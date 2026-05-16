const fs = require('fs');
const path = require('path');

const OFFER_SESSIONS_DIR = path.join(__dirname, '../../../storage/offer-sessions');
const OFFER_SESSIONS_INDEX = path.join(OFFER_SESSIONS_DIR, 'index.json');

// Ensure directory exists
if (!fs.existsSync(OFFER_SESSIONS_DIR)) {
    fs.mkdirSync(OFFER_SESSIONS_DIR, { recursive: true });
}

const loadIndex = () => {
    try {
        if (!fs.existsSync(OFFER_SESSIONS_INDEX)) return {};
        const data = fs.readFileSync(OFFER_SESSIONS_INDEX, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`[OFFER_SESSION_INDEX_READ_FAILED] ${err.message}`);
        return {};
    }
};

const saveIndex = (index) => {
    try {
        const tempPath = `${OFFER_SESSIONS_INDEX}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(index, null, 2));
        fs.renameSync(tempPath, OFFER_SESSIONS_INDEX);
        return true;
    } catch (err) {
        console.error(`[OFFER_SESSION_INDEX_WRITE_FAILED] ${err.message}`);
        return false;
    }
};

module.exports = {
    async create(record) {
        const index = loadIndex();
        index[record.offer_session_id] = {
            ...record,
            created_at: record.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        saveIndex(index);
        console.log(`[JSON_REPO][OFFER_SESSION_CREATED] id=${record.offer_session_id}`);
        return index[record.offer_session_id];
    },

    async getById(offer_session_id) {
        const index = loadIndex();
        return index[offer_session_id];
    },

    async getOffer(offer_session_id, offer_id) {
        const session = await this.getById(offer_session_id);
        if (!session) return null;
        return session.offers?.find(o => o.offer_id === offer_id) || null;
    },

    async markSelectedOffer(offer_session_id, offer_id) {
        const index = loadIndex();
        if (index[offer_session_id]) {
            index[offer_session_id].selected_offer_id = offer_id;
            index[offer_session_id].updated_at = new Date().toISOString();
            saveIndex(index);
            return true;
        }
        return false;
    },

    async listExpired(cutoffDate) {
        const index = loadIndex();
        return Object.values(index).filter(session => {
            const expiresAt = new Date(session.expires_at);
            return expiresAt < cutoffDate;
        });
    },

    async health() {
        return { ok: true, count: Object.keys(loadIndex()).length, mode: 'json' };
    }
};
