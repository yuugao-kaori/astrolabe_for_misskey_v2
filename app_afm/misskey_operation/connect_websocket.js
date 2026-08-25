import WebSocket from 'ws';
import { config } from 'dotenv';
import { processMentions } from '../processing_mentions.js';
import { processFollow } from '../prosessing_follow.js';
import { processGtlNote } from './processing_gtl_note.js';
import { writeLog } from '../db_operation/create_logs.js';
import { air_reply_ollama } from '../webpage_operation/connect_ollama.js';
import { createMisskeyReaction } from './create_reaction.js';

config();

const MISSKEY_TOKEN = process.env.NOTICE_MISSKEY_TOKEN;
const MISSKEY_URL = process.env.NOTICE_MISSKEY_URL;
const MISSKEY_USER_ID = process.env.NOTICE_MISSKEY_BOT_USER_ID;

const BASE_RETRY_DELAY_MS = 5000;
const MAINTENANCE_RETRY_DELAY_MS = 60000;
const MAX_RETRY_DELAY_MS = 3600000;
const RETRY_JITTER_RATE = 0.2;
const PING_INTERVAL_MS = 60000;
const STABLE_CONNECTION_MS = 60000;
const TERMINATE_GRACE_MS = 1000;

const WS_OPTIONS = {
    handshakeTimeout: 30000,
    headers: {
        'User-Agent': 'MisskeyBot/1.0'
    },
    followRedirects: true
};

function buildWebSocketUrl() {
    if (!MISSKEY_URL || !MISSKEY_TOKEN) {
        throw new Error('NOTICE_MISSKEY_URL または NOTICE_MISSKEY_TOKEN が設定されていません');
    }

    const wsUrl = new URL('/streaming', MISSKEY_URL);
    if (wsUrl.protocol === 'https:') {
        wsUrl.protocol = 'wss:';
    } else if (wsUrl.protocol === 'http:') {
        wsUrl.protocol = 'ws:';
    } else if (wsUrl.protocol !== 'wss:' && wsUrl.protocol !== 'ws:') {
        throw new Error(`未対応のMisskey URLプロトコルです: ${wsUrl.protocol}`);
    }

    wsUrl.searchParams.set('i', MISSKEY_TOKEN);
    return wsUrl.toString();
}

function logSafely(level, source, message) {
    void writeLog(level, source, message, null, null).catch((error) => {
        console.error(`[${source}] ログの保存に失敗しました:`, error);
    });
}

function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

function handleHybridNote(note) {
    if (note.mentions?.length > 0) {
        void processMentions(note);
    }

    if (note.text?.includes('ラーベちゃん') && Math.floor(Math.random() * 5) === 0) {
        void createMisskeyReaction(note.id, ':astrolabe_icon:');
        logSafely(
            'info',
            'connectWebSocket_hybrid',
            `ラーベちゃんの投稿にリアクションを追加: ${note.id}`
        );
        return;
    }

    if (!note.text || note.userId === MISSKEY_USER_ID) {
        return;
    }

    let ollamaNoteText = note.text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    ollamaNoteText = ollamaNoteText.replace(/https?:\/\/[^\s]+/g, '');
    ollamaNoteText = ollamaNoteText.replace(/:[a-zA-Z0-9_]+:/g, '');

    const userHost = note.user?.host;
    if (Math.floor(Math.random() * 20) === 0 && userHost === null && ollamaNoteText.length >= 10) {
        void air_reply_ollama(ollamaNoteText, note.id);
        logSafely(
            'info',
            'connectWebSocket_hybrid',
            `エアリプOllama処理を実行_ホストインスタンスの投稿: ${ollamaNoteText}`
        );
        return;
    }

    console.log('エアリプOllama処理はスキップされました', userHost, note.id);
    logSafely(
        'info',
        'connectWebSocket_hybrid',
        `エアリプOllama処理はスキップされました:${userHost} ${ollamaNoteText}`
    );
}

function handleMainMessage(message) {
    if (message.type !== 'channel' || message.body?.type !== 'followed') {
        return;
    }

    logSafely(
        'info',
        'connectWebSocket_main',
        `フォローイベント受信: ${JSON.stringify(message.body)}`
    );
    void processFollow(message.body.body);
}

