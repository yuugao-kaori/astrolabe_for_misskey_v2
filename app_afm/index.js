import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';
import { sendDM, createNote, createNoteWithMedia } from './misskey_operation/create_note.js';
import { uploadMisskeyFile} from './misskey_operation/create_file.js';
import { getMultiFeed } from './webpage_operation/get_feed.js';
import { getRandomDinner } from './db_operation/get_dinner.js';
import { executeMaintenance } from './maintenance.js';
import { getRandomDinnerText, getRandomNoteText} from './db_operation/get_note_text.js';
import { updateMultiMemorandum } from './db_operation/update_memorandum.js';
import { getMemorandumDinnerText, getMultiMemorandum} from './db_operation/get_memorandum.js';
import { updateMultiKVoperation, getMultiKVoperation } from './db_operation/multi_db_connection.js';
import {connectWebSocket_hybrid,connectWebSocket_main, connectWebSocket_global} from './misskey_operation/connect_websocket.js';
import { writeLog } from './db_operation/create_logs.js';
import schedule from 'node-schedule';
import { getMisskeyEmojiList, getMisskeyEmojiListSingle } from './misskey_operation/get_emoji.js';
import { send } from 'process';

config();

const scheduleOptions = {
    tz: 'Asia/Tokyo'
  };
  
const __dirname = dirname(fileURLToPath(import.meta.url));
let noteText;



async function breakfast(){
    // 0-30分のランダムな待機時間を設定
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 31) * 60 * 1000));

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
    // 0-30分のランダムな待機時間を設定
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 31) * 60 * 1000));

    const message = await getRandomNoteText('morning_greeting');
    const result = await createNote(message);
    const info_message = '朝の挨拶を実行';
    await writeLog('info', 'morning_greeting', info_message, null, null);
}



async function bathing() {
    // 0-30分のランダムな待機時間を設定
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 31) * 60 * 1000));

    const message = await getRandomNoteText('bathing');
    const result = await createNote(message);
    const info_message = '入浴を実行';
    await writeLog('info', 'bathing', info_message, null, null);
}

async function night_greeting() {
    // 0-30分のランダムな待機時間を設定
    await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 31) * 60 * 1000));

    const message = await getRandomNoteText('night_greeting');
    const result = await createNote(message);
    
    const info_message = '夜の挨拶を実行';
    await writeLog('info', 'night_greeting', info_message, null, null);
}

async function multi_feed(FeedURL) {
    try {
        // 0-30分のランダムな待機時間を設定
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 31) * 60 * 1000));
        const News = await getMultiFeed(FeedURL,1);
        
        // フィードが空または無効な場合の早期リターン
        if (!News || News.length === 0 || !News[0].link) {
            const FeedName = FeedURL.replace('https://', '').replace(/\.(com|jp|co\.jp)/, '').replace('/feed', '');
            const error_message = `Feed(${FeedName})の取得に失敗しました`;
            await writeLog('error', 'multi_feed', error_message, null, null);
            return;
        }

        const news_comment = await getRandomNoteText(`feed_text`);
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
    } catch (error) {
        const error_message = `フィード処理エラー: ${error.message}`;
        await writeLog('error', 'multi_feed', error_message, null, null);
    }
}

async function python_connect(endpoint) {
    try {
        // 0-30分のランダムな待機時間を設定
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 31) * 60 * 1000));



        const response = await axios.get(`http://python-afm:3000${endpoint}`);
        
        if (response.data && response.data.text) {
            const message = `${response.data.text}`;
            await createNote(message);
            // \n\n<i><small>(これは自動生成です。不適切な場合は@takumin3211までお伝え下さい)</small></i>
            // const info_message = 'Python生成テキストの投稿を実行';
            // await writeLog('info', 'python_connect', info_message, null, null);
        } else {
            throw new Error('テキストデータが見つかりません');
        }
    } catch (error) {
        const error_message = `Python接続エラー: ${error.message}`;
        await writeLog('error', 'python_connect', error_message, null, null);
        console.error(error_message);
    }
}

