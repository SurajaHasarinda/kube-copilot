from datetime import datetime, timezone
import uuid
import bcrypt
from config.database import get_pool
from psycopg.rows import dict_row
from config.settings import ADMIN_USERNAME, ADMIN_PASSWORD

class AuthService:
    def __init__(self):
        self._init_db()

    def _init_db(self):
        """Ensure the users table exists and is seeded with a default user if empty."""
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute('''
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        username TEXT UNIQUE,
                        password_hash TEXT,
                        created_at TEXT
                    )
                ''')
                
                # Check if we need to seed the default admin
                cur.execute('SELECT COUNT(*) as c FROM users')
                count = cur.fetchone()[0]
                if count == 0:
                    user_id = uuid.uuid4().hex
                    hashed_password = self.get_password_hash(ADMIN_PASSWORD)
                    created_at = datetime.now(timezone.utc).isoformat()
                    cur.execute(
                        'INSERT INTO users (id, username, password_hash, created_at) VALUES (%s, %s, %s, %s)',
                        (user_id, ADMIN_USERNAME, hashed_password, created_at)
                    )
            conn.commit()

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        if not plain_password or not hashed_password:
            return False
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

    def get_password_hash(self, password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
    def authenticate_user(self, username: str, password: str) -> bool:
        """Verify the username and password against the database."""
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                row = cur.execute('SELECT password_hash FROM users WHERE username = %s', (username,)).fetchone()
                if row is None:
                    return False
                return self.verify_password(password, row['password_hash'])

    def change_password(self, username: str, current_password: str, new_password: str) -> bool:
        """Change the password for a user after verifying the current one."""
        if not self.authenticate_user(username, current_password):
            return False
            
        hashed_password = self.get_password_hash(new_password)
        with get_pool().connection() as conn:
            with conn.cursor() as cur:
                cur.execute('UPDATE users SET password_hash = %s WHERE username = %s', (hashed_password, username))
                if cur.rowcount > 0:
                    conn.commit()
                    return True
        return False

    def get_user_info(self, username: str) -> dict | None:
        """Get user information by username."""
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                row = cur.execute(
                    'SELECT id, username, created_at FROM users WHERE username = %s',
                    (username,)
                ).fetchone()
                return dict(row) if row else None

    def change_username(self, old_username: str, new_username: str, password: str) -> bool:
        """Change the username after verifying the password."""
        if not self.authenticate_user(old_username, password):
            return False
        
        # Check if new username already exists
        with get_pool().connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                existing = cur.execute(
                    'SELECT username FROM users WHERE username = %s',
                    (new_username,)
                ).fetchone()
                if existing:
                    return False
                
                # Update username
                cur.execute(
                    'UPDATE users SET username = %s WHERE username = %s',
                    (new_username, old_username)
                )
                if cur.rowcount > 0:
                    conn.commit()
                    return True
        return False

auth_service = AuthService()
