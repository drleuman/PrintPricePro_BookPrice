const mysql = require('mysql2/promise');

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = process.env.MYSQL_PORT || 3306;
const MYSQL_USER = process.env.MYSQL_USER;
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;
const MYSQL_DATABASE = process.env.MYSQL_DATABASE;

let pool = null;

function getPool() {
    if (!pool) {
        if (!MYSQL_USER || !MYSQL_DATABASE) {
            console.error('[MYSQL_CONFIG_ERROR] MYSQL_USER and MYSQL_DATABASE are required for MySQL persistence.');
            return null;
        }
        
        pool = mysql.createPool({
            host: MYSQL_HOST,
            port: MYSQL_PORT,
            user: MYSQL_USER,
            password: MYSQL_PASSWORD,
            database: MYSQL_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
        
        console.log(`[MYSQL_POOL_CREATED] host=${MYSQL_HOST}:${MYSQL_PORT} db=${MYSQL_DATABASE}`);
    }
    return pool;
}

async function query(sql, params) {
    const p = getPool();
    if (!p) throw new Error('MYSQL_NOT_CONFIGURED');
    const [rows] = await p.execute(sql, params);
    return rows;
}

async function transaction(callback) {
    const p = getPool();
    if (!p) throw new Error('MYSQL_NOT_CONFIGURED');
    const connection = await p.getConnection();
    await connection.beginTransaction();
    try {
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function testConnection() {
    const p = getPool();
    if (!p) return false;
    try {
        const connection = await p.getConnection();
        console.log('[MYSQL_CONNECTION_OK]');
        connection.release();
        return true;
    } catch (err) {
        console.error(`[MYSQL_CONNECTION_FAILED] ${err.message}`);
        throw err;
    }
}

module.exports = {
    getPool,
    query,
    transaction,
    testConnection
};
