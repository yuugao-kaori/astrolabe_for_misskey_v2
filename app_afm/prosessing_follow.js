import { sendReply } from './misskey_operation/create_note.js';
import { writeLog } from './db_operation/create_logs.js';
import { updateMultiKVoperation, getMultiKVoperation } from './db_operation/multi_db_connection.js';
import { config } from 'dotenv';
import { askChatGPT } from './webpage_operation/connect_chatgpt.js';
import { createMisskeyFollow } from './misskey_operation/create_follow.js';
import { deleteMisskeyFollow } from './misskey_operation/delete_follow.js';
import { getAllFollowers, getAllFollowings } from './misskey_operation/get_userdata.js';

config();

const TARGET_USER_ID = process.env.NOTICE_MISSKEY_BOT_USER_ID;

async function processFollow(notice) {
    console.log(notice);
    try{
        console.log('フォロー処理開始');
        console.log(notice.id);
        await createMisskeyFollow(notice.id);  // パラメータとしてIDを直接渡す
        const info_message = `フォローを実施しました\nID：${notice.id}\nサーバ：${notice.host}\n名前：${notice.username}\n`
        await writeLog('info', 'processFollow', info_message, null, null);
    }
    catch (error) {
        const error_message = `フォロー中にエラーが発生: ${error.message}`;
        await writeLog('error', 'processFollow', error_message, null, null);
    }
}

async function processadjustmentFollow() {
    try {
        // フォロワーとフォロー一覧を取得
        const followers = await getAllFollowers(TARGET_USER_ID);
        const followings = await getAllFollowings(TARGET_USER_ID);
        const follow_count_data = `取得したフォロワー数：${followers.length}\nフォロー数：${followings.length}`
        await writeLog('debug', 'processadjustmentFollow', follow_count_data, null, null);

        // フォロワー一覧の表示を改善
        const follower_debug = followers.map(follower => 
            `  - ID: ${follower.id}, ユーザー名: ${follower.username}${follower.host ? '@' + follower.host : ''}`
        );
        // フォロー一覧の表示を改善
        const following_debug = followings.map(following => 
            `  - ID: ${following.id}, ユーザー名: ${following.username}${following.host ? '@' + following.host : ''}`
        );
        // ログに出力

        const follow_detail_data = `詳細データ\nフォロー一覧:${following_debug.join('\n')}\nフォロー一覧:${follower_debug.join('\n')}`
        await writeLog('debug', 'processadjustmentFollow', follow_detail_data, null, null);

        // 差分計算と表示
        const difference = followers.filter(x => !followings.some(y => y.id === x.id));
        // console.log(difference);　// 主要生データ（DBに入れるやつ
        const differenceIds = difference.map(user => user.id);
        const follower_following_list = (`フォロワーユーザ-フォローユーザ（フォローをするべきユーザ）:${differenceIds}`);
        await writeLog('info', 'processadjustmentFollow', follower_following_list, null, null);
        // フォローが必要なユーザー全員に対してフォロー処理を実行
        for (const userId of differenceIds) {
            try {
                await createMisskeyFollow(userId);
                await writeLog('info', 'processadjustmentFollow', `フォローを実施: ${userId}`, null, null);
            } catch (error) {
                await writeLog('error', 'processadjustmentFollow', `フォロー実行エラー: ${userId} - ${error.message}`, null, null);
                continue;
            }
        }
        //difference.forEach(user => {
        //    console.log(`  - ID: ${user.id}, ユーザー名: ${user.username}${user.host ? '@' + user.host : ''}`);
        //}); // デバック用データ

        // 逆方向の差分計算と表示
        const reverseDifference = followings.filter(x => !followers.some(y => y.id === x.id));
        // console.log(reverseDifference);　// 主要生データ（DBに入れるやつ
        const reverseDifferenceIds = reverseDifference.map(user => user.id);
        const following_follower_list = (`フォローユーザ-フォロワーユーザ（フォローを外すべきユーザ）:${reverseDifferenceIds}`);
        await writeLog('info', 'processadjustmentFollow', following_follower_list, null, null);
        // フォローを外す必要があるユーザー全員に対してフォロー解除処理を実行
        for (const userId of reverseDifferenceIds) {
            try {
                await deleteMisskeyFollow(userId);
                await writeLog('info', 'processadjustmentFollow', `フォローを解除: ${userId}`, null, null);
            } catch (error) {
                await writeLog('error', 'processadjustmentFollow', `フォロー解除エラー: ${userId} - ${error.message}`, null, null);
                continue;
            }
        }
        // reverseDifference.forEach(user => {
        //    console.log(`  - ID: ${user.id}, ユーザー名: ${user.username}${user.host ? '@' + user.host : ''}`);
        //}); // デバック用データ


        return {}
    } catch (error) {
        const error_message = `相互フォロー分析中にエラーが発生: ${error.message}`;
        await writeLog('error', 'processadjustmentFollow', error_message, null, null);
        throw error;
    }
}


export { processFollow, processadjustmentFollow };
