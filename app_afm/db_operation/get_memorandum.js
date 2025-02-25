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

async function getMemorandumDinnerText() {
    let client = createDBClient();
    let connected = false;
    
    try {
        await client.connect();
        connected = true;

        const query = 'SELECT value FROM memorandum WHERE key = $1';
        const result = await client.query(query, ['dinner']);

        if (result.rows.length === 0 || !result.rows[0].value) {
            console.error('dinner_textが見つかりません');
            return null;
        }

        const dinnerTexts = result.rows[0].value;
        console.log(dinnerTexts);
        return dinnerTexts;

    } catch (error) {
        console.error(`dinner_text取得中にエラーが発生: ${error.message}`);
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


async function getMultiMemorandum(key) {
    let client = createDBClient();
    let connected = false;
    
    try {
        await client.connect();
        connected = true;

        const query = 'SELECT value FROM memorandum WHERE key = $1';
        const result = await client.query(query, [key]);

        if (result.rows.length === 0 || !result.rows[0].value) {
            console.error('dinner_textが見つかりません');
            return null;
        }

        const dinnerTexts = result.rows[0].value;
        console.log(dinnerTexts);
        return dinnerTexts;

    } catch (error) {
        console.error(`memorandumテーブルのデータ取得中にエラーが発生: ${error.message}`);
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
    getMemorandumDinnerText
};
export {
    getMultiMemorandum
};