import uuid
from datetime import datetime, timezone
from dataclasses import dataclass
from config.database import get_pool
from psycopg.rows import dict_row

@dataclass
class Session:
    """Represents a single agent conversation session."""

    session_id: str
    namespace: str
    created_at: str
    message_count: int = 0
    has_pending_approval: bool = False

    @property
    def thread_id(self) -> str:
        """The LangGraph thread ID for this session's checkpointer."""
        return f"api-{self.session_id}"


class SessionService:
    """Thread-safe PostgreSQL session store."""

    def __init__(self):
        self._init_db()

    def _init_db(self):
        """Ensure the sessions table exists."""
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    CREATE TABLE IF NOT EXISTS sessions (
                        session_id TEXT PRIMARY KEY,
                        namespace TEXT,
                        created_at TEXT,
                        message_count INTEGER DEFAULT 0,
                        has_pending_approval BOOLEAN DEFAULT FALSE
                    )
                ''')
            conn.commit()

    def _row_to_session(self, row) -> Session:
        return Session(
            session_id=row['session_id'],
            namespace=row['namespace'],
            created_at=row['created_at'],
            message_count=row['message_count'],
            has_pending_approval=bool(row['has_pending_approval'])
        )

    def create_session(self, namespace: str) -> Session:
        """Create a new session and return it."""
        session_id = uuid.uuid4().hex[:12]
        created_at = datetime.now(timezone.utc).isoformat()
        
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    INSERT INTO sessions (session_id, namespace, created_at, message_count, has_pending_approval)
                    VALUES (%s, %s, %s, %s, %s)
                ''', (session_id, namespace, created_at, 0, False))
            conn.commit()
            
        return Session(
            session_id=session_id,
            namespace=namespace,
            created_at=created_at,
            message_count=0,
            has_pending_approval=False
        )

    def get_session(self, session_id: str) -> Session | None:
        """Retrieve a session by ID, or None if not found."""
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                row = cur.execute('SELECT * FROM sessions WHERE session_id = %s', (session_id,)).fetchone()
                if row:
                    return self._row_to_session(row)
        return None

    def get_or_create_session(self, session_id: str, namespace: str) -> Session:
        """Get an existing session or create a new one."""
        if session_id:
            session = self.get_session(session_id)
            if session:
                return session
        return self.create_session(namespace)
        
    def save_session(self, session: Session):
        """Persist changes to the session object."""
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    UPDATE sessions 
                    SET message_count = %s, has_pending_approval = %s
                    WHERE session_id = %s
                ''', (session.message_count, session.has_pending_approval, session.session_id))
            conn.commit()

    def delete_session(self, session_id: str) -> bool:
        """Delete a session. Returns True if found and deleted."""
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM sessions WHERE session_id = %s', (session_id,))
                rowcount = cur.rowcount
            conn.commit()
        return rowcount > 0

    def list_sessions(self) -> list[Session]:
        """Return all active sessions."""
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                rows = cur.execute('SELECT * FROM sessions ORDER BY created_at DESC').fetchall()
        return [self._row_to_session(row) for row in rows]

    @property
    def count(self) -> int:
        """Return the total number of sessions."""
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                row = cur.execute('SELECT COUNT(*) FROM sessions').fetchone()
                return row[0] if row else 0


# Module-level singleton
session_service = SessionService()
