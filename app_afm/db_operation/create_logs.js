import { config } from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

config();

// DB接続用のプール作成
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    connectionTimeoutMillis: 5000,  // 接続タイムアウト: 5秒
    idleTimeoutMillis: 30000,       // アイドルタイムアウト: 30秒
    max: 20,                        // 最大プール数
    keepAlive: true                 // コネクションを維持
});

/**
 * データベースにログを書き込む関数
 * @param {string} level - ログレベル (INFO, WARNING, ERROR, DEBUG)
 * @param {string} source - ログのソース（アプリケーション名やモジュール名）
 * @param {string} message - ログメッセージ
 * @param {string} [userId] - 関連するユーザーID (オプション)
 * @param {object} [metadata] - 追加のメタデータ (オプション)
 * @returns {Promise<boolean>} - 書き込み成功時はtrue、失敗時はfalse
 */
async function writeLog(level, source, message, userId = null, metadata = null) {
    let retryCount = 0;
    const maxRetries = 3;
    let client;

    while (retryCount < maxRetries) {
        try {
            client = await pool.connect();
            await client.query('BEGIN');
            const query = `
                INSERT INTO logs (level, source, message, user_id, metadata)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING log_id
            `;
            const values = [
                level,
                source,
                message,
                userId,
                metadata ? JSON.stringify(metadata) : null
            ];
            const result = await client.query(query, values);
            await client.query('COMMIT');
            console.log(`ログを作成しました: ID=${result.rows[0].log_id}`);
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            if (error.message === 'Connection terminated' && retryCount < maxRetries - 1) {
                retryCount++;
                console.error(`接続が切断されました。リトライ ${retryCount}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                continue;
            }
            console.error(`ログの書き込み中にエラーが発生:`, {
                message: error.message,
                code: error.code,
                detail: error.detail,
                stack: error.stack
            });
            return false;
        } finally {
            if (client) {
                client.release();
            }
        }
    }
    return false;
}

export {
    writeLog
};
