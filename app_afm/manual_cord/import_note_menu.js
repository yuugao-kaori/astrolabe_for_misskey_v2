


/**
 * @fileoverview CSVファイルからノートメニューデータをPostgreSQLデータベースにインポートするスクリプト
 * @description
 * このスクリプトは以下の主要な機能を提供します：
 * 1. PostgreSQLデータベースに接続し、必要に応じてnote_menuテーブルを作成
 * 2. 指定されたCSVファイルからメニューデータを読み込み
 * 3. 既存のメニューとの重複チェックを行い、新規データのみをインポート
 * 
 * 処理の流れ：
 * 1. データベース接続の確立
 * 2. note_menuテーブルの存在確認と作成
 * 3. 既存メニューデータの取得
 * 4. CSVファイルの読み込みと解析
 * 5. トランザクション内でのデータ挿入
 *    - 空のname値のチェック
 *    - 重複データのスキップ
 *    - 有効なデータの挿入
 * 6. 処理結果の集計とログ出力
 * 
 * @requires dotenv - 環境変数の設定用
 * @requires fs - ファイル読み込み用
 * @requires csv-parse/sync - CSV解析用
 * @requires path - パス操作用
 * @requires pg - PostgreSQL接続用
 * 
 * @note
 * - CSVファイルは'/penetration/test.csv'から読み込まれます
 * - データベース接続情報は環境変数から取得
 * - エラー発生時はトランザクションがロールバック
 * - 処理結果（新規追加数、スキップ数、重複数）がコンソールに出力
 */
import { config } from 'dotenv';
import { readFileSync } from 'fs';  // createReadStreamから変更
import { parse as csvParse } from 'csv-parse/sync';
import { join } from 'path';
import pkg from 'pg';
const { Client } = pkg;

config();

const createDBClient = () => {
    return new Client({
        user: process.env.POSTGRES_USER,
        host: process.env.POSTGRES_HOST,
        database: process.env.POSTGRES_DB,
        password: process.env.POSTGRES_PASSWORD,
        port: process.env.POSTGRES_PORT,
    });
};

async function importCSV() {
    const client = createDBClient();
    let connected = false;

    try {
        await client.connect();
        connected = true;

        
        // テーブルが存在しない場合は作成
        await client.query(`
            CREATE TABLE IF NOT EXISTS note_menu (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 既存のメニュー名を取得
        const existingMenus = await client.query('SELECT name FROM note_menu');
        const existingMenuSet = new Set(existingMenus.rows.map(row => row.name));

        // CSVファイルを読み込んでデータを挿入
        const fileContent = readFileSync('/penetration/test.csv', 'utf-8');
        const records = csvParse(fileContent, {
            columns: true,
            skip_empty_lines: true
        });

        // トランザクション開始
        await client.query('BEGIN');

        let skippedCount = 0;
        let duplicateCount = 0;
        
        for (const record of records) {
            if (!record.name) {
                console.warn('警告: nameが空のレコードをスキップします');
                skippedCount++;
                continue;
            }
            
            // 重複チェック
            if (existingMenuSet.has(record.name)) {
                duplicateCount++;
                continue;
            }

            await client.query(
                'INSERT INTO note_menu (name) VALUES ($1)',
                [record.name]
            );
        }

        await client.query('COMMIT');
        console.log(`${records.length - skippedCount - duplicateCount}件の新規データをインポートしました`);
        if (skippedCount > 0) {
            console.log(`${skippedCount}件の無効なレコードをスキップしました`);
        }
        if (duplicateCount > 0) {
            console.log(`${duplicateCount}件の重複データをスキップしました`);
        }

    } catch (error) {
        if (connected) {
            await client.query('ROLLBACK');
        }
        console.error('データのインポート中にエラーが発生しました:', error);
        throw error;
    } finally {
        if (connected) {
            await client.end();
        }
    }
}

// スクリプト実行
importCSV().catch(console.error);
