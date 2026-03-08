import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { SessionInfo } from '../types';
import { MessageSquare, Clock, Trash2, CheckCircle, ExternalLink } from 'lucide-react';

const ConversationsPage: React.FC = () => {
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const navigate = useNavigate();

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const data = await api.getSessions();
            setSessions(data.sessions);
        } catch (err) {
            console.error("Failed to fetch sessions", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const toggleSelectAll = () => {
        if (selectedIds.size === sessions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sessions.map(s => s.session_id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await api.deleteSession(id);
            setSessions(sessions.filter(s => s.session_id !== id));
            if (selectedIds.has(id)) {
                const newSelected = new Set(selectedIds);
                newSelected.delete(id);
                setSelectedIds(newSelected);
            }
        } catch (err) {
            console.error("Failed to delete session", err);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;

        try {
            setLoading(true);
            const promises = Array.from(selectedIds).map(id => api.deleteSession(id));
            await Promise.all(promises);
            setSessions(sessions.filter(s => !selectedIds.has(s.session_id)));
            setSelectedIds(new Set());
        } catch (err) {
            console.error("Failed to bulk delete sessions", err);
        } finally {
            setLoading(false);
        }
    };

    const navigateToSession = (id: string) => {
        navigate(`/?session=${id}`);
    };

    return (
        <div className="p-6 md:p-8 animate-slide-up flex flex-col gap-6 max-w-7xl mx-auto min-h-full w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <MessageSquare className="text-brand" /> Past Conversations
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        View or delete your agent chat history.
                    </p>
                </div>
                {selectedIds.size > 0 && (
                    <button
                        onClick={handleBulkDelete}
                        className="flex items-center gap-2 bg-danger/20 text-danger hover:bg-danger hover:text-white px-4 py-2 rounded-md transition-colors"
                    >
                        <Trash2 size={16} /> Delete Selected ({selectedIds.size})
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                </div>
            ) : sessions.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center flex flex-col items-center justify-center">
                    <CheckCircle className="text-slate-600 mb-4" size={48} />
                    <h2 className="text-lg font-medium text-slate-300">No Conversations Found</h2>
                    <p className="text-slate-500 mt-2">Start a chat with the agent to see your history here.</p>
                </div>
            ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center p-4 border-b border-slate-700 bg-slate-800/50 font-medium text-slate-300">
                        <div>
                            <input
                                type="checkbox"
                                checked={selectedIds.size === sessions.length && sessions.length > 0}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-brand focus:ring-brand accent-brand cursor-pointer"
                            />
                        </div>
                        <div>Session ID</div>
                        <div className="hidden md:block">Details</div>
                        <div className="text-right w-24">Actions</div>
                    </div>

                    <div className="divide-y divide-slate-700/50">
                        {sessions.map((session) => (
                            <div
                                key={session.session_id}
                                className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center p-4 hover:bg-slate-700/30 transition-colors cursor-pointer"
                                onClick={() => navigateToSession(session.session_id)}
                            >
                                <div onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(session.session_id)}
                                        onChange={() => toggleSelect(session.session_id)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-brand focus:ring-brand accent-brand cursor-pointer"
                                    />
                                </div>

                                <div className="font-mono text-slate-200">
                                    <div className="flex items-center gap-2">
                                        {session.session_id}
                                        {session.has_pending_approval && (
                                            <span className="px-2 py-0.5 bg-warning/20 text-warning rounded text-xs border border-warning/30">
                                                Pending
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="hidden md:flex flex-col gap-1 text-sm text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} />
                                        <span>{new Date(session.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs border border-slate-600">
                                            messages: {session.message_count}
                                        </span>
                                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs border border-slate-600">
                                            ns: {session.namespace || 'default'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 w-24">
                                    <button
                                        onClick={() => navigateToSession(session.session_id)}
                                        className="p-2 text-slate-400 hover:text-brand bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                                        title="View Chat"
                                    >
                                        <ExternalLink size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(session.session_id, e)}
                                        className="p-2 text-slate-400 hover:text-danger bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                                        title="Delete Session"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConversationsPage;
