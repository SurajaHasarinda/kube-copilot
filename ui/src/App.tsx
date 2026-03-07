import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ConversationsPage from './pages/ConversationsPage';
import SettingsPage from './pages/SettingsPage';
import ClusterVisualizationPage from './pages/ClusterVisualizationPage';

/**
 * ProtectedRoute component that redirects to login if the user is not authenticated.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Example Auth check
    if (!api.isAuthenticated()) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(() => api.isAuthenticated());

    useEffect(() => {
        // Optional logic like fetching user data, polling to check auth state, etc.
        const interval = setInterval(() => {
            setIsAuthenticated(api.isAuthenticated());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <HashRouter>
            <Routes>
                {/* Example Unprotected Route */}
                <Route path="/login" element={
                    !isAuthenticated ? <LoginPage onLogin={() => setIsAuthenticated(true)} /> : <Navigate to="/" replace />
                } />

                <Route path="/" element={
                    <ProtectedRoute>
                        <Layout>
                            <HomePage />
                        </Layout>
                    </ProtectedRoute>
                } />

                <Route path="/conversations" element={
                    <ProtectedRoute>
                        <Layout>
                            <ConversationsPage />
                        </Layout>
                    </ProtectedRoute>
                } />

                <Route path="/settings" element={
                    <ProtectedRoute>
                        <Layout>
                            <SettingsPage />
                        </Layout>
                    </ProtectedRoute>
                } />

                <Route path="/cluster" element={
                    <ProtectedRoute>
                        <Layout>
                            <ClusterVisualizationPage />
                        </Layout>
                    </ProtectedRoute>
                } />

                {/* Example fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </HashRouter>
    );
}

export default App;
