require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function seedDemoAccount() {
    const email = process.env.DEMO_ACCOUNT_EMAIL || 'demo-printhouse@printprice.pro';
    const password = process.env.DEMO_ACCOUNT_PASSWORD;

    if (!password) {
        console.warn('[DEMO_ACCOUNT_SEED_SKIPPED] DEMO_ACCOUNT_PASSWORD is required');
        return;
    }

    // Budget app uses the Control Plane for identity
    const CONTROL_PLANE_BASE_URL = process.env.CONTROL_PLANE_BASE_URL || process.env.CONTROL_PLANE_URL || "http://127.0.0.1:8081";
    const IDENTITY_API_URL = process.env.CONTROL_PLANE_AUTH_URL || process.env.IDENTITY_API_URL || CONTROL_PLANE_BASE_URL;
    const authRegisterUrl = `${IDENTITY_API_URL}/api/auth/register`;

    const BPE_JWT_SECRET = process.env.BPE_JWT_SECRET;
    const BPE_JWT_ISSUER = process.env.BPE_JWT_ISSUER || 'https://auth.printprice.pro';
    const BPE_JWT_AUDIENCE = process.env.BPE_JWT_AUDIENCE || 'ppos:control';
    const BPE_SYSTEM_USER_ID = process.env.PPOS_BPE_SYSTEM_USER_ID || 'bpe-system-user';

    let headers = { "Content-Type": "application/json", "x-source-app": "PrintPricePro_BookPrice" };

    if (BPE_JWT_SECRET) {
        const token = jwt.sign(
            { sub: BPE_SYSTEM_USER_ID },
            BPE_JWT_SECRET,
            { issuer: BPE_JWT_ISSUER, audience: BPE_JWT_AUDIENCE, expiresIn: 60 }
        );
        headers["Authorization"] = `Bearer ${token}`;
    } else {
        console.warn('[SECURITY_WARNING] BPE_JWT_SECRET missing for identity proxy headers.');
    }

    try {
        console.log(`[SEED] Attempting to seed demo account ${email} via Control Plane...`);
        const response = await axios.post(authRegisterUrl, {
            email,
            password,
            role: 'PRINTHOUSE'
        }, {
            headers,
            timeout: 10000,
        });

        console.log(`[SEED_SUCCESS] Demo account ${email} seeded successfully.`, response.data);
    } catch (err) {
        if (err.response && err.response.status === 409) {
            console.log(`[SEED_SKIPPED] Demo account ${email} already exists.`);
        } else {
            console.error('[SEED_ERROR] Failed to seed demo account:', err.response?.data || err.message);
        }
    }
}

seedDemoAccount();
