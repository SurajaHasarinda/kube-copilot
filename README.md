# KubeCopilot 🤖

An AI-powered Kubernetes AIOps agent that diagnoses and manages K3s clusters using **Chain-of-Thought reasoning**. Built with **LangGraph**, **Google Gemini**, and the **Kubernetes Python client**.

Exposes a **secure REST API** for chat UI integration.

## Features

- **Observe** — List resources, read pod logs, describe resource status & events
- **Diagnose** — Chain-of-Thought reasoning (Thought → Action → Observation → Answer)
- **Remediate** — Rolling restarts, scaling, with **human-in-the-loop** safety gate
- **Remember** — PostgreSQL-backed incident memory for detecting recurring issues
- **Secure API** — JWT-authenticated REST API with CORS for chat UI frontends

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Clients                                   │
│              ┌───────────────┐                                │
│              │  Chat UI /    │                                │
│              │  HTTP Client  │                                │
│              └──────┬────────┘                                │
│                     │  REST API                               │
│                     ▼                                         │
│              ┌──────────────┐                                 │
│              │  FastAPI     │                                 │
│              │  main.py     │                                 │
│              │  ┌────────┐  │                                 │
│              │  │JWT Auth│  │                                 │
│              │  └────────┘  │                                 │
│              └──────┬───────┘                                 │
│                     │                                         │
│                     ▼                                         │
│   ┌───────────────────────────────────────┐                  │
│   │         LangGraph Agent               │                  │
│   │  ┌─────────────────────────────────┐  │                  │
│   │  │  agent → router → tools loop   │  │                  │
│   │  │         ↓                       │  │                  │
│   │  │  approval gate (interrupt)     │  │                  │
│   │  └─────────────────────────────────┘  │                  │
│   └───────────────┬───────────────────────┘                  │
│                   │                                           │
│        ┌──────────┼──────────┐                               │
│        ▼          ▼          ▼                               │
│   ┌─────────┐ ┌────────┐ ┌────────┐                         │
│   │K8s Tools│ │ Gemini │ │Postgres│                         │
│   │Observer │ │  LLM   │ │Memory  │                         │
│   │Executor │ │        │ │        │                         │
│   └─────────┘ └────────┘ └────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url> && cd KubeCopilot
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS
pip install -r requirements.txt
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env — at minimum set:
#   GOOGLE_API_KEY=your-gemini-api-key
#   API_KEY=your-random-api-key
#   JWT_SECRET_KEY=your-random-64-char-hex
```

### 3. Run the API Server

```bash
python main.py                              # Default: 0.0.0.0:8000
python main.py --port 9000 --reload         # Dev mode with hot-reload
```

API docs available at `http://localhost:8000/docs` (Swagger) and `/redoc`.

## Project Structure

```
KubeCopilot/
├── main.py               # API server entry point (FastAPI + uvicorn)
├── config/
│   ├── settings.py       # Central configuration (env vars)
│   ├── auth.py           # API key + JWT authentication
│   └── schemas.py        # Pydantic request/response models
├── controllers/
│   ├── auth_controller.py      # POST /auth/token
│   ├── chat_controller.py      # POST /chat, POST /chat/approve
│   ├── health_controller.py    # GET /health
│   ├── incident_controller.py  # GET /incidents
│   └── session_controller.py   # GET/DELETE /sessions
├── services/
│   ├── agent_service.py        # Agent graph invocation & approval flow
│   ├── health_service.py       # K8s connectivity checks
│   ├── incident_service.py     # PostgreSQL incident queries
│   └── session_service.py      # In-memory session manager
├── agent/
│   ├── state.py          # LangGraph state schema
│   ├── tools.py          # LangChain tool wrappers
│   ├── graph.py          # LangGraph graph with interrupt-based approval
│   └── prompts.py        # System prompts & CoT templates
├── k8s_tools/
│   ├── client.py         # K8s client initialization
│   ├── observer.py       # Read-only tools (list, logs, describe)
│   └── executor.py       # Write tools (restart, scale)
├── persistence/
│   └── memory.py         # PostgreSQL incident memory
├── requirements.txt
└── .env.example
```

## API Reference

### Authentication Flow

```
1. Client sends API key           →  POST /api/v1/auth/token
                                      Header: X-API-Key: <your-api-key>
2. Server returns JWT             ←  { "access_token": "eyJ...", "token_type": "bearer" }
3. Client uses JWT for all calls  →  Header: Authorization: Bearer eyJ...
```

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/token` | API Key | Exchange API key for JWT |
| `POST` | `/api/v1/chat` | JWT | Send a message to the agent |
| `POST` | `/api/v1/chat/approve` | JWT | Approve/deny a pending write action |
| `GET` | `/api/v1/sessions` | JWT | List active sessions |
| `DELETE` | `/api/v1/sessions/{id}` | JWT | Delete a session |
| `GET` | `/api/v1/incidents` | JWT | Get incident history |
| `GET` | `/api/v1/health` | None | Health & K8s connectivity check |

### Chat Flow (API)

```bash
# 1. Get a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/token \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"client_name": "my-chat-ui"}' | jq -r '.access_token')

# 2. Send a message
curl -s -X POST http://localhost:8000/api/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What pods are running?", "namespace": "default"}'

# Response: { "session_id": "abc123", "type": "response", "content": "..." }

# 3. If agent wants to restart something...
# Response: { "session_id": "abc123", "type": "approval_required", "approval_info": {...} }

# 4. Approve or deny
curl -s -X POST http://localhost:8000/api/v1/chat/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "abc123", "approved": true}'
```

## Safety Model

All cluster-mutating operations go through a **human-in-the-loop approval gate**:

1. Agent proposes a plan with tool name and arguments
2. Human reviews and approves or denies via the `/chat/approve` endpoint
3. If denied, the agent acknowledges and suggests alternatives

This is powered by LangGraph's `interrupt()` mechanism.

## License

MIT
