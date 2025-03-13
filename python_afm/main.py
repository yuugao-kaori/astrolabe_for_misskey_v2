import os
from dotenv import load_dotenv
from text_processor import TextProcessor
from create_logs import LogManager
from datetime import datetime
import json
from flask import Flask, jsonify, send_file, current_app
import tempfile

app = Flask(__name__)

# グローバル変数の定義
processor = None
log_manager = None

def get_db_params():
    load_dotenv()
    return {
        'dbname': os.getenv('POSTGRES_DB'),
        'user': os.getenv('POSTGRES_USER'),
        'password': os.getenv('POSTGRES_PASSWORD'),
        'host': os.getenv('POSTGRES_HOST'),
        'host': 'db-afm',  # コンテナ名を直接指定

        'port': os.getenv('POSTGRES_PORT')
    }

# アプリケーション初期化時に実行される関数
def init_app():
    with app.app_context():
        db_params = get_db_params()
        global processor, log_manager
        processor = TextProcessor(db_params)
        log_manager = LogManager(db_params)
        
        log_manager.write_log(
            'INFO',
            'system',
            'Application initialized',
            metadata={'host': '0.0.0.0', 'port': 3000}
        )

# アプリケーション起動前に初期化を実行
init_app()

@app.route('/generate/text', methods=['GET'])
def generate_text():
    try:
        texts = processor.get_texts_from_db()
        texts_wordcloud = processor.get_texts_from_db_wordcloud()
        if not texts:
            log_manager.write_log(
                'WARNING',
                'text_generator',
                'No texts found in database'
            )
            return jsonify({'error': 'データベースにテキストが見つかりませんでした'}), 404

        try:
            generated_text = processor.generate_markov_text(texts)
            
            log_manager.write_log(
                'INFO',
                'text_generator',
                'テキストの生成に成功しました',
                metadata={'text_length': len(generated_text)}
            )

            return jsonify({'text': generated_text})

        except ValueError as ve:
            # データ不足などの検証エラー
            log_manager.write_log(
                'WARNING',
                'text_generator',
                str(ve),
                metadata={'error_type': 'ValueError'}
            )
            return jsonify({'error': str(ve)}), 400

        except RuntimeError as re:
            # 生成失敗エラー
            log_manager.write_log(
                'ERROR',
                'text_generator',
                str(re),
                metadata={'error_type': 'RuntimeError'}
            )
            return jsonify({'error': str(re)}), 500

    except Exception as e:
        # 予期しないエラー
        log_manager.write_log(
            'ERROR',
            'text_generator',
            str(e),
            metadata={'error_type': type(e).__name__}
        )
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500

@app.route('/generate/wordcloud', methods=['GET'])
def generate_wordcloud():
    try:
        texts_wordcloud = processor.get_texts_from_db_wordcloud()
        if not texts_wordcloud:
            log_manager.write_log(
                'WARNING',
                'generate_wordcloud',
                'No texts_wordcloud found in database'
            )
            return jsonify({'error': 'テキストが見つかりませんでした'}), 404

        # 一時ファイルのみ生成
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
        temp_filename = temp_file.name
        
        # ワードクラウドを生成
        wordcloud = processor.generate_wordcloud(texts_wordcloud, temp_filename)
        if wordcloud is None:
            return jsonify({'error': 'ワードクラウドの生成に失敗しました'}), 500

        log_manager.write_log(
            'INFO',
            'generate_wordcloud',
            'ワードクラウドの生成に成功しました',
            metadata={
                'temp_file': temp_filename
            }
        )

        # 画像を直接返却
        return send_file(
            temp_filename,
            mimetype='image/png',
            as_attachment=True,
            download_name='wordcloud.png'
        )

    except Exception as e:
        log_manager.write_log(
            'ERROR',
            'generate_wordcloud',
            str(e),
            metadata={'error_type': type(e).__name__}
        )
        return jsonify({'error': 'サーバーエラーが発生しました'}), 500
    finally:
        # 一時ファイルを削除
        if 'temp_filename' in locals():
            os.unlink(temp_filename)

if __name__ == "__main__":
    try:
        db_params = get_db_params()
        processor = TextProcessor(db_params)
        log_manager = LogManager(db_params)
        
        # 起動時のログ記録
        log_manager.write_log(
            'INFO',
            'system',
            'Flask application started',
            metadata={'host': '0.0.0.0', 'port': 3000}
        )
        app.run(host='0.0.0.0', port=3000)

        generated_text = processor.generate_markov_text(texts)
        print(generated_text)

    except Exception as e:
        print(f"Initialization error: {str(e)}")
        if log_manager:
            log_manager.write_log(
                'ERROR',
                'system',
                'Application initialization failed',
                metadata={'error': str(e)}
            )
        exit(1)  # exit() をif文のブロック内に移動

