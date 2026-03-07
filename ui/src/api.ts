import axios from 'axios';
import { TokenResponse, ChatResponse, SessionListResponse, HealthResponse, SessionHistoryResponse } from './types';

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
    }
};
