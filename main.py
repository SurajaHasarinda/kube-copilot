"""
KubeCopilot — API Server entry point.

Usage:
    python main.py
    python main.py --host 0.0.0.0 --port 8321
"""

import argparse
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import API_HOST, API_PORT, CORS_ORIGINS, GOOGLE_API_KEY

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

from controllers import (
    auth_controller,
    chat_controller,
    incident_controller,
    session_controller,
    health_controller,
    cluster_controller,
    settings_controller,
)

# ── Module-level graph reference (set during lifespan) ────────────────────────
agent_graph = None
_app_ready = False

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """
    Startup: kick off heavy init (graph build, DB setup) in a background
    thread so Uvicorn can bind the port and pass K8s probes immediately.
    Shutdown: cleanup.
    """
    import threading
    import time

    def _background_init():
        """Run all blocking startup work off the main thread."""
        global agent_graph, _app_ready

        try:
            from agent.graph import build_graph
            agent_graph = build_graph()
            logger.info("Agent graph compiled and ready")
        except Exception:
            logger.exception("Failed to build agent graph — chat will be unavailable")

        _app_ready = True

        # Start the periodic anomaly scanner after a warm-up delay.
        time.sleep(60)
        logger.info("Background anomaly scanner started")

        from services.cluster_monitor_service import cluster_monitor_service
        while True:
            try:
                cluster_monitor_service.scan_cluster()
                logger.info("Background scan completed")
            except Exception:
                logger.exception("Background scan error")
            time.sleep(300)

    init_thread = threading.Thread(target=_background_init, daemon=True)
    init_thread.start()

    yield
    logger.info("Server shutting down")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="KubeCopilot API",
    description=(
        "AI-powered Kubernetes agent with Chain-of-Thought reasoning. "
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register controllers ─────────────────────────────────────────────────────

app.include_router(health_controller.router)
app.include_router(settings_controller.router)
app.include_router(auth_controller.router)
app.include_router(chat_controller.router)
app.include_router(incident_controller.router)
app.include_router(session_controller.router)
app.include_router(cluster_controller.router)


@app.get("/health", include_in_schema=False)
async def root_health():
    """Redirect root health to api health."""
    return {"status": "healthy", "version": "1.0.0"}


# ── Static Files (Frontend) ───────────────────────────────────────────────────

from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Serve frontend static files if available (for production/docker)
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


# ── CLI launcher ──────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="KubeCopilot API Server")
    parser.add_argument("--host", default=API_HOST, help=f"Bind host (default: {API_HOST})")
    parser.add_argument("--port", type=int, default=API_PORT, help=f"Bind port (default: {API_PORT})")
    parser.add_argument("--reload", action="store_true", help="Enable hot-reload for development")
    args = parser.parse_args()

    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║         KubeCopilot — API Server                             ║
║                                                               ║
║   Docs:  http://{args.host}:{args.port}/docs                         ║
║   Redoc: http://{args.host}:{args.port}/redoc                        ║
╚═══════════════════════════════════════════════════════════════╝
""")

    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
