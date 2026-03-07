import React from 'react';
import { NavLink } from 'react-router-dom';
import { Terminal, MessageSquare, Settings, Network, LogOut } from 'lucide-react';
import { api } from '../api';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col md:flex-row">
            {/* Sidebar / Navigation */}
            <aside className="w-full md:w-64 bg-slate-800 border-b md:border-r border-slate-700 p-4 shrink-0">
                <div className="flex items-center gap-2 mb-8 px-2 mt-4">
                    {/* App Logo */}
                    <img src="/kube-copilot.svg" alt="KubeCopilot Logo" className="w-8 h-8 drop-shadow-md" />
                    <span className="font-bold text-lg text-slate-100 tracking-wider">
                        KubeCopilot
                    </span>
                </div>

                <nav className="space-y-1">
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <Terminal size={18} />
                        Chat
                    </NavLink>
                    <NavLink
                        to="/conversations"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <MessageSquare size={18} />
                        Conversations
                    </NavLink>
                    <NavLink
                        to="/cluster"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <Network size={18} />
                        Cluster
                    </NavLink>
                    <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <Settings size={18} />
                        Settings
                    </NavLink>
                </nav>

                <div className="mt-auto pt-8">
                    <button
                        onClick={() => api.logout()}
                        className="flex items-center w-full gap-3 px-3 py-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-danger transition-colors cursor-pointer"
                    >
                        <LogOut size={18} />
                        Log Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-auto custom-scrollbar">
                {children}
            </main>
        </div>
    );
};

export default Layout;
