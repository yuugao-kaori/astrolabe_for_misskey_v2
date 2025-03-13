import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;
import { writeLog } from './create_logs.js';

config();

const createDBClient = () => {
    return new Client({
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: process.env.POSTGRES_PORT,
    });
};

async function deleteOldLogs() {
    let client = createDBClient();
    let connected = false;

    try {
        await client.connect();
        connected = true;

        // 削除対象のレコード数を先に取得
        const countQuery = `
            SELECT COUNT(*) 
            FROM logs 
            WHERE created_at < NOW() - INTERVAL '7 days'
        `;
        const countResult = await client.query(countQuery);
        const deletedCount = parseInt(countResult.rows[0].count);

        // 古いログを削除
        const deleteQuery = `
            DELETE FROM logs 
            WHERE created_at < NOW() - INTERVAL '7 days'
        `;
        await client.query(deleteQuery);
        
        await writeLog('info', 'deleteOldLogs', `${deletedCount}件の古いログを削除しました`, null, null);
        return true;

    } catch (error) {
        await writeLog('error', 'deleteOldLogs', `古いログの削除中にエラーが発生: ${error.message}`, null, null);
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

export { deleteOldLogs };
