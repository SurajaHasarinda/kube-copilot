"""
Pydantic request / response schemas for the API.
"""

from pydantic import BaseModel, Field


# ── Auth ─────────────────────────────────────────────────────────────────────


class TokenRequest(BaseModel):
    """Request body for the token exchange endpoint (optional extra fields)."""
    username: str = Field(
        default="admin",
        description="Admin username.",
    )
    password: str = Field(
        default="",
        description="Admin password.",
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


# ── Chat ─────────────────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    """Send a message to the agent."""
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str = Field(
        default="",
        description="Session ID for multi-turn conversations. "
        "Leave empty to create a new session.",
    )
    namespace: str = Field(
        default="",
        description="Kubernetes namespace. Defaults to the server's configured namespace.",
    )


class ApprovalAction(BaseModel):
    tool: str
    args: dict


class ApprovalInfo(BaseModel):
    """Details about a pending write action."""
    message: str
    actions: list[ApprovalAction]


class ChatResponse(BaseModel):
    """Response from the agent."""
    session_id: str
    type: str = Field(
        description="Response type: 'response' | 'approval_required' | 'error'"
    )
    content: str = Field(
        default="",
        description="The agent's text response (when type='response').",
    )
    approval_info: ApprovalInfo | None = Field(
        default=None,
        description="Details of the pending write action (when type='approval_required').",
    )


class ApprovalRequest(BaseModel):
    """Approve or deny a pending write action."""
    session_id: str = Field(..., description="The session with the pending action.")
    approved: bool = Field(..., description="True to approve, False to deny.")


# ── Sessions ─────────────────────────────────────────────────────────────────


class SessionInfo(BaseModel):
    session_id: str
    namespace: str
    created_at: str
    message_count: int
    has_pending_approval: bool


class SessionListResponse(BaseModel):
    sessions: list[SessionInfo]


class MessageResponse(BaseModel):
    role: str
    content: str


class SessionHistoryResponse(BaseModel):
    messages: list[MessageResponse]


# ── Incidents ────────────────────────────────────────────────────────────────


class IncidentRecord(BaseModel):
    id: int
    timestamp: str
    namespace: str
    query: str
    diagnosis: str


class IncidentListResponse(BaseModel):
    incidents: list[IncidentRecord]


# ── Health ───────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    k8s_connected: bool
    active_sessions: int
