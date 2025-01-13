import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;
import { updateMultiKVoperation, getMultiKVoperation } from './db_operation/multi_db_connection.js';
import { processadjustmentFollow } from `./prosessing_follow.js`;
import { writeLog } from './db_operation/create_logs.js';
import { deleteOldLogs } from './db_operation/delete_logs.js';
import { sendDM } from './misskey_operation/create_note.js';
config();

// ロガーの設定
const logger = {
    info: (message) => console.log(`INFO: ${message}`),
    error: (message) => console.error(`ERROR: ${message}`)
};


async function resetHeatCounter() {
    try {
        await updateMultiKVoperation('protection', '0', 'heat');
        const info_message = ('heatカウンターを0にリセットしました');
        await writeLog('info', 'resetHeatCounter', info_message, null, null);
        await updateMultiKVoperation('protection', '0', 'chat_gpt_heat');
        const info_message2 = ('chat_gpt_heatカウンターを0にリセットしました');
        await writeLog('info', 'resetHeatCounter', info_message2, null, null);
    }
    catch (error) {
        const error_message = (`heatカウンターのリセット中にエラーが発生: ${error.message}`);
        await writeLog('error', 'resetHeatCounter', error_message, null, null);
        return false;
    }

}

async function executeMaintenance() {
    try {
        await resetHeatCounter();
    } catch (error) {
        const error_message = `resetHeatCounter実行中にエラーが発生: ${error.message}`;
        await writeLog('error', 'executeMaintenance', error_message, null, null);
    }
    try {
        await processadjustmentFollow();
    }
    catch (error) {
        const error_message = `processadjustmentFollow実行中にエラーが発生: ${error.message}`;
        await writeLog('error', 'executeMaintenance', error_message, null, null);
    }
    try {
        await deleteOldLogs();
    } catch (error) {
        const error_message = `deleteOldLogs実行中にエラーが発生: ${error.message}`;
        await writeLog('error', 'executeMaintenance', error_message, null, null);
    }
    await sendDM('メンテナンスが完了しました\nメンテナンス内容\n - heat値カウンターのリセット\n - フォロー調整処理\n - 古いログの削除');
}


// メンテナンス関数のエクスポート
export { executeMaintenance };

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
    resetHeatCounter().then(success => {
        if (success) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    });
}
