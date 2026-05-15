const axios = require('axios');

async function testMalformedRegistration() {
    try {
        const res = await axios.post('http://localhost:3001/api/auth/register', {
            email: 'not-an-email',
            password: 'p',
            role: 'INVALID_ROLE'
        });
        console.log('Success:', res.data);
    } catch (err) {
        console.log('Error:', err.response?.status, err.response?.data);
    }
}

testMalformedRegistration();
