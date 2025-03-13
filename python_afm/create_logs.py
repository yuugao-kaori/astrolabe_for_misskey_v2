import os
import json
import psycopg2
from dotenv import load_dotenv
from datetime import datetime

class LogManager:
    def __init__(self, db_params):
        self.db_params = db_params

    def write_log(self, level, source, message, metadata=None):
        try:
            with psycopg2.connect(**self.db_params) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO logs (level, source, message, metadata, created_at)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (
                            level,
                            source,
                            message,
                            json.dumps(metadata) if metadata else None,
                            datetime.now()
                        )
                    )
                    conn.commit()
            return True
        except Exception as e:
            print(f"Error writing to log: {str(e)}")
            return False
