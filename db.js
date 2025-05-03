require('dotenv').config();
const mysql = require('mysql');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: process.env.DB_CHARSET,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
});
// プールを使ったクエリ関数の作成
const queryDatabase = (query, params) => {
    return new Promise((resolve, reject) => {
        pool.query(query, params, (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });
};
module.exports = {
    pool,
    queryDatabase
};