import { config } from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
import { writeLog } from '../db_operation/create_logs.js';
import { updateMultiKVoperation, getMultiKVoperation } from '../db_operation/multi_db_connection.js';

config();

// 環境変数の読み込み
const MISSKEY_TOKEN = process.env.NOTICE_MISSKEY_TOKEN;
const MISSKEY_URL = process.env.NOTICE_MISSKEY_URL;

/**
 * Misskeyのファイル情報を更新する関数
 * @param {string} fileId - 更新対象のファイルID
 * @param {Object} options - 更新オプション
 * @param {string} [options.name] - ファイル名
 * @param {string} [options.folderId] - フォルダID
 * @param {boolean} [options.isSensitive] - センシティブフラグ
 * @param {string} [options.comment] - コメント
 */
async function updateMisskeyFile(fileId, {
    name = null,
    folderId = null,
    isSensitive = false,
    comment = null
} = {}) {
    try {
        const url = "https://misskey.seitendan.com/api/drive/files/update";
        
        const headers = {
            "Authorization": `Bearer ${MISSKEY_TOKEN}`,
            "Content-Type": "application/json"
        };

        const payload = {
            fileId,
            folderId,
            name,
            isSensitive,
            comment
        };

        // null値のプロパティを削除
        Object.keys(payload).forEach(key => {
            if (payload[key] === null) {
                delete payload[key];
            }
        });

        const response = await axios.post(url, payload, { headers });
        console.debug(`Misskey APIリクエスト成功: ${response.status}`);
        
        const info_message = `ファイル(${fileId})の更新に成功しました`;
        await writeLog('info', 'updateMisskeyFile', info_message, null, null);
        
        // レスポンスからファイルIDを取得して返却
        return response.data.id;

    } catch (error) {
        const error_message = `Misskey APIリクエストでエラーが発生: ${error.message}\nステータスコード: ${error.response?.status || 'N/A'}`;
        await writeLog('error', 'updateMisskeyFile', error_message, null, null);

        if (error.response?.data) {
            const error_details = typeof error.response.data === 'object' 
                ? JSON.stringify(error.response.data, null, 2)
                : error.response.data;
            await writeLog('error', 'updateMisskeyFile', `エラー詳細: ${error_details}`, null, null);
        }

        if (error.code === 'ECONNREFUSED') {
            const error_message = `Misskeyサーバー(${MISSKEY_URL})に接続できません`;
            await writeLog('error', 'updateMisskeyFile', error_message, null, null);
        }
        
        return null;
    }
}

/**
 * Misskeyにファイルをアップロードする関数
 * @param {Buffer} fileData - アップロードするファイルのバッファ
 * @param {string} name - ファイル名
 * @param {string} type - MIMEタイプ
 */
async function uploadMisskeyFile(fileData, name, type) {
    const maxRetries = 10;
    const retryDelay = 30000; // 30秒
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
        try {
            const url = "https://misskey.seitendan.com/api/drive/files/create";
            
            const formData = new FormData();
            formData.append('i', MISSKEY_TOKEN);
            formData.append('file', Buffer.from(fileData), {
                filename: name,
                contentType: type
            });

            const response = await axios.post(url, formData, {
                headers: {
                    ...formData.getHeaders()
                }
            });

            const info_message = `ファイルのアップロードに成功しました: ${name}`;
            await writeLog('info', 'uploadMisskeyFile', info_message, null, null);
            
            return response.data.id;

        } catch (error) {
            // 500エラーの場合でリトライ回数が上限未満なら再試行
            if (error.response && error.response.status === 500 && retryCount < maxRetries) {
                retryCount++;
                const retry_message = `500エラーが発生しました。${retryCount}回目の再試行を${retryDelay/1000}秒後に行います...`;
                await writeLog('warn', 'uploadMisskeyFile', retry_message, null, null);
                
                // 指定時間待機
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            
            // それ以外のエラーまたはリトライ上限に達した場合
            const error_message = `ファイルのアップロードに失敗: ${error.message}${retryCount > 0 ? ` (${retryCount}回再試行後)` : ''}`;
            await writeLog('error', 'uploadMisskeyFile', error_message, null, null);
            return null;
        }
    }
    
    // リトライ上限に達した場合（通常はここには到達しない）
    const max_retry_message = `最大再試行回数(${maxRetries})に達しました。ファイルアップロードを中止します。`;
    await writeLog('error', 'uploadMisskeyFile', max_retry_message, null, null);
    return null;
}

export {
    updateMisskeyFile,
    uploadMisskeyFile
};
