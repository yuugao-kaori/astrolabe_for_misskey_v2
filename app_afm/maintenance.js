import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

config();

// ロガーの設定
const logger = {
    info: (message) => console.log(`INFO: ${message}`),
    error: (message) => console.error(`ERROR: ${message}`)
};

const createDBClient = () => {
    return new Client({
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: process.env.POSTGRES_PORT,
    });
};

async function resetHeatCounter() {
    let client = createDBClient();
    let connected = false;

    try {
        await client.connect();
        connected = true;

        await client.query('BEGIN');
        const updateQuery = 'UPDATE protection SET value = $1 WHERE key = $2 RETURNING value';
        const result = await client.query(updateQuery, [0, 'heat']);
        
        if (result.rowCount === 0) {
            // レコードが存在しない場合は新規作成
            const insertQuery = 'INSERT INTO protection (key, value) VALUES ($1, $2)';
            await client.query(insertQuery, ['heat', 0]);
        }
        
        await client.query('COMMIT');
        logger.info('heatカウンターを0にリセットしました');
        return true;

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        logger.error(`heatカウンターのリセット中にエラーが発生: ${error.message}`);
        return false;

    } finally {
        if (connected) {
            try {
                await client.end();
            } catch (closeError) {
                logger.error(`DB接続のクローズ中にエラーが発生: ${closeError.message}`);
            }
        }
    }
}

// メンテナンス関数のエクスポート
export { resetHeatCounter };

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
    resetHeatCounter().then(success => {
        if (success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    });
}
