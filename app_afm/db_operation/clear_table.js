import { config } from 'dotenv';
import pkg from 'pg';
import { writeLog } from './create_logs.js';
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

/**
 * glt_observationテーブルをクリアする関数
 * @returns {Promise<boolean>} - クリア成功時はtrue、失敗時はfalse
 */
async function clearGLTObservation() {
    let client = createDBClient();
    let retryCount = 0;
    const maxRetries = 3;
    let connected = false;

    while (retryCount < maxRetries) {
        try {
            await client.connect();
            connected = true;

            const query = 'TRUNCATE TABLE glt_observation';
            await client.query(query);
            await writeLog('info', 'clearGLTObservation', 'glt_observationテーブルをクリアしました', null, null);
            return true;

        } catch (error) {
            if (error.code === 'ECONNREFUSED' && retryCount < maxRetries - 1) {
                retryCount++;
                const retry_message = `データベース接続が拒否されました。リトライ ${retryCount}/${maxRetries}`;
                await writeLog('warning', 'clearGLTObservation', retry_message, null, null);
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                continue;
            }
            
            const error_message = `テーブルのクリア中にエラーが発生: ${error.message}`;
            await writeLog('error', 'clearGLTObservation', error_message, null, null);
            return false;

        } finally {
            if (connected) {
                try {
                    await client.end();
                } catch (closeError) {
                    const close_error_message = `DB接続のクローズ中にエラーが発生: ${closeError.message}`;
                    await writeLog('error', 'clearGLTObservation', close_error_message, null, null);
                }
            }
        }
    }
    
    return false;
}

export {
    clearGLTObservation
};
