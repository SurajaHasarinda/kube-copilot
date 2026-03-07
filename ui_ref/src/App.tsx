import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
// import LoginPage from './pages/LoginPage';

/**
 * ProtectedRoute component that redirects to login if the user is not authenticated.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Example Auth check
    // if (!api.isAuthenticated()) {
    //     return <Navigate to="/login" replace />;
    // }
    return <>{children}</>;
};

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(true);

    useEffect(() => {
        // Optional logic like fetching user data, polling to check auth state, etc.
        const interval = setInterval(() => {
            // setIsAuthenticated(api.isAuthenticated());
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <HashRouter>
            <Routes>
                {/* Example Unprotected Route */}
                {/* <Route path="/login" element={<LoginPage onLogin={() => setIsAuthenticated(true)} />} /> */}

                <Route path="/" element={
                    <ProtectedRoute>
                        <Layout>
                            <HomePage />
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
