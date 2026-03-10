import axios from 'axios';
import { TokenResponse, ChatResponse, SessionListResponse, HealthResponse, SessionHistoryResponse, UserInfo } from './types';

// Setup base configuration for axios client
const apiClient = axios.create({
    baseURL: '/api/v1',
    timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/#/login';
        }
        return Promise.reject(error);
    }
);

export const api = {
    isAuthenticated: (): boolean => {
        return !!localStorage.getItem('token');
    },

    login: async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await axios.post<TokenResponse>('/api/v1/auth/token', {
                username,
                password
            });
            localStorage.setItem('token', response.data.access_token);
            return true;
        } catch (error) {
            console.error('Login Error:', error);
            return false;
        }
    },

    getUserInfo: async (): Promise<UserInfo | null> => {
        try {
            const response = await apiClient.get<UserInfo>('/auth/me');
            return response.data;
        } catch (error) {
            console.error('Get user info error:', error);
            return null;
        }
    },

    changePassword: async (currentPassword: string, newPassword: string): Promise<boolean> => {
        try {
            await apiClient.post('/auth/change-password', {
                current_password: currentPassword,
                new_password: newPassword
            });
            return true;
        } catch (error) {
            console.error('Password change error:', error);
            return false;
        }
    },

    changeUsername: async (newUsername: string, password: string): Promise<{ success: boolean, token?: string }> => {
        try {
            const response = await apiClient.post<{ message: string, access_token: string, expires_in_minutes: number }>('/auth/change-username', {
                new_username: newUsername,
                password
            });
            // Update stored token
            if (response.data.access_token) {
                localStorage.setItem('token', response.data.access_token);
                return { success: true, token: response.data.access_token };
            }
            return { success: false };
        } catch (error) {
            console.error('Username change error:', error);
            return { success: false };
        }
    },

    changeEmail: async (newEmail: string, password: string): Promise<boolean> => {
        try {
            await apiClient.post('/auth/change-email', {
                new_email: newEmail,
                password
            });
            return true;
        } catch (error) {
            console.error('Email change error:', error);
            return false;
        }
    },

    changeNotifications: async (enabled: boolean): Promise<boolean> => {
        try {
            await apiClient.post('/auth/notifications', { enabled });
            return true;
        } catch (error) {
            console.error('Notifications toggle error:', error);
            return false;
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        window.location.reload();
    },

    sendMessage: async (message: string, sessionId: string, namespace: string): Promise<ChatResponse> => {
        const response = await apiClient.post<ChatResponse>('/chat', {
            message,
            session_id: sessionId,
            namespace
        }, { timeout: 300000 }); // 5 minutes timeout for AI processing
        return response.data;
    },

    approveAction: async (sessionId: string, approved: boolean): Promise<ChatResponse> => {
        const response = await apiClient.post<ChatResponse>('/chat/approve', {
            session_id: sessionId,
            approved
        }, { timeout: 300000 }); // 5 minutes timeout for AI processing
        return response.data;
    },

    getSessions: async (): Promise<SessionListResponse> => {
        const response = await apiClient.get<SessionListResponse>('/sessions');
        return response.data;
    },

    deleteSession: async (sessionId: string): Promise<void> => {
        await apiClient.delete(`/sessions/${sessionId}`);
    },

    getSessionHistory: async (sessionId: string): Promise<SessionHistoryResponse> => {
        const response = await apiClient.get<SessionHistoryResponse>(`/sessions/${sessionId}/history`);
        return response.data;
    },

    getHealth: async (): Promise<HealthResponse> => {
        // Health does not require auth, but we can use the same client
        const response = await axios.get<HealthResponse>('/api/v1/health');
        return response.data;
    },

    getClusterStructure: async (): Promise<any> => {
        try {
            const response = await apiClient.get('/cluster/structure');
            return response.data;
        } catch (error) {
            console.error('Cluster structure fetch error:', error);
            return { error: 'Failed to fetch cluster structure' };
        }
    },

    scanCluster: async (): Promise<any> => {
        try {
            const response = await apiClient.post('/cluster/scan', {}, { timeout: 120000 }); // 2 minute timeout for scanning
            return response.data;
        } catch (error) {
            console.error('Cluster scan error:', error);
            return { error: 'Failed to scan cluster' };
        }
    },

    getAnomalies: async (namespace?: string, severity?: string, limit: number = 50): Promise<any> => {
        try {
            const params: Record<string, string | number> = { limit };
            if (namespace) params.namespace = namespace;
            if (severity) params.severity = severity;
            const response = await apiClient.get('/cluster/anomalies', { params });
            return response.data;
        } catch (error) {
            console.error('Anomalies fetch error:', error);
            return { anomalies: [], stats: {} };
        }
    },

    getAnomalyDetail: async (id: number): Promise<any> => {
        try {
            const response = await apiClient.get(`/cluster/anomalies/${id}`);
            return response.data;
        } catch (error) {
            console.error('Anomaly detail fetch error:', error);
            return null;
        }
    },

    resolveAnomaly: async (id: number): Promise<boolean> => {
        try {
            await apiClient.post(`/cluster/anomalies/${id}/resolve`);
            return true;
        } catch (error) {
            console.error('Resolve anomaly error:', error);
            return false;
        }
    },

    getAnomalyStats: async (): Promise<any> => {
        try {
            const response = await apiClient.get('/cluster/anomalies/stats');
            return response.data;
        } catch (error) {
            console.error('Anomaly stats error:', error);
            return { critical: 0, errors: 0, warnings: 0, resolved: 0, total: 0 };
        }
    },

    getAISettings: async (): Promise<{ google_api_key_configured: boolean, gemini_model: string }> => {
        try {
            const response = await apiClient.get('/settings');
            return response.data;
        } catch (error) {
            console.error('Fetch AI settings error:', error);
            return { google_api_key_configured: false, gemini_model: 'gemini-3.0-flash' };
        }
    },

    updateAISettings: async (apiKey?: string, model?: string): Promise<boolean> => {
        try {
            const payload: any = {};
            if (apiKey) payload.google_api_key = apiKey;
            if (model) payload.gemini_model = model;
            await apiClient.post('/settings', payload);
            return true;
        } catch (error) {
            console.error('Update AI settings error:', error);
            return false;
        }
    },
};
