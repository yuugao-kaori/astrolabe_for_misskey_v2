import { config } from 'dotenv';
import axios from 'axios';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeLog } from '../db_operation/create_logs.js';
import { updateMultiKVoperation, getMultiKVoperation } from '../db_operation/multi_db_connection.js';
config();

// 環境変数の読み込み
const MISSKEY_TOKEN = process.env.NOTICE_MISSKEY_TOKEN;
const MISSKEY_URL = process.env.NOTICE_MISSKEY_URL;
const TARGET_USER_ID = process.env.NOTICE_MISSKEY_TARGET_USER_ID;


async function createMisskeyFollow(userId) {
    const url = "https://misskey.seitendan.com/api/following/create";
    
    const headers = {
        "Authorization": `Bearer ${MISSKEY_TOKEN}`,
        "Content-Type": "application/json"
    };
    
    const payload = {
        userId,
    };
    
    try {
        

        const response = await axios.post(url, payload, { headers });
        console.debug(`Misskey APIリクエスト成功: ${response.status}\nフォロー対象ID: ${userId}`);
                
        return response.data;
    } catch (error) {
        const error_message = `Misskey APIリクエストでエラーが発生: ${error.message}\nステータスコード: ${error.response?.status || 'N/A'}`;
        await writeLog('error', 'createMisskeyFollow', error_message, null, null);
        // エラーレスポンスのJSONをより詳細に解析
        if (error.response?.data) {
            if (typeof error.response.data === 'object') {
                const error_message = `エラー詳細:${JSON.stringify(error.response.data, null, 2)}`;
                await writeLog('error', 'createMisskeyFollow', error_message, null, null);
            } else {
                const error_message = `レスポンス: ${error.response.data}`;
                await writeLog('error', 'createMisskeyFollow', error_message, null, null);
            }
        }

        // エラーの種類に応じた追加情報
        if (error.code === 'ECONNREFUSED') {
            const error_message = `Misskeyサーバー(${MISSKEY_URL})に接続できません`;
            await writeLog('error', 'createMisskeyFollow', error_message, null, null);
        }
        
        return null;
    }
}

// エクスポート
export {
    createMisskeyFollow,
};
