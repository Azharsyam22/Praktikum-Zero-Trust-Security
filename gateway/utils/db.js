const mysql = require('mysql2');
const config = require('../config');

// Create connection pool
const pool = mysql.createPool({
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.name,
    port: config.database.port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Get promise-based pool
const promisePool = pool.promise();

// Helper untuk query yang mengembalikan single row
async function get(query, params = []) {
    const [rows] = await promisePool.query(query, params);
    return rows[0];
}

// Helper untuk query yang mengembalikan multiple rows
async function all(query, params = []) {
    const [rows] = await promisePool.query(query, params);
    return rows;
}

// Helper untuk INSERT/UPDATE/DELETE
async function run(query, params = []) {
    const [result] = await promisePool.query(query, params);
    return result;
}

// Helper untuk prepared statement
function prepare(query) {
    return {
        get: async (...params) => {
            const [rows] = await promisePool.query(query, params);
            return rows[0];
        },
        all: async (...params) => {
            const [rows] = await promisePool.query(query, params);
            return rows;
        },
        run: async (...params) => {
            const [result] = await promisePool.query(query, params);
            return result;
        }
    };
}

module.exports = {
    pool,
    promisePool,
    get,
    all,
    run,
    prepare
};
