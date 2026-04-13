import React, { useState } from 'react';
import { api } from '../api';


interface LoginPageProps {
    onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const success = await api.login(username, password);
        if (success) {
            onLogin();
        } else {
            setError('Invalid username or password.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 max-w-md w-full shadow-2xl animate-slide-up">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center p-3 shadow-inner">
                        <img src="/kube-copilot.svg" alt="App Logo" className="w-full h-full drop-shadow-md" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-center text-white mb-2">KubeCopilot</h1>
                <p className="text-slate-400 text-center mb-8">Enter your credentials to continue</p>

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-brand"
                            required
                        />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-white focus:outline-none focus:border-brand"
                            required
                        />
                    </div>
                    {error && <div className="text-danger text-sm">{error}</div>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-brand hover:bg-brand/80 text-white p-3 rounded font-medium transition-colors disabled:opacity-50 mt-2 cursor-pointer"
                    >
                        {loading ? 'Authenticating...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
