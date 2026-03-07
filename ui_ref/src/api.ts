import axios from 'axios';
import { ApiResponse } from './types';

// Setup base configuration for axios client
const apiClient = axios.create({
    baseURL: '/api',
    timeout: 10000,
});

// Example global API utility mapping
export const api = {
    // ------------------------------------------
    // AUTHENTICATION
    // ------------------------------------------
    isAuthenticated: (): boolean => {
        return !!localStorage.getItem('token'); // Generic token check logic
    },

    login: async (credentials: any): Promise<boolean> => {
        try {
            const response = await apiClient.post('/auth/login', credentials);
            localStorage.setItem('token', response.data.token);
            return true;
        } catch (error) {
            console.error('Login Error:', error);
            return false;
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        window.location.href = '/#/login';
    },

    // ------------------------------------------
    // GENERIC DATA FETCHING
    // ------------------------------------------
    getData: async <T>(endpoint: string): Promise<T> => {
        const response = await apiClient.get<T>(endpoint);
        return response.data;
    },

    postData: async <T, P>(endpoint: string, payload: P): Promise<T> => {
        const response = await apiClient.post<T>(endpoint, payload);
        return response.data;
    }
};
