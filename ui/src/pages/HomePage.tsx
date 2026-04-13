import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ChatResponse, ApprovalInfo } from '../types';
import { Send, User, CheckCircle, XCircle, X, Brain, Wrench, CircleCheck, Loader2, Sparkles } from 'lucide-react';
import MessageContent from '../components/MessageContent';
import { MentionItem, fetchClusterStructureMentions, fetchAnomalyMentions } from '../utils/contextCache';

interface Message {
    role: 'human' | 'agent';
    content: string;
    approvalInfo?: ApprovalInfo | null;
    approvalStatus?: 'approved' | 'denied' | null;
}

interface ThoughtStep {
    step: 'thinking' | 'tool_call' | 'tool_result' | 'done';
    content: string;
    tool?: string;
    args?: Record<string, any>;
    timestamp: number;
}

/** Human-friendly labels for tool names */
const TOOL_LABELS: Record<string, string> = {
    list_resources: 'Listing resources',
    get_pod_logs: 'Reading pod logs',
    describe_resource: 'Describing resource',
    read_resource_yaml: 'Reading YAML config',
    restart_deployment: 'Restarting deployment',
    scale_deployment: 'Scaling deployment',
    edit_resource_yaml: 'Editing resource',
    get_cluster_anomaly: 'Fetching anomaly details',
};

const formatToolLabel = (tool: string) => TOOL_LABELS[tool] || tool.replace(/_/g, ' ');

const formatArgs = (args: Record<string, any>): string => {
    const parts: string[] = [];
    if (args.namespace) parts.push(args.namespace);
    if (args.resource_type) parts.push(args.resource_type);
    if (args.name || args.pod_name || args.deployment_name)
        parts.push(args.name || args.pod_name || args.deployment_name);
    if (args.replicas !== undefined) parts.push(`replicas=${args.replicas}`);
    return parts.length > 0 ? parts.join(' / ') : '';
};

