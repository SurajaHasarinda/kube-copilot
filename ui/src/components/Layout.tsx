import React from 'react';
import { NavLink } from 'react-router-dom';
import { Terminal, MessageSquare, Settings, Network, ShieldAlert, LogOut } from 'lucide-react';
import { api } from '../api';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col md:flex-row">
            {/* Sidebar / Navigation */}
            <aside className="w-full md:w-64 bg-slate-800 border-b md:border-r border-slate-700 p-2 md:p-4 shrink-0 flex flex-col relative z-20 shadow-md md:shadow-none">
                <div className="flex items-center justify-between mb-2 md:mb-8 px-2 md:mt-4">
                    <div className="flex items-center gap-2">
                        <img src="/kube-copilot.svg" alt="KubeCopilot Logo" className="w-6 h-6 md:w-8 md:h-8 drop-shadow-md" />
                        <span className="font-bold text-base md:text-lg text-slate-100 tracking-wider">
                            KubeCopilot
                        </span>
                    </div>
                    {/* Logout button for mobile */}
                    <button
                        onClick={() => api.logout()}
                        className="md:hidden flex items-center justify-center p-2 rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-danger transition-colors cursor-pointer"
                        title="Log Out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>

                <nav className="flex overflow-x-auto md:flex-col gap-2 md:gap-0 md:space-y-1 px-2 md:px-0 pb-1 md:pb-0 w-full mt-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            `flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <Terminal size={18} />
                        <span className="text-sm md:text-base font-medium">Chat</span>
                    </NavLink>
                    <NavLink
                        to="/conversations"
                        className={({ isActive }) =>
                            `flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <MessageSquare size={18} />
                        <span className="text-sm md:text-base font-medium">Conversations</span>
                    </NavLink>
                    <NavLink
                        to="/cluster"
                        className={({ isActive }) =>
                            `flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <Network size={18} />
                        <span className="text-sm md:text-base font-medium">Cluster</span>
                    </NavLink>
                    <NavLink
                        to="/anomalies"
                        className={({ isActive }) =>
                            `flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-red-900/20 text-red-400'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <ShieldAlert size={18} />
                        <span className="text-sm md:text-base font-medium">Anomalies</span>
                    </NavLink>
                    <NavLink
                        to="/settings"
                        className={({ isActive }) =>
                            `flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                ? 'bg-brand/10 text-brand'
                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`
                        }
                    >
                        <Settings size={18} />
                        <span className="text-sm md:text-base font-medium">Settings</span>
                    </NavLink>
                </nav>

                <div className="mt-auto pt-8 hidden md:block">
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
            <main className="flex-1 flex flex-col min-w-0 relative">
                {children}
            </main>
        </div>
    );
};

export default Layout;
