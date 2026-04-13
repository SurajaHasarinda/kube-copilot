import atexit
import logging
import threading

from psycopg_pool import ConnectionPool
from config.settings import POSTGRES_URL

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None
_pool_lock = threading.Lock()


def get_pool() -> ConnectionPool:
    """Return the shared connection pool, creating it lazily on first use.

    The pool is created lazily (instead of at import time) so that the
    FastAPI server can bind its port and pass Kubernetes startup/liveness
    probes before any Postgres connectivity is required.
    """
    global _pool
    if _pool is not None:
        return _pool

    with _pool_lock:
        # Double-checked locking
        if _pool is not None:
            return _pool
        logger.info("Creating PostgreSQL connection pool")
        _pool = ConnectionPool(
            conninfo=POSTGRES_URL,
            min_size=1,
            max_size=10,
            kwargs={"autocommit": True},
            open=True,
        )
    return _pool


@atexit.register
def close_pool():
    """Ensure the pool gracefully closes upon shutdown."""
    if _pool is not None:
        _pool.close()
