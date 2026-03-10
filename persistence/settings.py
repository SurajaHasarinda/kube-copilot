"""
PostgreSQL-backed application settings.
"""

import psycopg
from psycopg.rows import dict_row
from config.settings import POSTGRES_URL

def _get_connection():
    conn = psycopg.connect(POSTGRES_URL, row_factory=dict_row)
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        conn.commit()
    return conn

def get_setting(key: str, default: str | None = None) -> str | None:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM settings WHERE key = %s", (key,))
            row = cur.fetchone()
            return row["value"] if row else default
    except Exception as e:
        print(f"Error reading setting {key}: {e}")
        return default
    finally:
        conn.close()

def set_setting(key: str, value: str) -> None:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO settings (key, value) VALUES (%s, %s) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                (key, value)
            )
            conn.commit()
    finally:
        conn.close()

def get_all_settings() -> dict:
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT key, value FROM settings")
            rows = cur.fetchall()
            return {row["key"]: row["value"] for row in rows}
    finally:
        conn.close()