async function python_connect_wordcloud(endpoint) {
    try {
        const response = await axios.get(`http://python-afm:3000${endpoint}`, {
            responseType: 'arraybuffer'  // バイナリデータとして受け取る
        });
        
        if (response.data) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '');
            const filename = `wordcloud_${timestamp}.png`;
            
            // ファイルをMisskeyにアップロード
            const fileId = await uploadMisskeyFile(
                response.data,
                filename,
                'image/png'
            );

            if (fileId) {
                const message = `直近4時間のグローバルタイムラインから生成したワードクラウドができました！\n<i><small>頻出ワードや注意が必要な言葉は除外しています</small></i>`;
                await createNoteWithMedia(message, [fileId]);
                
                const info_message = 'ワードクラウドの投稿を実行';
                await writeLog('info', 'python_connect_wordcloud', info_message, null, null);
            } else {
                throw new Error('ファイルのアップロードに失敗しました');
            }
        } else {
            throw new Error('画像データが見つかりません');
        }
    } catch (error) {
        const error_message = `ワードクラウド生成エラー: ${error.message}`;
        await writeLog('error', 'python_connect_wordcloud', error_message, null, null);
        console.error(error_message);
    }
}

async function emoji_difference() {
    try {
        const emoji_list = await getMultiKVoperation('memorandum', 'emoji_list');

        const new_emoji_list = await getMisskeyEmojiList();

        // emoji_listがnullの場合の処理
        if (!emoji_list) {
            console.log('初回の絵文字リストを保存します');
            await updateMultiKVoperation('memorandum', new_emoji_list, 'emoji_list');
            const info_message = '初回の絵文字リストを保存しました';
            await writeLog('info', 'emoji_difference', info_message, null, null);
            return;
        }

        // 前回のリストを取得
        let oldEmojiList;
        
        // 文字列から配列への変換を試みる
        try {
            if (typeof emoji_list === 'string') {
                // 特殊な形式（{item1,item2,...}）を検出して配列に変換
                if (emoji_list.startsWith('{') && emoji_list.includes(',') && !emoji_list.includes(':')) {
                    console.log('特殊形式の絵文字リストを検出、配列に変換します');
                    const items = emoji_list.slice(1, -1).split(',').map(item => item.trim().replace(/"/g, ''));
                    oldEmojiList = items.map(name => ({ name }));
                } else if (emoji_list.startsWith('[')) {
                    // 既にJSON配列形式の場合
                    oldEmojiList = JSON.parse(emoji_list);
                } else {
                    // その他の形式は空配列で初期化
                    console.log('未知の形式の絵文字リスト、初期化します');
                    oldEmojiList = [];
                }
            } else if (Array.isArray(emoji_list)) {
                // 既に配列の場合はそのまま使用
                oldEmojiList = emoji_list;
            } else {
                // その他の型の場合は空配列
                oldEmojiList = [];
            }
        } catch (e) {
            console.error('絵文字リストの変換に失敗しました:', e);
            console.log('絵文字リスト内容:', emoji_list);
            oldEmojiList = [];
            const recovery_message = '絵文字リストの処理に失敗したため、リストを初期化しました';
            await writeLog('warning', 'emoji_difference', recovery_message, null, null);
        }
        
        // 新しいリストを保存（配列そのものを保存）
        await updateMultiKVoperation('memorandum', new_emoji_list, 'emoji_list');

        // 差分を検出する
        let addedEmojis = [];
        if (Array.isArray(oldEmojiList) && Array.isArray(new_emoji_list)) {
            // デバッグ情報を記録
            console.log(`oldEmojiList(${oldEmojiList.length}件)の例:`, oldEmojiList.slice(0, 3));
            console.log(`new_emoji_list(${new_emoji_list.length}件)の例:`, new_emoji_list.slice(0, 3));
            
            // 構造の違いを確認
            const oldIsObjectArray = oldEmojiList.length > 0 && typeof oldEmojiList[0] === 'object';
            const newIsStringArray = new_emoji_list.length > 0 && typeof new_emoji_list[0] === 'string';
            
            console.log('構造の違い:', { oldIsObjectArray, newIsStringArray });
            
            // 古いリストの絵文字名のセットを作成（構造の違いに対応）
            const oldEmojiNameSet = new Set(
                oldIsObjectArray 
                    ? oldEmojiList.map(emoji => emoji.name)
                    : oldEmojiList
            );
            
            // 新しいリストから追加された絵文字を検出（構造の違いに対応）
            addedEmojis = newIsStringArray
                ? new_emoji_list.filter(name => !oldEmojiNameSet.has(name))
                    .map(name => ({ name }))  // 表示用にオブジェクト形式に変換
                : new_emoji_list.filter(emoji => !oldEmojiNameSet.has(emoji.name));
            
            console.log(`検出された新しい絵文字: ${addedEmojis.length}件`);
            
            
            if (addedEmojis.length > 0) {
                let messageLines = ['新しい絵文字が追加されました！'];
                
                // 各絵文字の詳細情報を取得して整形
                for (const emoji of addedEmojis) {
                    const emojiName = typeof emoji === 'string' ? emoji : emoji.name;
                    
                    // 詳細情報を取得
                    const emojiDetails = await getMisskeyEmojiListSingle(emojiName);
                    
                    if (emojiDetails) {
                        const aliases = emojiDetails.aliases && emojiDetails.aliases.length > 0 
                            ? emojiDetails.aliases.join(', ')
                            : 'なし';
                        
                        messageLines.push(`:${emojiName}: 登録名：「${emojiName}」`);
                    } else {
                        // 詳細が取得できなかった場合はシンプルな表示
                        messageLines.push(`:${emojiName}: 登録名：「${emojiName}」`);
                    }
                }
                
                const fullMessage = messageLines.join('\n');
                
                // メッセージが3000文字を超える場合は分割して送信
                if (fullMessage.length > 3000) {
                    const messageParts = [];
                    let currentPart = '';
                    
                    // メッセージを行ごとに分割
                    for (const line of messageLines) {
                        // この行を追加すると3000文字を超える場合、新しいパートを開始
                        if (currentPart.length + line.length + 1 > 3000) {
                            messageParts.push(currentPart);
                            currentPart = line;
                        } else {
                            // 最初の行でなければ改行を追加
                            if (currentPart.length > 0) {
                                currentPart += '\n' + line;
                            } else {
                                currentPart = line;
                            }
                        }
                    }
                    
                    // 最後のパートを追加
                    if (currentPart.length > 0) {
                        messageParts.push(currentPart);
                    }
                    
                    // 各パートを順番に送信
                    for (let i = 0; i < messageParts.length; i++) {
                        const partMessage = `${messageParts[i]}\n(${i+1}/${messageParts.length})`;
                        await createNote(partMessage);
                    }
                } else {
                    // 3000文字以下の場合はそのまま送信
                    await createNote(fullMessage);
                }
                
                const info_message = `${addedEmojis.length}個の新しい絵文字を検出しました`;
                await writeLog('info', 'emoji_difference', info_message, null, null);
            } else {
                const info_message = '新しい絵文字はありませんでした';
                await writeLog('info', 'emoji_difference', info_message, null, null);
            }
        } else {
            console.error('絵文字リストの形式が不正です', { 
                oldEmojiListIsArray: Array.isArray(oldEmojiList),
                new_emoji_listIsArray: Array.isArray(new_emoji_list)
            });
            const error_message = '絵文字リストの形式が不正です';
            await writeLog('error', 'emoji_difference', error_message, null, null);
        }

        const emojis = addedEmojis.length > 0 ? addedEmojis : null;
        if (emojis) {
            console.log('絵文字取得成功:', emojis);
        } else {
            console.log('絵文字取得なし');
        }

    } catch (error) {
        console.error('絵文字取得エラー:', error);
        await writeLog('error', 'emoji_difference', `絵文字取得エラー: ${error.message}`, null, null);
    }
}




async function test_python_connect(endpoint) {
    try {
        const response = await axios.get(`http://python-afm:3000${endpoint}`);
        
        if (response.data && response.data.text) {
            const message = `${response.data.text}\n\n<small>(これは自動生成です。不適切な投稿は管理者@takumin3211までお伝え下さい)</small>`;
            await sendDM(message);
            
            const info_message = 'Python生成テキストの投稿を実行';
            await writeLog('info', 'test_python_connect', info_message, null, null);
        } else {
            throw new Error('テキストデータが見つかりません');
        }
    } catch (error) {
        const error_message = `Python接続エラー: ${error.message}`;
        await writeLog('error', 'test_python_connect', error_message, null, null);
        console.error(error_message);
    }
}

async function think_Dinner() {
    const dinner = await getRandomDinner();
    if (dinner) {
        // 0-30分のランダムな待機時間を設定
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 31) * 60 * 1000));
        if (Math.random() < 0.1) {
            const message = "はわわっ……\nおやつを食べ過ぎてしまいました。。\n\n今夜はお腹いっぱいです＞＜"
            const result = await createNote(message);
            const Note_Text = '満腹'
            await updateMultiMemorandum('dinner', Note_Text);
            return;
        }
        const Note_Text = await getRandomNoteText(`dinner_text`);
        const message = `${Note_Text}\n\n今夜の献立はこちら！\n『${dinner}』`;
        // メモランダムテーブルにNote_Textを保存
        await updateMultiMemorandum('dinner', dinner);
        const result = await createNote(message);
        const info_message = '夕食の投稿を実行';
        await writeLog('info', 'think_Dinner', info_message, null, null);
    } else {
        const error_message = '献立の取得に失敗しました';
        await writeLog('error', 'think_Dinner', error_message, null, null);
    }
}

