import { config } from 'dotenv';
import { writeLog } from './create_logs.js';
import pkg from 'pg';
const { Client } = pkg;

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

// テーブル名のホワイトリストを追加
const ALLOWED_TABLES = ['protection', 'settings', 'memorandum', 'glt_observation', 'note_text'];

async function updateMultiKVoperation(table, value, key) {
    if (!ALLOWED_TABLES.includes(table)) {
        const error_message = `無効なテーブル名: ${table}`;
        await writeLog('error', 'updateMultiKVoperation', error_message, null, null);
        return false;
    }

    let client = createDBClient();
    let connected = false;
    
    try {
        await client.connect();
        connected = true;

        const query = `UPDATE ${table} SET value = $1 WHERE key = $2`;
        const result = await client.query(query, [value, key]);
        
        if (result.rowCount === 0) {
            const error_message = `${table}の${key}が見つかりません`;
            await writeLog('error', 'updateMultiKVoperation', error_message, null, null);
            return false;
        }
        const success_message = `${table}の${key}を${value}に更新しました`;
        await writeLog('info', 'updateMultiKVoperation', success_message, null, null);
        return true;

    } catch (error) {
        const error_message = `${table}の更新中にエラーが発生: ${error.message}`;
        await writeLog('error', 'updateMultiKVoperation', error_message, null, null);
        return false;
    } finally {
        if (connected) {
            try {
                await client.end();
            } catch (e) {
                const error_message = `DB接続のクローズ中にエラーが発生: ${e.message}`;
                await writeLog('error', 'updateMultiKVoperation', error_message, null, null);
            }
        }
    }
}

async function getMultiKVoperation(table, key) {
    if (!ALLOWED_TABLES.includes(table)) {
        const error_message = `無効なテーブル名: ${table}`;
        await writeLog('error', 'getMultiKVoperation', error_message, null, null);
        return false;
    }

    let client = createDBClient();
    let connected = false;
    
    try {
        await client.connect();
        connected = true;

        const query = `SELECT value FROM ${table} WHERE key = $1`;
        const result = await client.query(query, [key]);
        
        if (result.rowCount === 0) {
            const error_message = `${table}の${key}が見つかりません`;
            await writeLog('error', 'getMultiKVoperation', error_message, null, null);
            return null;
        }
        return result.rows[0].value;

    } catch (error) {
        const error_message = `${table}の取得中にエラーが発生: ${error.message}`;
        await writeLog('error', 'getMultiKVoperation', error_message, null, null);
        return null;
    } finally {
        if (connected) {
            try {
                await client.end();
            } catch (e) {
                const error_message = `DB接続のクローズ中にエラーが発生: ${e.message}`;
                await writeLog('error', 'getMultiKVoperation', error_message, null, null);
                
            }
        }
    }
}


export {
    updateMultiKVoperation,
    getMultiKVoperation
};