function calculateRetryDelay(retryCount, error) {
    const maintenance = errorMessage(error).includes('Unexpected server response: 502');
    const baseDelay = maintenance ? MAINTENANCE_RETRY_DELAY_MS : BASE_RETRY_DELAY_MS;
    const exponent = Math.min(Math.max(retryCount - 1, 0), 20);
    const backoffDelay = Math.min(baseDelay * Math.pow(1.5, exponent), MAX_RETRY_DELAY_MS);
    const jitter = Math.floor(backoffDelay * RETRY_JITTER_RATE * Math.random());
    return Math.min(backoffDelay + jitter, MAX_RETRY_DELAY_MS);
}

function createConnectionManager({ name, subscriptions, onMessage }) {
    const source = `connectWebSocket_${name}`;
    let currentWs = null;
    let retryCount = 0;
    let retryTimer = null;
    let retryAt = null;
    let stableTimer = null;
    let connecting = false;
    let connectionPromise = null;
    let resolveConnection = null;

    function getConnectionPromise() {
        if (!connectionPromise) {
            connectionPromise = new Promise((resolve) => {
                resolveConnection = resolve;
            });
        }
        return connectionPromise;
    }

    function resolvePendingConnection(ws) {
        const resolve = resolveConnection;
        connectionPromise = null;
        resolveConnection = null;
        resolve?.(ws);
    }

    function scheduleReconnect(error, closeDescription = '') {
        if (retryTimer || connecting || currentWs?.readyState === WebSocket.OPEN) {
            return;
        }

        retryCount += 1;
        const delay = calculateRetryDelay(retryCount, error);
        retryAt = Date.now() + delay;
        const delaySeconds = Math.ceil(delay / 1000);
        const detail = closeDescription ? ` (${closeDescription})` : '';

        logSafely(
            errorMessage(error).includes('Unexpected server response: 502') ? 'info' : 'error',
            source,
            `WebSocket接続が閉じられました${detail}。${delaySeconds}秒後に再接続します。(試行回数: ${retryCount})`
        );
        console.warn(
            `${name} WebSocket接続が閉じられました。${delaySeconds}秒後に再接続します。`,
            error
        );

        retryTimer = setTimeout(() => {
            retryTimer = null;
            retryAt = null;
            attemptConnection();
        }, delay);
    }

    function handleAttemptFailure(error) {
        connecting = false;
        currentWs = null;
        logSafely('error', source, `WebSocket接続の開始に失敗しました: ${errorMessage(error)}`);
        scheduleReconnect(error);
    }

    function attemptConnection() {
        if (
            connecting ||
            retryTimer ||
            currentWs?.readyState === WebSocket.OPEN ||
            currentWs?.readyState === WebSocket.CONNECTING
        ) {
            return;
        }

        connecting = true;
        let ws;
        try {
            ws = new WebSocket(buildWebSocketUrl(), WS_OPTIONS);
        } catch (error) {
            handleAttemptFailure(error);
            return;
        }

        currentWs = ws;
        let ended = false;
        let lastError = null;
        let pingInterval = null;
        let terminateTimer = null;
        let pongReceived = true;

        function finishSocket(code, reason) {
            if (ended) {
                return;
            }
            ended = true;
            clearInterval(pingInterval);
            clearTimeout(terminateTimer);

            if (currentWs !== ws) {
                return;
            }

            clearTimeout(stableTimer);
            stableTimer = null;
            currentWs = null;
            connecting = false;

            const reasonText = Buffer.isBuffer(reason) ? reason.toString() : String(reason || '');
            const closeDescription = code ? `code=${code}${reasonText ? `, reason=${reasonText}` : ''}` : '';
            scheduleReconnect(lastError || new Error(closeDescription || 'WebSocket connection closed'), closeDescription);
        }

        ws.once('open', () => {
            if (currentWs !== ws || ended) {
                ws.terminate();
                return;
            }

            connecting = false;
            try {
                for (const subscription of subscriptions) {
                    ws.send(JSON.stringify({
                        type: 'connect',
                        body: {
                            channel: subscription.channel,
                            id: subscription.id,
                            params: subscription.params || {}
                        }
                    }));
                }
            } catch (error) {
                lastError = error;
                logSafely('error', source, `チャンネル購読に失敗しました: ${errorMessage(error)}`);
                ws.terminate();
                return;
            }

            pingInterval = setInterval(() => {
                if (ws.readyState !== WebSocket.OPEN) {
                    return;
                }
                if (!pongReceived) {
                    lastError = new Error('pingに対するpongが受信できませんでした');
                    logSafely('error', source, `WebSocketエラー: ${lastError.message}`);
                    ws.terminate();
                    return;
                }
                pongReceived = false;
                ws.ping();
            }, PING_INTERVAL_MS);

            clearTimeout(stableTimer);
            stableTimer = setTimeout(() => {
                if (currentWs === ws && ws.readyState === WebSocket.OPEN) {
                    retryCount = 0;
                }
            }, STABLE_CONNECTION_MS);

            logSafely('info', source, `WebSocket_${name}接続が確立されました`);
            resolvePendingConnection(ws);
        });

        ws.on('message', (data) => {
            if (currentWs !== ws || ended) {
                return;
            }
            try {
                const message = JSON.parse(data.toString());
                onMessage(message);
            } catch (error) {
                logSafely('error', source, `メッセージ処理中にエラーが発生: ${errorMessage(error)}`);
            }
        });

        ws.on('pong', () => {
            pongReceived = true;
        });

        ws.once('error', (error) => {
            lastError = error;
            logSafely('error', source, `WebSocketエラー: ${errorMessage(error)}`);

            if (ws.readyState === WebSocket.CLOSED) {
                finishSocket();
                return;
            }

            try {
                ws.terminate();
                terminateTimer = setTimeout(() => finishSocket(), TERMINATE_GRACE_MS);
            } catch (terminateError) {
                lastError = terminateError;
                finishSocket();
            }
        });

        ws.once('close', (code, reason) => {
            finishSocket(code, reason);
        });
    }

    function connect() {
        if (currentWs?.readyState === WebSocket.OPEN) {
            return Promise.resolve(currentWs);
        }

        const pendingConnection = getConnectionPromise();
        if (!connecting && !retryTimer) {
            attemptConnection();
        }
        return pendingConnection;
    }

    function getStatus() {
        let state = 'NULL';
        if (currentWs) {
            state = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][currentWs.readyState] || 'UNKNOWN';
        } else if (retryTimer) {
            state = 'RETRY_WAIT';
        }

        return {
            connected: currentWs?.readyState === WebSocket.OPEN,
            state,
            retryCount,
            retryAt: retryAt ? new Date(retryAt).toISOString() : null
        };
    }

    return { connect, getStatus };
}

const streamConnection = createConnectionManager({
    name: 'stream',
    subscriptions: [
        { channel: 'hybridTimeline', id: 'hybrid-timeline' },
        { channel: 'globalTimeline', id: 'global-Timeline' },
        { channel: 'main', id: 'main' }
    ],
    onMessage(message) {
        if (message.type !== 'channel') {
            return;
        }

        if (message.body?.id === 'hybrid-timeline' && message.body.type === 'note') {
            handleHybridNote(message.body.body);
        } else if (message.body?.id === 'global-Timeline' && message.body.type === 'note') {
            void processGtlNote(message.body.body);
        } else if (message.body?.id === 'main') {
            handleMainMessage(message);
        }
    }
});

function connectWebSocket_hybrid() {
    return streamConnection.connect();
}

function connectWebSocket_global() {
    return streamConnection.connect();
}

function connectWebSocket_main() {
    return streamConnection.connect();
}

function checkWebSocketStatus() {
    const streamStatus = streamConnection.getStatus();
    return {
        hybrid: { ...streamStatus },
        global: { ...streamStatus },
        main: { ...streamStatus }
    };
}

export { connectWebSocket_hybrid, connectWebSocket_main, connectWebSocket_global, checkWebSocketStatus };
