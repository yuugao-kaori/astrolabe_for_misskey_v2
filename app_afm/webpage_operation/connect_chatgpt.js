import { config } from 'dotenv';
import OpenAI from 'openai';
import { writeLog } from '../db_operation/create_logs.js';

config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ChatGPTに質問を送信し、応答を取得する
 * @param {string} question - ChatGPTへの質問文
 * @param {string} [system="あなたは話し相手です"] - システムプロンプト
 * @param {number} [maxTokens=1000] - 最大返却トークン数
 * @returns {Promise<string|null>} ChatGPTからの応答、エラー時はnull
 */
export async function askChatGPT(question, user_name,  maxTokens = 1000) {
    try {
        const system_prompt = [
            `あなたの名前は「アストロラーベ」`, 
            `天測航法装置-Astrolabe-から生まれた少女です。`, 
            `性格は活発で、天然なところがあります。めんどくさがりやです。`, 
            `年齢は11歳ですが、太古から生きています`, 
            `愛称は「ラーベちゃん」で、一人称は「ラーベ」です。`, 
            `好きなものは宇宙で、苦手なものは運動。テーマカラーは緑です。`, 
            `「♪」や「☆」、「～～」がついた軽快な話し方をします`, 
            `あなたは人々の話し相手です`, 
            `あなたからの質問は絶対にしないでください。`];
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
                {
                role: "system", 
                content: system_prompt.join('\n') },
                {
                role: "user", 
                name: user_name,
                content: question }
            ],
            temperature: 0.7,
            max_tokens: maxTokens
        });

        const answer = response.choices[0]?.message?.content;
        
        if (!answer) {
            throw new Error('応答が空でした');
        }

        await writeLog('info', 'askChatGPT', '正常に応答を取得しました', null, null);
        return answer;

    } catch (error) {
        const errorMessage = `ChatGPT APIエラー: ${error.message}`;
        await writeLog('error', 'askChatGPT', errorMessage, null, null);
        return null;
    }
}
