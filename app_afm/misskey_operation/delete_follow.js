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


async function deleteMisskeyFollow(userId) {
    const url = "https://misskey.seitendan.com/api/following/delete";
    
    const headers = {
        "Authorization": `Bearer ${MISSKEY_TOKEN}`,
        "Content-Type": "application/json"
    };
    
    const payload = {
        userId,
    };
    
    // 最大リトライ回数
    const maxRetries = 10;
    // リトライ間隔（ミリ秒）
    const retryDelay = 30000; // 30秒
    let retryCount = 0;
    
    while (true) {
        try {
            const response = await axios.post(url, payload, { headers });
            console.debug(`Misskey APIリクエスト成功: ${response.status}]\nフォロー解除対象ID: ${userId}`);
                    
            return response.data;
        } catch (error) {
            const statusCode = error.response?.status || 'N/A';
            const error_message = `Misskey APIリクエストでエラーが発生: ${error.message}\nステータスコード: ${statusCode}`;
            await writeLog('error', 'deleteMisskeyFollow', error_message, null, null);
            
            // 500エラーの場合でリトライ回数が上限に達していない場合はリトライ
            if (statusCode === 500 && retryCount < maxRetries) {
                retryCount++;
                await writeLog('warning', 'deleteMisskeyFollow', `500エラーが発生しました。${retryCount}回目のリトライを${retryDelay}ミリ秒後に行います。`, null, null);
                
                // 指定時間待機
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue; // ループの先頭に戻り、再試行
            }
            
            // エラーレスポンスのJSONをより詳細に解析
            if (error.response?.data) {
                if (typeof error.response.data === 'object') {
                    const error_message = `エラー詳細:${JSON.stringify(error.response.data, null, 2)}`;
                    await writeLog('error', 'deleteMisskeyFollow', error_message, null, null);
                } else {
                    const error_message = `レスポンス: ${error.response.data}`;
                    await writeLog('error', 'deleteMisskeyFollow', error_message, null, null);
                }
            }

            // エラーの種類に応じた追加情報
            if (error.code === 'ECONNREFUSED') {
                const error_message = `Misskeyサーバー(${MISSKEY_URL})に接続できません`;
                await writeLog('error', 'deleteMisskeyFollow', error_message, null, null);
            }
            
            // すべてのリトライに失敗した場合や500以外のエラーの場合
            if (statusCode === 500 && retryCount >= maxRetries) {
                await writeLog('error', 'deleteMisskeyFollow', `500エラーでの最大リトライ回数(${maxRetries}回)に達しました。`, null, null);
            }
            
            return null;
        }
    }
}

// エクスポート
export {
    deleteMisskeyFollow,
};
