import WebSocket from 'ws';
import { config } from 'dotenv';
import { processMentions } from '../processing_mentions.js';

config();

const MISSKEY_TOKEN = process.env.NOTICE_MISSKEY_TOKEN;
const MISSKEY_URL = process.env.NOTICE_MISSKEY_URL;

function connectWebSocket_hybrid() {
    const wsHost = MISSKEY_URL.replace('https://', '');
    const wsUrl = `wss://${wsHost}/streaming?i=${MISSKEY_TOKEN}`;
    
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
        console.log('WebSocket接続が確立されました');
        
        const connectMessage = {
            type: 'connect',
            body: {
                channel: 'hybridTimeline',
                id: 'hybrid-timeline',
                params: {}
            }
        };
        
        ws.send(JSON.stringify(connectMessage));
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            // メッセージタイプに基づいて処理を分岐
            if (message.type === 'channel' && message.body.type === 'note') {
                const note = message.body.body;
                handleNote(note);
            }

        } catch (error) {
            console.error('メッセージのパース中にエラーが発生:', error);
        }
    });

    // ノート処理関数を修正
    function handleNote(note) {
        // メンションを含むノートの場合、処理を実行
        if (note.mentions && note.mentions.length > 0) {
            processMentions(note);
        }
    }

    ws.on('error', (error) => {
        console.error('WebSocketエラー:', error);
    });

    ws.on('close', () => {
        console.log('WebSocket接続が閉じられました');
        setTimeout(() => {
            console.log('WebSocket再接続を試みます...');
            connectWebSocket_hybrid();
        }, 5000);
    });

    return ws;
}

export { connectWebSocket_hybrid };
