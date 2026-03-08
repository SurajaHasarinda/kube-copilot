/**
 * KubeCopilot Frontend Types
 */

export interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in_minutes: number;
}

export interface UserInfo {
    id: string;
    username: string;
    email?: string | null;
    created_at: string;
}

export interface ApprovalAction {
    tool: string;
    args: any;
}

export interface ApprovalInfo {
    message: string;
    actions: ApprovalAction[];
}

export interface ChatResponse {
    session_id: string;
    type: 'response' | 'approval_required' | 'error';
    content: string;
    approval_info: ApprovalInfo | null;
}

export interface SessionInfo {
    session_id: string;
    namespace: string;
    created_at: string;
    message_count: number;
    has_pending_approval: boolean;
}

export interface SessionListResponse {
    sessions: SessionInfo[];
}

export interface MessageResponse {
    role: 'human' | 'agent';
    content: string;
}

export interface SessionHistoryResponse {
    messages: MessageResponse[];
}

export interface IncidentRecord {
    id: number;
    timestamp: string;
    namespace: string;
    query: string;
    diagnosis: string;
}

export interface IncidentListResponse {
    incidents: IncidentRecord[];
}

export interface HealthResponse {
    status: string;
    k8s_connected: boolean;
    active_sessions: number;
}
