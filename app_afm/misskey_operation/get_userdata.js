import { config } from 'dotenv';
import axios from 'axios';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeLog } from '../db_operation/create_logs.js';
import { updateMultiKVoperation, getMultiKVoperation } from '../db_operation/multi_db_connection.js';


// 環境変数の読み込み
const MISSKEY_TOKEN = process.env.NOTICE_MISSKEY_TOKEN;
const MISSKEY_URL = process.env.NOTICE_MISSKEY_URL;
const BOT_USER_ID = process.env.NOTICE_MISSKEY_BOT_USER_ID;
/**
 * ユーザーのフォロワー一覧を取得する関数
 * @param {string} userId - フォロワーを取得したいユーザーのID
 * @param {number} [batchSize=100] - 1回のリクエストで取得するフォロワー数
 * @returns {Promise<Array<{id: string, username: string, name: string, host: string|null}>>} フォロワー情報の配列
 */
async function getAllFollowers(userId, batchSize = 100) {
    try {
        const url = `${MISSKEY_URL}/api/users/followers`;
        const headers = {
            "Authorization": `Bearer ${MISSKEY_TOKEN}`,
            "Content-Type": "application/json"
        };

        let allFollowers = [];
        let lastId = null;
        
        while (true) {
            const payload = {
                limit: batchSize,
                userId: userId,
                ...(lastId && { untilId: lastId })
            };

            const response = await axios.post(url, payload, { headers });
            // console.log(response.data);
            // console.log(`フォロワーのID: ${response.data.id}`);
            const followers = response.data;

            if (!followers || followers.length === 0) break;

            // 必要な情報のみを抽出（followerオブジェクトから取得するように修正）
            const extractedFollowers = followers.map(followerData => ({
                id: followerData.follower.id,
                username: followerData.follower.username,
                name: followerData.follower.name,
                host: followerData.follower.host
            }));

            allFollowers = allFollowers.concat(extractedFollowers);
            lastId = followers[followers.length - 1].id;

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const info_message = `${allFollowers.length}件のフォロワー情報を取得しました`;
        await writeLog('info', 'getAllFollowers', info_message, null, null);
        
        // 取得したデータの例をログに記録
        if (allFollowers.length > 0) {
            const sample_message = `データサンプル: ${JSON.stringify(allFollowers[0])}`;
            await writeLog('info', 'getAllFollowers', sample_message, null, null);
        }

        return allFollowers;

    } catch (error) {
        const error_message = `フォロワー取得中にエラーが発生: ${error.message}`;
        await writeLog('error', 'getAllFollowers', error_message, null, null);
        throw error;
    }
}

/**
 * ユーザーのフォロー一覧を取得する関数
 * @param {string} userId - フォローを取得したいユーザーのID
 * @param {number} [batchSize=100] - 1回のリクエストで取得するフォロー数
 * @returns {Promise<Array<{id: string, username: string, name: string, host: string|null}>>} フォロー情報の配列
 */
async function getAllFollowings(userId, batchSize = 100) {
    try {
        const url = `${MISSKEY_URL}/api/users/following`;
        const headers = {
            "Authorization": `Bearer ${MISSKEY_TOKEN}`,
            "Content-Type": "application/json"
        };

        let allFollowers = [];
        let lastId = null;
        
        while (true) {
            const payload = {
                limit: batchSize,
                userId: userId,
                ...(lastId && { untilId: lastId })
            };

            let retryCount = 0;
            const maxRetries = 10;
            const retryDelay = 30000; // 30秒
            let response;
            
            while (true) {
                try {
                    response = await axios.post(url, payload, { headers });
                    break; // 成功したらループを抜ける
                } catch (requestError) {
                    // 500エラーの場合、かつ最大再試行回数に達していない場合
                    if (requestError.response && requestError.response.status === 500 && retryCount < maxRetries) {
                        retryCount++;
                        const retryMessage = `フォローユーザ取得中に500エラーが発生しました。${retryCount}回目の再試行を${retryDelay/1000}秒後に行います。`;
                        await writeLog('warn', 'getAllFollowings', retryMessage, null, null);
                        console.log(retryMessage);
                        
                        // 指定時間待機
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                    // 500エラー以外またはリトライ回数超過の場合はエラーを投げる
                    throw requestError;
                }
            }

            // console.log(response.data);
            // console.log(`フォロワーのID: ${response.data.id}`);
            const followers = response.data;

            if (!followers || followers.length === 0) break;

            // 必要な情報のみを抽出（followerオブジェクトから取得するように修正）
            const extractedFollowers = followers.map(followerData => ({
                id: followerData.followee.id,
                username: followerData.followee.username,
                name: followerData.followee.name,
                host: followerData.followee.host
            }));

            allFollowers = allFollowers.concat(extractedFollowers);
            lastId = followers[followers.length - 1].id;

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const info_message = `${allFollowers.length}件のフォロワー情報を取得しました`;
        await writeLog('info', 'getAllFollowings', info_message, null, null);
        
        // 取得したデータの例をログに記録
        if (allFollowers.length > 0) {
            const sample_message = `データサンプル: ${JSON.stringify(allFollowers[0])}`;
            await writeLog('info', 'getAllFollowings', sample_message, null, null);
        }

        return allFollowers;

    } catch (error) {
        const error_message = `フォロー中ユーザ取得中にエラーが発生: ${error.message}`;
        await writeLog('error', 'getAllFollowings', error_message, null, null);
        throw error;
    }
}


// テスト用の手動実行関数
async function testGetFollowers() {
    try {
        if (!process.env.NOTICE_MISSKEY_TOKEN || !process.env.NOTICE_MISSKEY_URL) {
            console.error('環境変数が設定されていません');
            return;
        }

        // console.log('フォロワーとフォロー取得テストを開始します...');
        const testUserId = process.env.NOTICE_MISSKEY_BOT_USER_ID;
        
        // フォロワーのテスト
        const followers = await getAllFollowers(testUserId);
        console.log(`取得したフォロワー数: ${followers.length}`);
        console.log('最初の3件のフォロワー情報:');
        followers.slice(0, 3).forEach(follower => {
            console.log(`- ID: ${follower.id}`);
        });

        // フォローのテスト
        const followings = await getAllFollowings(testUserId);
        console.log(`取得したフォロー数: ${followings.length}`);
        console.log('最初の3件のフォロー情報:');
        followings.slice(0, 3).forEach(following => {
            console.log(`- ID: ${following.id}`);
        });

    } catch (error) {
        console.error('テスト実行中にエラーが発生:', error.message);
    }
}

// コマンドライン引数でテストを実行
if (process.argv[2] === 'test') {
    console.log('テストモードで実行中...');
    testGetFollowers();
}

export {
    getAllFollowers,
    getAllFollowings
};


