import { config } from 'dotenv';
import axios from 'axios';
import { writeLog } from '../db_operation/create_logs.js';

config();

// 環境変数の読み込み
const MISSKEY_TOKEN = process.env.NOTICE_MISSKEY_TOKEN;
const MISSKEY_URL = process.env.NOTICE_MISSKEY_URL;

/**
 * Misskeyサーバーから全ての絵文字リストを取得する
 * @returns {Promise<Array<string>>} 絵文字名の配列
 */
export async function getMisskeyEmojiList() {
  try {
    const response = await axios.get('https://misskey.seitendan.com/api/emojis');
    
    if (response.data && response.data.emojis) {
      // 絵文字名のリストを作成して返却
      const emojiNames = response.data.emojis.map(emoji => emoji.name);
      await writeLog('INFO', 'Successfully fetched emoji list', { count: emojiNames.length });
      return emojiNames;
    } else {
      await writeLog('ERROR', 'Failed to fetch emoji list: Unexpected response format', response.data);
      return [];
    }
  } catch (error) {
    await writeLog('ERROR', 'Failed to fetch emoji list', { error: error.message });
    return [];
  }
}

/**
 * Misskeyサーバーから特定の絵文字の情報を取得する
 * @param {string} emojiName - 取得する絵文字の名前
 * @returns {Promise<Object|null>} 絵文字情報、見つからなければnull
 */
export async function getMisskeyEmojiListSingle(emojiName) {
  try {
    const response = await axios.get('https://misskey.seitendan.com/api/emojis');
    
    if (response.data && response.data.emojis) {
      const emoji = response.data.emojis.find(e => e.name === emojiName);
      if (emoji) {
        await writeLog('INFO', `Successfully fetched emoji: ${emojiName}`);
        return emoji;
      } else {
        await writeLog('WARN', `Emoji not found: ${emojiName}`);
        return null;
      }
    } else {
      await writeLog('ERROR', 'Failed to fetch emoji: Unexpected response format', response.data);
      return null;
    }
  } catch (error) {
    await writeLog('ERROR', `Failed to fetch emoji: ${emojiName}`, { error: error.message });
    return null;
  }
}



