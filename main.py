"""
KubeCopilot — API Server entry point.

Usage:
    python main.py
    python main.py --host 0.0.0.0 --port 8321
"""

import argparse
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import API_HOST, API_PORT, CORS_ORIGINS, GOOGLE_API_KEY

from controllers import (
    auth_controller,
    chat_controller,
    incident_controller,
    session_controller,
    health_controller,
    cluster_controller,
)

# ── Module-level graph reference (set during lifespan) ────────────────────────
agent_graph = None


@asynccontextmanager
async def lifespan(application: FastAPI):
    """
    Startup: build the agent graph once.
    Shutdown: cleanup (currently a no-op).
    """
    global agent_graph

    if not GOOGLE_API_KEY:
        raise RuntimeError(
            "GOOGLE_API_KEY is not set. Copy .env.example to .env and configure it."
        )

    from agent.graph import build_graph
    agent_graph = build_graph()
    print("✅ Agent graph compiled and ready.")

    # Start the periodic anomaly scanner in the background
    import threading
    import time
    from services.cluster_monitor_service import cluster_monitor_service

    def run_periodic_scan():
        print("🚀 Background anomaly scanner started.")
        while True:
            try:
                # Run a full cluster scan
                cluster_monitor_service.scan_cluster()
                print("⏱️  Background scan completed.")
            except Exception as e:
                print(f"❌ Background scan error: {e}")
            
            # Wait for 5 minutes before next scan
            time.sleep(300)

    scanner_thread = threading.Thread(target=run_periodic_scan, daemon=True)
    scanner_thread.start()

    yield
    print("👋 Server shutting down.")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="KubeCopilot API",
    description=(
        "AI-powered Kubernetes AIOps agent with Chain-of-Thought reasoning. "
        "Diagnose and manage your K3s cluster through a secure REST API."
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
app.include_router(auth_controller.router)
app.include_router(chat_controller.router)
app.include_router(incident_controller.router)
app.include_router(session_controller.router)
app.include_router(cluster_controller.router)


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
