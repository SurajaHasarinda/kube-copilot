/**
 * Global TypeScript Interfaces & Types for the Frontend
 */

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

export interface User {
    id: string;
    username: string;
    email: string;
}

// Add more model interfaces here...
