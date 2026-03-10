/**
 * KubeCopilot Types
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
    notifications_enabled?: boolean;
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

export interface Anomaly {
    id: number;
    timestamp: string;
    severity: string;
    category: string;
    namespace: string;
    resource_type: string;
    resource_name: string;
    message: string;
    details: string;
    logs: string;
    node_name: string;
    resolved: boolean;
}

export interface AnomalyStats {
    critical: number;
    errors: number;
    warnings: number;
    resolved: number;
    total: number;
}

export interface ClusterNode {
    name: string;
    type: string;
    children?: ClusterNode[];
    status?: string;
    replicas?: string;
    available?: number;
    ip?: string;
    node?: string;
    restarts?: number;
    cluster_ip?: string;
    service_type?: string;
    ports?: string[];
    data_keys?: string[];
    secret_type?: string;
    count?: number;
    created_at?: string;
}
