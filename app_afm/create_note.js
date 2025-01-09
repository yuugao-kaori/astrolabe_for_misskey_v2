import { config } from 'dotenv';
import axios from 'axios';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import pkg from 'pg';
const { Client } = pkg;

const createDBClient = () => {
    return new Client({
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: process.env.POSTGRES_PORT,
    });
};

let client = createDBClient();

async function checkDBConnection() {
    const testClient = createDBClient();
    try {
        await testClient.connect();
        await testClient.query('SELECT NOW()');
        logger.info('データベース接続テスト成功');
        return true;
    } catch (error) {
        logger.error(`データベース接続テスト失敗: ${error.message}`);
        if (error.code === 'ECONNREFUSED') {
            logger.error(`データベースサーバー(${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT})に接続できません`);
            logger.error('データベースサーバーが起動しているか確認してください');
        }
        return false;
    } finally {
        try {
            await testClient.end();
        } catch (e) {
            // 接続が既に切れている場合のエラーは無視
        }
    }
}

import express from 'express';
const __dirname = dirname(fileURLToPath(import.meta.url));

config();

// 環境変数の読み込み
const MISSKEY_TOKEN = process.env.NOTICE_MISSKEY_TOKEN;
const MISSKEY_URL = process.env.NOTICE_MISSKEY_URL;
const TARGET_USER_ID = process.env.NOTICE_MISSKEY_TARGET_USER_ID;

// ロガーの設定
const logger = {
    info: (message) => console.log(`INFO: ${message}`),
    error: (message) => console.error(`ERROR: ${message}`)
};

/**
 * Misskeyにノートを投稿する関数
 */
async function createMisskeyNote(token, {
    text = "none_text",
    visibility = "public",
    fileIds = null,
    mediaIds = null,
    poll = null,
    cw = null,
    localOnly = false,
    visibleUserIds = null
} = {}) {
    const url = "https://misskey.seitendan.com/api/notes/create";
    
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
    
    const payload = {
        visibility,
        visibleUserIds: visibleUserIds || [],
        cw,
        localOnly,
        reactionAcceptance: null,
        noExtractMentions: false,
        noExtractHashtags: false,
        noExtractEmojis: false,
        replyId: null,
        renoteId: null,
        channelId: null,
        text,
    };
    
    if (fileIds?.length) payload.fileIds = fileIds;
    if (mediaIds?.length) payload.mediaIds = mediaIds;
    if (poll) payload.poll = poll;
    
    try {
        

        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        logger.error(`Misskey APIリクエストでエラーが発生: ${error.message}`);
        logger.error(`ステータスコード: ${error.response?.status || 'N/A'}`);
        logger.error(`レスポンス: ${error.response?.data || 'N/A'}`);
        return null;
    }
}

/**
 * プロテクションカウンターをインクリメントする関数
 */
async function incrementHeatCounter() {
    let retryCount = 0;
    const maxRetries = 3;
    let connected = false;

    while (retryCount < maxRetries) {
        try {
            // 新しいクライアントを作成
            client = createDBClient();
            await client.connect();
            connected = true;

            await client.query('BEGIN');

            const selectQuery = 'SELECT value FROM protection WHERE key = $1';
            const selectResult = await client.query(selectQuery, ['heat']);
            
            if (selectResult.rows.length === 0) {
                // レコードが存在しない場合は新規作成
                const insertQuery = 'INSERT INTO protection (key, value) VALUES ($1, $2) RETURNING value';
                const insertResult = await client.query(insertQuery, ['heat', 1]);
                await client.query('COMMIT');
                console.log('1回目の投稿です');
                return insertResult.rows[0].value;
            }

        
            const currentValue = parseInt(selectResult.rows[0].value) || 0;
            const newValue = currentValue + 1;

            const updateQuery = 'UPDATE protection SET value = $1 WHERE key = $2 RETURNING value';
            const updateResult = await client.query(updateQuery, [newValue, 'heat']);
            
            await client.query('COMMIT');
            console.log(`${newValue}回目の投稿です`);
            return updateResult.rows[0].value;

        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            
            if (error.code === 'ECONNREFUSED') {
                retryCount++;
                logger.error(`データベース接続が拒否されました。リトライ ${retryCount}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                continue;
            }

            logger.error(`プロテクションカウンターのインクリメント中にエラーが発生: ${error.message}`);
            logger.error(`詳細: ${error.stack}`);
            return null;
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
    
    if (retryCount >= maxRetries) {
        logger.error('最大リトライ回数に達しました。DB操作を中止します。');
        return null;
    }
}

async function getMaxHeat() {
    let connected = false;
    try {
        client = createDBClient();
        await client.connect();
        connected = true;

        const query = 'SELECT value FROM settings WHERE key = $1';
        const result = await client.query(query, ['max_heat']);
        
        if (result.rows.length === 0) {
            logger.info('max_heat設定が見つかりません');
            return null;
        }
        
        return parseInt(result.rows[0].value) || null;
    } catch (error) {
        logger.error(`max_heat取得中にエラーが発生: ${error.message}`);
        return null;
    } finally {
        if (connected) {
            try {
                await client.end();
            } catch (e) {
                logger.error(`DB接続のクローズ中にエラーが発生: ${e.message}`);
            }
        }
    }
}

async function createNote(text) {
    const currentHeat = await incrementHeatCounter();
    const maxHeat = await getMaxHeat();
    
    if (maxHeat !== null && currentHeat > maxHeat) {
        logger.error(`投稿回数が制限(${maxHeat}回)を超えました`);
        return null;
    }
    
    const result = await createMisskeyNote(MISSKEY_TOKEN, {
        text
    });
    
    if (result) {
        logger.info("投稿に成功しました");
    } else {
        logger.error("投稿に失敗しました");
    }
    return result;
}

async function sendDM(text) {
    const currentHeat = await incrementHeatCounter();
    const maxHeat = await getMaxHeat();
    
    if (maxHeat !== null && currentHeat > maxHeat) {
        logger.error(`投稿回数が制限(${maxHeat}回)を超えました`);
        return null;
    }

    const result = await createMisskeyNote(MISSKEY_TOKEN, {
        text,
        visibility: "specified",
        visibleUserIds: [TARGET_USER_ID]
    });
    
    if (!result) {
        logger.error("DMの送信に失敗しました");
    }
    return result;
}

// アプリケーション起動時にDB接続テストを実行
checkDBConnection().then(success => {
    if (!success) {
        logger.error('データベース接続テストに失敗しました。設定を確認してください。');
    }
});

// エクスポート
export {
    createMisskeyNote,
    sendDM,
    createNote
};
