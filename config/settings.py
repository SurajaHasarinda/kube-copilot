import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


def get_env_int(name: str, default: int) -> int:
    """Safely get an environment variable as an integer."""
    val = os.getenv(name)
    if not val or not val.strip():
        return default
    try:
        return int(val)
    except ValueError:
        return default

# ── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

# ── Google Gemini ────────────────────────────────────────────────────────────
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.0-flash")

# ── Kubernetes ───────────────────────────────────────────────────────────────
KUBECONFIG_PATH: str = os.getenv("KUBECONFIG_PATH", "")
DEFAULT_NAMESPACE: str = os.getenv("DEFAULT_NAMESPACE", "default")

# ── Persistence ──────────────────────────────────────────────────────────────
POSTGRES_URL: str = os.getenv("POSTGRES_URL", "postgresql://user:password@localhost:5432/kube-copilot")

# ── API Server ───────────────────────────────────────────────────────────────
JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-me-to-a-random-64-char-hex-string")
JWT_ALGORITHM: str = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = get_env_int("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 480)

ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")

CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    if origin.strip()
]

API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
API_PORT: int = get_env_int("API_PORT", 8321)

# ── Alert Email ──────────────────────────────────────────────────────────────
SMTP_SERVER: str = os.getenv("SMTP_SERVER", "localhost")
SMTP_PORT: int = get_env_int("SMTP_PORT", 1025)
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASS: str = os.getenv("SMTP_PASS", "")
FROM_EMAIL: str = os.getenv("FROM_EMAIL", "alerts@kube-copilot.local")
