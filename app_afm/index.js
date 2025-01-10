import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sendDM, createNote } from './misskey_operation/create_note.js';
import { getMultiFeed } from './webpage_operation/get_feed.js';
import { getRandomDinner } from './db_operation/get_dinner.js';
import { resetHeatCounter } from './maintenance.js';
import { getRandomDinnerText, getRandomNoteText} from './db_operation/get_note_text.js';
import { updateMultiMemorandum } from './db_operation/update_memorandum.js';
import { getMemorandumDinnerText, getMultiMemorandum} from './db_operation/get_memorandum.js';
import { updateMultiKVoperation, getMultiKVoperation } from './db_operation/multi_db_connection.js';
import {connectWebSocket_hybrid} from './misskey_operation/connect_websocket.js';
import { writeLog } from './db_operation/create_logs.js';
import schedule from 'node-schedule';

config();

const scheduleOptions = {
    tz: 'Asia/Tokyo'
  };
  
const __dirname = dirname(fileURLToPath(import.meta.url));
let noteText;



async function breakfast(){
    const breakfast_text = await getMemorandumDinnerText();
    if (breakfast_text == '満腹') {
        const info_message = '朝食の投稿はありません';
        await writeLog('info', 'breakfast', info_message, null, null);
        return;
    }
    else{
        const message = `むぅ……なんだかお腹が空いてきました。\nあ、そうだ！昨日の『${breakfast_text}』を温め直しましょう＾＾`;
        const result = await createNote(message); 
    }  
}

async function morning_greeting() {
    const message = await getRandomNoteText('morning_greeting');
    const result = await createNote(message);
    const info_message = '朝の挨拶を実行';
    await writeLog('info', 'morning_greeting', info_message, null, null);
}


async function night_greeting() {
    const message = await getRandomNoteText('night_greeting');
    const result = await createNote(message);
    
    const info_message = '夜の挨拶を実行';
    await writeLog('info', 'night_greeting', info_message, null, null);
}

async function multi_feed(FeedURL) {

    const News = await getMultiFeed(FeedURL,1);
    const feed_text = noteText.feed_text;
    const news_comment = await getRandomNoteText(feed_text);
    // debug用 console.log(News);
    const FeedResult = await getMultiMemorandum(FeedURL);
    if (FeedResult == News[0].link) {
        const FeedName = FeedURL.replace('https://', '').replace('.com', '').replace('.jp', '').replace('.co.jp', '').replace('/feed', '');
        const info_message = `Feed(${FeedName})は前回の実行から更新されていません`;
        await writeLog('info', 'multi_feed', info_message, null, null);
        return;
    }
    await updateMultiMemorandum(FeedURL, `${News[0].link}`);
    
    const FeedName = FeedURL.replace('https://', '').replace('.com', '').replace('.jp', '').replace('.co.jp', '').replace('/feed', '');
    const info_message = `Feed(${FeedName})の投稿を実行`;
    await writeLog('info', 'multi_feed', info_message, null, null);

    const message = `${news_comment}\n\n${News[0].title}\n${News[0].link}`;
    const result = await createNote(message);
}

async function think_Dinner() {
    const dinner = await getRandomDinner();
    if (dinner) {
        if (Math.random() < 0.1) {
            const message = "はわわっ……\nおやつを食べ過ぎてしまいました。。\n\n今夜はお腹いっぱいです＞＜"
            const result = await createNote(message);
            const Note_Text = '満腹'
            await updateMultiMemorandum('dinner', Note_Text);
            return;
        }
        const Note_Text = await getRandomNoteText(dinner_text);
        const message = `${Note_Text}\n\n今夜の献立はこちら！\n『${dinner}』`;
        // メモランダムテーブルにNote_Textを保存
        await updateMultiMemorandum('dinner', Note_Text);
        const result = await createNote(message);
        const info_message = '夕食の投稿を実行';
        await writeLog('info', 'think_Dinner', info_message, null, null);
    } else {
        const error_message = '献立の取得に失敗しました';
        await writeLog('error', 'think_Dinner', error_message, null, null);
    }
}

async function test(test) {
    //const message = "テスト投稿です\n（ちょっとお邪魔しますｿｿｿｿ）";
    //const result = await createNote(message);
    //const result = await sendDM(message);
    let message = test;
    const result = await sendDM(message);
}

async function main() {
    try {
        // WebSocket接続
        await connectWebSocket_hybrid();
        // 投稿関連のスケジュール
        schedule.scheduleJob({scheduleOptions, rule: '0 7 * * *'}, morning_greeting);
        schedule.scheduleJob({scheduleOptions, rule: '30 7 * * *'}, breakfast);
        schedule.scheduleJob({scheduleOptions, rule: '0 10 * * *'}, () => multi_feed('https://trafficnews.jp/feed'));
        schedule.scheduleJob({scheduleOptions, rule: '0 12 * * *'}, () => multi_feed('https://gigazine.net/news/rss_2.0/'));
        schedule.scheduleJob({scheduleOptions, rule: '0 14 * * *'}, () => multi_feed('https://nazology.kusuguru.co.jp/feed'));
        schedule.scheduleJob({scheduleOptions, rule: '0 16 * * *'}, () => multi_feed('https://www.publickey1.jp/atom.xml'));
        schedule.scheduleJob({scheduleOptions, rule: '0 18 * * *'}, () => multi_feed('https://www.gamespark.jp/rss20/index.rdf'));
        schedule.scheduleJob({scheduleOptions, rule: '0 19 * * *'}, think_Dinner);
        schedule.scheduleJob({scheduleOptions, rule: '0 21 * * *'}, () => multi_feed('https://automaton-media.com/feed/'));
        schedule.scheduleJob({scheduleOptions, rule: '0 22 * * *'}, night_greeting);
        schedule.scheduleJob({scheduleOptions, rule: '20 23 * * *'}, () => test('test'));

        // 毎日3時にheatカウンターをリセット
        schedule.scheduleJob('0 3 * * *', async () => {
            const result = await resetHeatCounter();
            if (result) {
                const info_message = `heatカウンターのリセットに成功しました`;
                await writeLog('info', 'main', info_message, null, null);
            } else {
                const error_message = `heatカウンターのリセットに失敗しました`;
                await writeLog('error', 'main', error_message, null, null);
            }
        });
        //await test()
        // 本番運用ではDMを送信する。sendDM("なんか起動したみたいですよ");
    
        console.log("起動しました");
    } catch (error) {
        const error_message = `エラーが発生しました: ${error.message}`;
        console.error(error_message);
        await writeLog('error', 'main', error_message, null, null);
    }
}

// スクリプト実行
main();
