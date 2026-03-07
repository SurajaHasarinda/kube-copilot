"""
Session management service.

Manages in-memory sessions that link API conversations to
LangGraph checkpointer threads. Each session tracks namespace,
message count, and pending approval status.
"""

import uuid
from datetime import datetime, timezone
from dataclasses import dataclass


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
    """Thread-safe in-memory session store."""

    def __init__(self):
        self._sessions: dict[str, Session] = {}

    def create_session(self, namespace: str) -> Session:
        """Create a new session and return it."""
        session_id = uuid.uuid4().hex[:12]
        session = Session(
            session_id=session_id,
            namespace=namespace,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Session | None:
        """Retrieve a session by ID, or None if not found."""
        return self._sessions.get(session_id)

    def get_or_create_session(self, session_id: str, namespace: str) -> Session:
        """Get an existing session or create a new one."""
        if session_id and session_id in self._sessions:
            return self._sessions[session_id]
        return self.create_session(namespace)

    def delete_session(self, session_id: str) -> bool:
        """Delete a session. Returns True if found and deleted."""
        return self._sessions.pop(session_id, None) is not None

    def list_sessions(self) -> list[Session]:
        """Return all active sessions."""
        return list(self._sessions.values())

    @property
    def count(self) -> int:
        """Number of active sessions."""
        return len(self._sessions)


# Module-level singleton
session_service = SessionService()