async function test(endpoint) {
    try {
        const response = await axios.get(`http://python-afm:3000${endpoint}`);
        
        if (response.data && response.data.text) {
            const message = `${response.data.text}`;
            await sendDM(message);
            // \n\n<i><small>(これは自動生成です。不適切な場合は@takumin3211までお伝え下さい)</small></i>
            // const info_message = 'Python生成テキストの投稿を実行';
            // await writeLog('info', 'python_connect', info_message, null, null);
        } else {
            throw new Error('テキストデータが見つかりません');
        }
    } catch (error) {
        const error_message = `Python接続エラー: ${error.message}`;
        await writeLog('error', 'python_connect', error_message, null, null);
        console.error(error_message);
    }
}

async function main() {
    try {
        // WebSocket接続
        await connectWebSocket_hybrid();
        await connectWebSocket_main();
        await connectWebSocket_global();
        // 投稿関連のスケジュール

        schedule.scheduleJob({scheduleOptions, rule: '0 7 * * *'}, morning_greeting);
        schedule.scheduleJob({scheduleOptions, rule: '30 7 * * *'}, breakfast);
        schedule.scheduleJob({scheduleOptions, rule: '0 8 * * *'}, () => python_connect('/generate/text'));
        schedule.scheduleJob({scheduleOptions, rule: '0 9 * * *'}, () => multi_feed('https://trafficnews.jp/feed'));
        schedule.scheduleJob({scheduleOptions, rule: '0 10 * * *'}, () => python_connect('/generate/text'));
        schedule.scheduleJob({scheduleOptions, rule: '30 11 * * *'}, () => multi_feed('https://gourmet.watch.impress.co.jp/data/rss/1.0/grw/feed.rdf'));
        schedule.scheduleJob({scheduleOptions, rule: '0 12 * * *'}, () => multi_feed('https://gigazine.net/news/rss_2.0/'));
        schedule.scheduleJob({scheduleOptions, rule: '0 13 * * *'}, () => python_connect('/generate/text'));
        schedule.scheduleJob({scheduleOptions, rule: '0 14 * * *'}, () => multi_feed('https://nazology.kusuguru.co.jp/feed'));
        schedule.scheduleJob({scheduleOptions, rule: '0 15 * * *'}, () => python_connect('/generate/text'));
        schedule.scheduleJob({scheduleOptions, rule: '0 16 * * *'}, () => multi_feed('https://www.publickey1.jp/atom.xml'));
        schedule.scheduleJob({scheduleOptions, rule: '0 17 * * *'}, () => python_connect('/generate/text'));
        schedule.scheduleJob({scheduleOptions, rule: '0 18 * * *'}, () => multi_feed('https://www.gamespark.jp/rss20/index.rdf'));
        schedule.scheduleJob({scheduleOptions, rule: '30 18 * * *'}, bathing);
        schedule.scheduleJob({scheduleOptions, rule: '0 19 * * *'}, think_Dinner);
        schedule.scheduleJob({scheduleOptions, rule: '0 20 * * *'}, () => python_connect_wordcloud('/generate/wordcloud'));
        schedule.scheduleJob({scheduleOptions, rule: '30 20 * * *'}, () => python_connect('/generate/text'));
        schedule.scheduleJob({scheduleOptions, rule: '0 21 * * *'}, () => multi_feed('https://automaton-media.com/feed/'));
        schedule.scheduleJob({scheduleOptions, rule: '30 21 * * *'}, emoji_difference);
        schedule.scheduleJob({scheduleOptions, rule: '0 22 * * *'}, night_greeting);
        
        // schedule.scheduleJob({scheduleOptions, rule: '20 23 * * *'}, () => test('test'));
        // python_connect_wordcloud('/generate/wordcloud')
        // 毎日3時にheatカウンターをリセット
        // test(`/generate/text`);
        schedule.scheduleJob('0 3 * * *', async () => {const result = await executeMaintenance();});
        // await test('https://gourmet.watch.impress.co.jp/data/rss/1.0/grw/feed.rdf')
        // 本番運用ではDMを送信する。sendDM("なんか起動したみたいですよ");
        console.log("起動しました");
        
        await writeLog('info', 'main', `起動しました`, null, null);
    } catch (error) {
        const error_message = `エラーが発生しました: ${error.message}`;
        console.error(error_message);
        await writeLog('error', 'main', error_message, null, null);
    }
}

// スクリプト実行
main();