const HomePage: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingHistory, setFetchingHistory] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [searchParams] = useSearchParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Thought process state
    const [thoughtSteps, setThoughtSteps] = useState<ThoughtStep[]>([]);
    const [isThinking, setIsThinking] = useState(false);

    const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
    const [mentionSearch, setMentionSearch] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [selectedContexts, setSelectedContexts] = useState<MentionItem[]>([]);

    useEffect(() => {
        let mounted = true;
        fetchAnomalyMentions().then(items => {
            if (mounted && items.length > 0) setMentionItems(prev => [...items, ...prev.filter(i => i.type !== 'anomaly')]);
        });
        fetchClusterStructureMentions().then(items => {
            if (mounted && items.length > 0) setMentionItems(prev => [...prev.filter(i => i.type === 'anomaly'), ...items]);
        });
        return () => { mounted = false; };
    }, []);

    const filteredMentions = React.useMemo(() => {
        if (mentionSearch === null) return [];
        const term = mentionSearch.toLowerCase();
        return mentionItems.filter(item => item.text.toLowerCase().includes(term) || item.name.toLowerCase().includes(term)).slice(0, 10);
    }, [mentionSearch, mentionItems]);

    useEffect(() => {
        const querySessionId = searchParams.get('session');
        if (querySessionId && querySessionId !== sessionId) {
            setSessionId(querySessionId);
            setLoading(true);
            setFetchingHistory(true);
            api.getSessionHistory(querySessionId).then(res => {
                setMessages(res.messages.map(m => ({ role: m.role as 'human' | 'agent', content: m.content })));
            }).catch(() => {
                setMessages([{ role: 'agent', content: '❌ Failed to load session history.' }]);
            }).finally(() => {
                setLoading(false);
                setFetchingHistory(false);
            });
        }
    }, [searchParams, sessionId]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, thoughtSteps]);

    const appendAgentMessage = (result: ChatResponse) => {
        setMessages(prev => [...prev, {
            role: 'agent',
            content: result.content,
            approvalInfo: result.type === 'approval_required' ? result.approval_info : null
        }]);
    };

    const handleSend = async () => {
        if (!input.trim() && selectedContexts.length === 0) return;
        const contextStr = selectedContexts.map(c => c.text).join(' ');
        const userText = [contextStr, input.trim()].filter(Boolean).join(' ');
        setInput('');
        setSelectedContexts([]);

        setMessages(prev => [...prev, { role: 'human', content: userText }]);
        setLoading(true);
        setIsThinking(true);
        setThoughtSteps([]);

        const token = localStorage.getItem('token');
        const encodedMessage = encodeURIComponent(userText);
        const encodedSessionId = encodeURIComponent(sessionId);
        const url = `/api/v1/chat/stream?message=${encodedMessage}&session_id=${encodedSessionId}&token=${token}`;

        const eventSource = new EventSource(url);
        let receivedFinalResponse = false;

        // Placeholder agent message that we'll fill in when the final response arrives
        let currentAgentMessage: Message = { role: 'agent', content: '' };
        setMessages(prev => [...prev, currentAgentMessage]);
        let messageIndex = -1;

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'metadata') {
                if (data.session_id) setSessionId(data.session_id);
                return;
            }

            if (data.type === 'thought') {
                const step: ThoughtStep = {
                    step: data.step || 'thinking',
                    content: data.content || '',
                    tool: data.tool,
                    args: data.args,
                    timestamp: Date.now(),
                };
                setThoughtSteps(prev => [...prev, step]);
                return;
            }

            if (['response', 'error', 'approval_required'].includes(data.type)) {
                receivedFinalResponse = true;
                setMessages(prev => {
                    const newMessages = [...prev];
                    if (messageIndex === -1) messageIndex = newMessages.length - 1;
                    currentAgentMessage.content = data.content || '';
                    if (data.type === 'approval_required') {
                        currentAgentMessage.approvalInfo = data.approval_info;
                    }
                    newMessages[messageIndex] = { ...currentAgentMessage };
                    return newMessages;
                });
                setLoading(false);
                setIsThinking(false);
                eventSource.close();
            }
        };

        eventSource.onerror = () => {
            // EventSource fires onerror when the server closes the connection,
            // which is normal after the final response. Only show an error if
            // we never received the actual response.
            eventSource.close();
            if (!receivedFinalResponse) {
                setMessages(prev => {
                    const newMessages = [...prev];
                    if (messageIndex === -1) messageIndex = newMessages.length - 1;
                    newMessages[messageIndex] = {
                        ...newMessages[messageIndex],
                        content: newMessages[messageIndex].content || '❌ Failed to communicate with the agent.',
                    };
                    return newMessages;
                });
                setLoading(false);
                setIsThinking(false);
            }
        };
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);
        const cursor = e.target.selectionStart || 0;
        const match = val.slice(0, cursor).match(/@([\w./-]*)$/);
        if (match) { setMentionSearch(match[1]); setMentionIndex(0); }
        else setMentionSearch(null);
    };

    const insertMention = (item: MentionItem) => {
        if (!inputRef.current) return;
        const cursor = inputRef.current.selectionStart || 0;
        const textAfterCursor = input.slice(cursor);
        const match = input.slice(0, cursor).match(/@([\w./-]*)$/);
        if (match) {
            const index = match.index!;
            setInput(input.slice(0, index) + textAfterCursor);
            setMentionSearch(null);
            setSelectedContexts(prev => prev.find(c => c.text === item.text) ? prev : [...prev, item]);
            setTimeout(() => {
                if (inputRef.current) { inputRef.current.focus(); inputRef.current.setSelectionRange(index, index); }
            }, 0);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && input === '' && selectedContexts.length > 0) {
            setSelectedContexts(prev => prev.slice(0, -1));
            return;
        }
        if (mentionSearch !== null && filteredMentions.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(prev => Math.min(prev + 1, filteredMentions.length - 1)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(prev => Math.max(prev - 1, 0)); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredMentions[mentionIndex]); return; }
            if (e.key === 'Escape') { setMentionSearch(null); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleApprove = async (msgIndex: number, approved: boolean) => {
        setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, approvalStatus: approved ? 'approved' : 'denied' } : m));
        setLoading(true);
        try {
            appendAgentMessage(await api.approveAction(sessionId, approved));
        } catch {
            setMessages(prev => [...prev, { role: 'agent', content: '❌ Failed to send approval.' }]);
        } finally {
            setLoading(false);
        }
    };

    const getMentionTypeColor = (type: string) => {
        switch (type) {
            case 'namespace': return 'bg-blue-900/30 text-blue-400';
            case 'pod': return 'bg-green-900/30 text-green-400';
            case 'deployment': return 'bg-purple-900/30 text-purple-400';
            case 'anomaly': return 'bg-red-900/30 text-red-400';
            default: return 'bg-slate-700 text-slate-400';
        }
    };

    const renderThoughtStep = (step: ThoughtStep, index: number) => {
        const isLast = index === thoughtSteps.length - 1;

        if (step.step === 'thinking') {
            return (
                <div key={index} className="flex items-start gap-2.5 animate-fade-in">
                    <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isLast ? 'bg-brand/20 text-brand' : 'bg-slate-700/50 text-slate-500'}`}>
                        {isLast ? <Brain size={12} className="animate-pulse" /> : <Brain size={12} />}
                    </div>
                    <span className={`text-sm ${isLast ? 'text-slate-300' : 'text-slate-500'}`}>
                        {step.content}
                    </span>
                </div>
            );
        }

        if (step.step === 'tool_call') {
            const argsStr = step.args ? formatArgs(step.args) : '';
            return (
                <div key={index} className="flex items-start gap-2.5 animate-fade-in">
                    <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isLast ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/50 text-slate-500'}`}>
                        {isLast ? <Wrench size={12} className="animate-pulse" /> : <Wrench size={12} />}
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-sm font-medium ${isLast ? 'text-amber-300' : 'text-slate-500'}`}>
                            {formatToolLabel(step.tool || '')}
                        </span>
                        {argsStr && (
                            <span className="text-xs text-slate-500 font-mono mt-0.5">{argsStr}</span>
                        )}
                    </div>
                </div>
            );
        }

        if (step.step === 'tool_result') {
            return (
                <div key={index} className="flex items-start gap-2.5 animate-fade-in">
                    <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <CircleCheck size={12} />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm text-emerald-400">
                            {formatToolLabel(step.tool || '')} — done
                        </span>
                        {step.content && (
                            <span className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-full" title={step.content}>
                                {step.content.length > 120 ? step.content.slice(0, 120) + '…' : step.content}
                            </span>
                        )}
                    </div>
                </div>
            );
        }

        if (step.step === 'done') {
            return (
                <div key={index} className="flex items-start gap-2.5 animate-fade-in">
                    <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-brand/20 text-brand flex items-center justify-center">
                        <Sparkles size={12} />
                    </div>
                    <span className="text-sm text-brand">{step.content}</span>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex-1 flex flex-col p-4 md:p-6 w-full max-w-5xl mx-auto animate-slide-up bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <img src="/kube-copilot.svg" alt="App Logo" className="w-6 h-6" /> KubeCopilot Chat
                    </h1>
                    <p className="text-sm text-slate-400">Session: {sessionId || 'New'}</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 py-4">
                {messages.length === 0 && (
                    <div className="m-auto text-center text-slate-500 max-w-sm">
                        <img src="/kube-copilot.svg" alt="App Logo" className="w-12 h-12 mx-auto mb-4 opacity-30 grayscale" />
                        <p>Welcome to KubeCopilot. Ask me to diagnose a pod, list resources, or restart a deployment.</p>
                    </div>
                )}

                {messages.map((msg, i) => {
                    if (msg.role === 'agent' && !msg.content && !msg.approvalInfo) return null;
                    return (
                        <div key={i} className={`flex gap-3 ${msg.role === 'human' ? 'flex-row-reverse' : ''}`}>
                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'human' ? 'bg-slate-700' : 'bg-brand/20 text-brand'}`}>
                                {msg.role === 'human' ? <User size={16} /> : <img src="/kube-copilot.svg" alt="Avatar" className="w-4 h-4" />}
                            </div>
                            <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'human' ? 'bg-slate-800 text-slate-200' : 'bg-slate-800/50 text-slate-300 border border-slate-700/50'}`}>
                                {msg.content && <MessageContent content={msg.content} />}
                                {msg.approvalInfo && (
                                    <div className="mt-4 p-4 bg-slate-900 border border-warning/50 rounded-lg">
                                        <h3 className="text-warning font-semibold flex items-center gap-2 mb-2">⚠️ Action Approval Required</h3>
                                        <p className="text-sm text-slate-300 mb-3">{msg.approvalInfo.message}</p>
                                        <div className="bg-slate-800 p-3 rounded mb-4 max-h-40 overflow-auto text-xs font-mono text-slate-400">
                                            {msg.approvalInfo.actions.map((act, index) => (
                                                <div key={index} className="mb-2 last:mb-0">
                                                    <span className="text-brand">Tool:</span> {act.tool} <br />
                                                    <span className="text-brand">Args:</span> {JSON.stringify(act.args, null, 2)}
                                                </div>
                                            ))}
                                        </div>
                                        {msg.approvalStatus ? (
                                            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 ${msg.approvalStatus === 'approved'
                                                ? 'bg-green-900/20 border-green-500/30 text-green-400'
                                                : 'bg-red-900/20 border-red-500/30 text-red-400'
                                                }`}>
                                                {msg.approvalStatus === 'approved'
                                                    ? <><CheckCircle size={16} /><span className="text-sm font-semibold">Action Approved</span></>
                                                    : <><XCircle size={16} /><span className="text-sm font-semibold">Action Denied</span></>
                                                }
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApprove(i, true)} className="flex items-center gap-1.5 bg-success/20 text-success hover:bg-success hover:text-white px-3 py-1.5 rounded transition-colors text-sm cursor-pointer">
                                                    <CheckCircle size={16} /> Approve
                                                </button>
                                                <button onClick={() => handleApprove(i, false)} className="flex items-center gap-1.5 bg-danger/20 text-danger hover:bg-danger hover:text-white px-3 py-1.5 rounded transition-colors text-sm cursor-pointer">
                                                    <XCircle size={16} /> Deny
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Live thought process panel */}
                {isThinking && (
                    <div className="flex gap-3 animate-fade-in">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center shadow-lg shadow-brand/10">
                            <img src="/kube-copilot.svg" alt="Avatar" className="w-4 h-4" />
                        </div>
                        <div className="flex-1 max-w-[85%] bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 shadow-md">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/40">
                                <Loader2 size={14} className="text-brand animate-spin" />
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent Working</span>
                            </div>

                            {/* Steps timeline */}
                            <div className="flex flex-col gap-2.5">
                                {thoughtSteps.length === 0 && (
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-5 h-5 rounded-full bg-brand/20 text-brand flex items-center justify-center">
                                            <Brain size={12} className="animate-pulse" />
                                        </div>
                                        <span className="text-sm text-slate-400">Starting…</span>
                                    </div>
                                )}
                                {thoughtSteps.map((step, i) => renderThoughtStep(step, i))}
                            </div>
                        </div>
                    </div>
                )}

                {fetchingHistory && (
                    <div className="flex flex-col items-center justify-center p-8 gap-3 opacity-50">
                        <span className="text-brand w-5 h-5 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
                        <span className="text-xs text-slate-500 font-medium">Loading session history...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="pt-2 md:pt-4 mt-auto relative sticky bottom-0 bg-slate-900 pb-4 md:pb-2 z-10">
                {mentionSearch !== null && (
                    <div className="absolute bottom-full left-0 mb-2 w-full max-w-[calc(100vw-2rem)] sm:w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20 animate-slide-up">
                        <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700/50 flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attach Context</span>
                            {mentionItems.length === 0 && <span className="text-[10px] text-brand animate-pulse">Loading data...</span>}
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            {filteredMentions.length > 0 ? filteredMentions.map((item, idx) => (
                                <button
                                    key={idx}
                                    title={`${item.name}\n${item.text}`}
                                    onMouseDown={e => { e.preventDefault(); insertMention(item); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg flex flex-col gap-0.5 transition-colors cursor-pointer ${idx === mentionIndex ? 'bg-brand/20 border border-brand/30' : 'hover:bg-slate-700/50 border border-transparent'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`text-sm font-medium ${idx === mentionIndex ? 'text-brand' : 'text-slate-200'} truncate mr-2`}>{item.name}</span>
                                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${getMentionTypeColor(item.type)}`}>{item.type}</span>
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono truncate">{item.text}</span>
                                </button>
                            )) : (
                                <div className="p-4 flex flex-col items-center justify-center text-slate-500 gap-2">
                                    <span className="text-sm">No references found</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="relative flex flex-wrap items-center bg-slate-800 border border-slate-700 rounded-lg p-2 pr-12 focus-within:border-brand transition-colors min-h-[58px]">
                    {selectedContexts.map((ctx, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-brand/20 text-brand border border-brand/30 text-sm font-medium px-2 py-1.5 rounded-md mb-1 mr-2 mt-1 shadow-sm">
                            {ctx.text}
                            <button onClick={() => setSelectedContexts(prev => prev.filter(c => c.text !== ctx.text))} className="hover:text-white transition-colors cursor-pointer text-brand/70">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <input
                        ref={inputRef} type="text" value={input}
                        onChange={handleInputChange} onKeyDown={handleKeyDown}
                        placeholder={selectedContexts.length === 0 ? "Ask KubeCopilot... (Type @ to attach context)" : ""}
                        className="flex-1 min-w-[200px] bg-transparent text-white focus:outline-none p-2 placeholder-slate-500 text-base"
                        disabled={loading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || (!input.trim() && selectedContexts.length === 0)}
                        className="absolute right-2 bottom-2 text-brand hover:text-white bg-slate-800 hover:bg-brand rounded-md p-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
