import { config } from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sendDM, createNote } from './create_note.js';
import { getTrafficNews, getGigazin,getNazology, getPublickey,getGameSpark, getMultiFeed } from './get_feed.js';
import { getRandomDinner } from './get_dinner.js';
import { resetHeatCounter } from './maintenance.js';
import { getRandomDinnerText} from './get_note_text.js';
import { updateMultiMemorandum } from './update_memorandum.js';
import { getMemorandumDinnerText, getMultiMemorandum} from './get_memorandum.js';
import schedule from 'node-schedule';

config();

const scheduleOptions = {
    tz: 'Asia/Tokyo'
  };
  
const __dirname = dirname(fileURLToPath(import.meta.url));
let noteText;

// JSONファイルを読み込む
try {
    const jsonContent = await readFile(join(__dirname, 'note_text.json'), 'utf8');
    noteText = JSON.parse(jsonContent);
} catch (error) {
    console.error('note_text.jsonの読み込みに失敗しました:', error);
    process.exit(1);
}

async function breakfast(){
    const breakfast_text = await getMemorandumDinnerText();
    if (breakfast_text == '満腹') {
        console.log("朝食の投稿はありません");
        return;
    }
    else{
        
        const message = `むぅ……なんだかお腹が空いてきました。\nあ、そうだ！昨日の『${breakfast_text}』を温め直しましょう＾＾`;
        const result = await createNote(message); 
    }  
}

async function morning_greeting() {
    const greetings = noteText.morning_greeting;
    const message = greetings[Math.floor(Math.random() * greetings.length)];
    const result = await createNote(message);
    
    if (result) {
        console.log("おはよう投稿の送信に成功しました");
    } else {
        console.error("おはよう投稿の送信に失敗しました");
    }
}


async function night_greeting() {
    const greetings = noteText.night_greeting;
    const message = greetings[Math.floor(Math.random() * greetings.length)];
    const result = await createNote(message);
    
    if (result) {
        console.log("おやすみ投稿の送信に成功しました");
    } else {
        console.error("おやすみ投稿の送信に失敗しました");
    }
}

async function feed_train() {
    const News = await getTrafficNews(1);
    const feed_text = noteText.feed_text;
    const news_comment = feed_text[Math.floor(Math.random() * feed_text.length)];
    // debug用 console.log(News);
    const message = `${news_comment}\n\n${News[0].title}\n${News[0].link}`;
    const result = await createNote(message);

}

async function feed_gigazin() {
    const News = await getGigazin(1);
    const feed_text = noteText.feed_text;
    const news_comment = feed_text[Math.floor(Math.random() * feed_text.length)];
    // debug用 console.log(News);
    const message = `${news_comment}\n\n${News[0].title}\n${News[0].link}`;
    const result = await createNote(message);
}

async function feed_gamespark() {
    const News = await getGameSpark(1);
    const feed_text = noteText.feed_text;
    const news_comment = feed_text[Math.floor(Math.random() * feed_text.length)];
    // debug用 console.log(News);
    const message = `${news_comment}\n\n${News[0].title}\n${News[0].link}`;
    const result = await createNote(message);
}

async function feed_nazology() {
    const News = await getNazology(1);
    const feed_text = noteText.feed_text;
    const news_comment = feed_text[Math.floor(Math.random() * feed_text.length)];
    // debug用 console.log(News);
    const message = `${news_comment}\n\n${News[0].title}\n${News[0].link}`;
    const result = await createNote(message);
}

async function feed_Publickey() {
    const News = await getPublickey(1);
    const feed_text = noteText.feed_text;
    const news_comment = feed_text[Math.floor(Math.random() * feed_text.length)];
    // debug用 console.log(News);
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
        }
        const Note_Text = await getRandomDinnerText();
        const message = `${Note_Text}\n\n今夜の献立はこちら！\n『${dinner}』`;
        // メモランダムテーブルにNote_Textを保存
        await updateMultiMemorandum('dinner', Note_Text);
        const result = await createNote(message);
        if (result) {
            console.log("献立の投稿に成功しました");
        } else {
            console.error("献立の投稿に失敗しました");
        }
    } else {
        console.error("献立の取得に失敗しました");
    }
}

async function test() {
    //const message = "テスト投稿です\n（ちょっとお邪魔しますｿｿｿｿ）";
    //const result = await createNote(message);
    //const result = await sendDM(message);
    const FeedURL = 'https://automaton-media.com/feed/';
    const News = await getMultiFeed(FeedURL,1);
    const feed_text = noteText.feed_text;
    const news_comment = feed_text[Math.floor(Math.random() * feed_text.length)];
    // debug用 console.log(News);
    const FeedResult = await getMultiMemorandum(FeedURL);
    if (FeedResult == News[0].link) {
        console.log("新着記事はありません");
        return;
    }
    await updateMultiMemorandum(FeedURL, `${News[0].link}`);
    
    const message = `${news_comment}\n\n${News[0].title}\n${News[0].link}`;
    // const result = await sendDM(message);
}

async function main() {
    try {
        // 投稿関連のスケジュール
        schedule.scheduleJob({scheduleOptions, rule: '0 7 * * *'}, morning_greeting);
        schedule.scheduleJob({scheduleOptions, rule: '30 7 * * *'}, breakfast);
        schedule.scheduleJob({scheduleOptions, rule: '0 10 * * *'}, feed_gamespark);
        schedule.scheduleJob({scheduleOptions, rule: '0 12 * * *'}, feed_nazology);
        schedule.scheduleJob({scheduleOptions, rule: '0 14 * * *'}, feed_train);
        schedule.scheduleJob({scheduleOptions, rule: '0 16 * * *'}, feed_gigazin);
        schedule.scheduleJob({scheduleOptions, rule: '0 18 * * *'}, feed_Publickey);
        schedule.scheduleJob({scheduleOptions, rule: '0 19 * * *'}, think_Dinner);
        schedule.scheduleJob({scheduleOptions, rule: '0 22 * * *'}, night_greeting);
        // 毎日3時にheatカウンターをリセット
        schedule.scheduleJob('0 3 * * *', async () => {
            const result = await resetHeatCounter();
            if (result) {
                console.log("heatカウンターのリセットに成功しました");
            } else {
                console.error("heatカウンターのリセットに失敗しました");
            }
        });
        await test()
        // 本番運用ではDMを送信する。sendDM("なんか起動したみたいですよ");
    
        console.log("朝の挨拶スケジュールを設定しました");
    } catch (error) {
        console.error(`エラーが発生しました: ${error.message}`);
    }
}

// スクリプト実行
main();
