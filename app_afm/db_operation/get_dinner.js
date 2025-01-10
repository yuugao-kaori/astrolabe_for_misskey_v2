import { config } from 'dotenv';
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

async function getRandomDinner() {
    let client = createDBClient();
    let connected = false;
    
    try {
        await client.connect();
        connected = true;

        const query = 'SELECT name FROM note_menu ORDER BY RANDOM() LIMIT 1';
        const result = await client.query(query);
        
        if (result.rows.length === 0) {
            console.error('メニューが見つかりません');
            return null;
        }
        
        return result.rows[0].name;
    } catch (error) {
        console.error(`ディナーメニュー取得中にエラーが発生: ${error.message}`);
        return null;
    } finally {
        if (connected) {
            try {
                await client.end();
            } catch (e) {
                console.error(`DB接続のクローズ中にエラーが発生: ${e.message}`);
            }
        }
    }
}

export {
    getRandomDinner
};
