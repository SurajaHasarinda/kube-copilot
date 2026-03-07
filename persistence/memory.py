"""
PostgreSQL-backed incident memory.

Allows the agent to "remember" past diagnoses across sessions so it can
detect recurring patterns (e.g., "This pod has crashed 3 times today").
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone
from config.settings import POSTGRES_URL


def _get_connection():
    """Get a connection to the PostgreSQL database, creating tables if needed."""
    conn = psycopg2.connect(POSTGRES_URL, cursor_factory=RealDictCursor)
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id          SERIAL PRIMARY KEY,
                timestamp   TEXT NOT NULL,
                namespace   TEXT NOT NULL,
                query       TEXT NOT NULL,
                diagnosis   TEXT NOT NULL
            )
        """)
        conn.commit()
    return conn


def save_incident(namespace: str, query: str, diagnosis: str) -> None:
    """Save an incident record to the database."""
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO incidents (timestamp, namespace, query, diagnosis) VALUES (%s, %s, %s, %s)",
                (
                    datetime.now(timezone.utc).isoformat(),
                    namespace,
                    query,
                    diagnosis,
                ),
            )
            conn.commit()
    finally:
        conn.close()


def get_recent_incidents(namespace: str | None = None, limit: int = 10) -> list[dict]:
    """
    Retrieve recent incidents, optionally filtered by namespace.

    Returns a list of dicts with keys: id, timestamp, namespace, query, diagnosis.
    """
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            if namespace:
                cur.execute(
                    "SELECT * FROM incidents WHERE namespace = %s ORDER BY id DESC LIMIT %s",
                    (namespace, limit),
                )
            else:
                cur.execute(
                    "SELECT * FROM incidents ORDER BY id DESC LIMIT %s",
                    (limit,),
                )
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    finally:
        conn.close()


def get_incident_count_today(namespace: str) -> int:
    """Count incidents recorded today for a given namespace."""
    conn = _get_connection()
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) as cnt FROM incidents WHERE namespace = %s AND timestamp LIKE %s",
                (namespace, f"{today}%"),
            )
            row = cur.fetchone()
            return row["cnt"] if row else 0
    finally:
        conn.close()
