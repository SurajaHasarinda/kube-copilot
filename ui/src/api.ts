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

    changeUsername: async (newUsername: string, password: string): Promise<{success: boolean, token?: string}> => {
        try {
            const response = await apiClient.post<{message: string, access_token: string, expires_in_minutes: number}>('/auth/change-username', {
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

    logout: () => {
        localStorage.removeItem('token');
        window.location.reload();
    },

    sendMessage: async (message: string, sessionId: string, namespace: string): Promise<ChatResponse> => {
        const response = await apiClient.post<ChatResponse>('/chat', {
            message,
            session_id: sessionId,
            namespace
        });
        return response.data;
    },

    approveAction: async (sessionId: string, approved: boolean): Promise<ChatResponse> => {
        const response = await apiClient.post<ChatResponse>('/chat/approve', {
            session_id: sessionId,
            approved
        });
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
    }
};
