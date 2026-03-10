import atexit
from psycopg_pool import ConnectionPool
from config.settings import POSTGRES_URL

pool = ConnectionPool(conninfo=POSTGRES_URL, min_size=1, max_size=10, kwargs={"autocommit": True}, open=True)

def get_pool() -> ConnectionPool:
    return pool

@atexit.register
def close_pool():
    """Ensure the pool gracefully closes upon shutdown."""
    if pool:
        pool.close()
