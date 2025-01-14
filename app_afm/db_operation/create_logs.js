import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

config();

// DB接続用のクライアント作成
const createDBClient = () => {
    return new Client({
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: process.env.POSTGRES_PORT,
    });
};

let client = createDBClient();

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
    let connected = false;

    while (retryCount < maxRetries) {
        try {
            client = createDBClient();
            await client.connect();
            connected = true;

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
            //console.log(`ログを作成しました: ID=${result.rows[0].log_id}`);
            return true;

        } catch (error) {
            if (error.code === 'ECONNREFUSED' && retryCount < maxRetries - 1) {
                retryCount++;
                console.error(`データベース接続が拒否されました。リトライ ${retryCount}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                continue;
            }
            
            console.error(`ログの書き込み中にエラーが発生: ${error.message}`);
            return false;

        } finally {
            if (connected) {
                try {
                    await client.end();
                } catch (closeError) {
                    console.error(`DB接続のクローズ中にエラーが発生: ${closeError.message}`);
                }
            }
        }
    }
    
    return false;
}

export {
    writeLog
};
