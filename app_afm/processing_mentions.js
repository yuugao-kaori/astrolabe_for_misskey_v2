import { sendReply } from './misskey_operation/create_note.js';
import { writeLog } from './db_operation/create_logs.js';
import { updateMultiKVoperation, getMultiKVoperation } from './db_operation/multi_db_connection.js';
import { config } from 'dotenv';
import {askChatGPT} from './webpage_operation/connect_chatgpt.js';

config();

const TARGET_USER_ID = process.env.NOTICE_MISSKEY_BOT_USER_ID;

async function processMentions(note) {
    // 指定されたユーザーへのメンションかチェック
    if (note.mentions.includes(TARGET_USER_ID)) {
        // pingコマンドかチェック
        if (note.text && note.text.toLowerCase().includes('ping')) {
            // pongを返信
            await sendReply('あーあー、私は何も聞こえませ～～ん', note.visibility , note.id);
            const info_message = 'pongを返信しました';
            await writeLog('info', 'processMentions', info_message, null, null);
        } else if (note.text && note.text.toLowerCase().includes('info_bot_heat')) {
            const now_heat = await getMultiKVoperation('protection', 'heat');
            const reply_text = `えっと、私のHeat値を知りたいんですね。たぶん${now_heat}！　${now_heat}だと思います。\n\n（たぶんですよ！）`;
            await sendReply(reply_text, note.visibility, note.id);
            const info_message = 'BotのHeat値を送信しました';
            await writeLog('info', 'processMentions', info_message, null, null);
        } else if (note.text && note.text.toLowerCase().includes('reset_bot_heat')) {
            await updateMultiKVoperation('protection', '0', 'heat');
            const bot_heat_reset_text = 'は～い！私のHeat値はしっかりリセットされました！これで呟きたい放題です。\nぐへへ～！！';
            await sendReply(bot_heat_reset_text, note.visibility, note.id);
            const info_message = 'BotのHeat値をリセットしました';
            await writeLog('info', 'processMentions', info_message, null, null);
        } else if (note.text && note.text.toLowerCase().includes('test')) {
            console.log('Test success');
            await writeLog('info', 'processMentions', 'test_success', null, null);
        } else if (note.text && note.text.toLowerCase().includes('chat')) {
            const max_chat_gpt_heat = await getMultiKVoperation('settings', 'max_chat_gpt_heat');
            const chat_gpt_heat = await getMultiKVoperation('protection', 'chat_gpt_heat');
            if (Number(chat_gpt_heat) >= Number(max_chat_gpt_heat)) {
                const reply_text = '申し訳ありません、私は現在お話することができません。\nしょぼーんって感じです；；';
                await sendReply(reply_text, note.visibility, note.id);
                const error_message = 'ChatGPTのHeat値が上限に達したため、応答できません';
                await writeLog('error', 'processMentions', error_message, null, null);
                return;
            } else if (Math.random() < 0.01){
                const reply_text = 'らーべ、11さいなのでわかんな～い。ごめんなさい！\n\n(1%の確率で実行されるジョーク機能です。再試行すれば正常に応答するはずです。)';
                await sendReply(reply_text, note.visibility, note.id);
                return;
            }
            const question = note.text.replace(`chat`, '');
            const reply_text = await askChatGPT(question);
            await updateMultiKVoperation('protection', Number(chat_gpt_heat) + 1, 'chat_gpt_heat');
            await sendReply(reply_text, note.visibility, note.id);
            const info_message = `chatコマンドを受領し、正常に応答しました。\n質問内容:${question}\n応答内容:${reply_text}`;
            await writeLog('info', 'processMentions', info_message, null, null);
        } 
        
    }
}

export { processMentions };
