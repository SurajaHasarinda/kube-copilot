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


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class ChangeUsernameRequest(BaseModel):
    new_username: str = Field(..., min_length=3)
    password: str = Field(..., description="Current password for verification")


class ChangeEmailRequest(BaseModel):
    new_email: str = Field(..., description="New email address for receiving critical alerts.")
    password: str = Field(..., description="Current password for verification")


class ChangeNotificationsRequest(BaseModel):
    enabled: bool

class UserInfoResponse(BaseModel):
    id: str
    username: str
    email: str | None = None
    notifications_enabled: bool = True
    created_at: str


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


# ── Cluster Anomalies ────────────────────────────────────────────────────────


class AnomalyRecord(BaseModel):
    id: int
    timestamp: str
    severity: str
    category: str
    namespace: str
    resource_type: str
    resource_name: str
    message: str
    details: str = ""
    logs: str = ""
    node_name: str = ""
    resolved: bool = False


class AnomalyListResponse(BaseModel):
    anomalies: list[AnomalyRecord]
    stats: dict = {}


class AnomalyStatsResponse(BaseModel):
    critical: int = 0
    errors: int = 0
    warnings: int = 0
    resolved: int = 0
    total: int = 0


# ── Health ───────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    k8s_connected: bool
    active_sessions: int

