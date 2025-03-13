import { config } from 'dotenv';
import pkg from 'pg';
import { writeLog } from '../db_operation/create_logs.js';
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

async function processGtlNote(note) {
    let client = createDBClient();
    let connected = false;
    
    try {
        await client.connect();
        connected = true;

        const query = `
            INSERT INTO glt_observation (user_name, instance_name, post_text)
            VALUES ($1, $2, $3)
            RETURNING gtl_id
        `;
        
        const values = [
            note.user.name,
            note.user.instance.name,
            note.text
        ];

        const result = await client.query(query, values);
        
        // const success_message = `GTL観測データを保存しました: ID=${result.rows[0].gtl_id}`;
        // await writeLog('info', 'processGtlNote', success_message, null, null);
        return true;

    } catch (error) {
        const error_message = `GTL観測データの保存中にエラーが発生: ${error.message}`;
        await writeLog('error', 'processGtlNote', error_message, null, null);
        return false;
    } finally {
        if (connected) {
            try {
                await client.end();
            } catch (e) {
                const error_message = `DB接続のクローズ中にエラーが発生: ${e.message}`;
                await writeLog('error', 'processGtlNote', error_message, null, null);
            }
        }
    }
}

export { processGtlNote };