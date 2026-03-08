import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ChatResponse, ApprovalInfo } from '../types';
import { Send, User, CheckCircle, XCircle, ChevronRight, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { MentionItem, fetchClusterStructureMentions, fetchAnomalyMentions } from '../utils/contextCache';

interface Message {
    role: 'human' | 'agent';
    content: string;
    approvalInfo?: ApprovalInfo | null;
}

const MessageContent: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split('\n');
    const reasoningLines: string[] = [];
    const mainLines: string[] = [];
    let isReasoning = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^(Thought|Action|Observation|Action Input):/)) {
            isReasoning = true;
            reasoningLines.push(line);
        } else if (isReasoning && line.trim() === '') {
            let nextNonEmpty = '';
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() !== '') {
                    nextNonEmpty = lines[j];
                    break;
                }
            }
            if (!nextNonEmpty || nextNonEmpty.match(/^(Thought|Action|Observation|Action Input):/)) {
                reasoningLines.push(line);
            } else {
                isReasoning = false;
            }
        } else if (isReasoning) {
            reasoningLines.push(line);
        } else {
            mainLines.push(line);
        }
    }

    const reasoningContent = reasoningLines.join('\n').trim();
    const mainContent = mainLines.join('\n').trim();

    return (
        <div className="flex flex-col gap-3">
            {reasoningContent && (
                <details className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 text-xs text-slate-400 group">
                    <summary className="cursor-pointer font-medium text-slate-500 hover:text-slate-300 list-none flex items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
                        <ChevronRight size={14} className="transform group-open:rotate-90 transition-transform duration-200" />
                        Agent Reasoning block
                    </summary>
                    <div className="mt-3 pl-3 py-2 border-l-2 border-slate-700/50 space-y-2 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
                        {reasoningContent}
                    </div>
                </details>
            )}
            {mainContent && (
                <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ node, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                return match ? (
                                    <SyntaxHighlighter
                                        style={vscDarkPlus as any}
                                        language={match[1]}
                                        PreTag="div"
                                        className="rounded-md !bg-slate-900/80 border border-slate-700/50"
                                        {...props}
                                    >
                                        {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                ) : (
                                    <code className={`${className || ''} bg-slate-800 px-1.5 py-0.5 rounded text-brand font-mono`} {...props}>
                                        {children}
                                    </code>
                                );
                            }
                        }}
                    >
                        {mainContent}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
};

const HomePage: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [searchParams] = useSearchParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Mention state
    const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
    const [mentionSearch, setMentionSearch] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [selectedContexts, setSelectedContexts] = useState<MentionItem[]>([]);

    useEffect(() => {
        let mounted = true;

        // 1. Load anomalies fast (from database)
        fetchAnomalyMentions().then(anomalyItems => {
            if (mounted && anomalyItems.length > 0) {
                setMentionItems(prev => {
                    const nonAnomalies = prev.filter(i => i.type !== 'anomaly');
                    return [...anomalyItems, ...nonAnomalies];
                });
            }
        });

        // 2. Load cluster structure (cached client-side)
        fetchClusterStructureMentions().then(structItems => {
            if (mounted && structItems.length > 0) {
                setMentionItems(prev => {
                    const existingAnomalies = prev.filter(i => i.type === 'anomaly');
                    return [...existingAnomalies, ...structItems];
                });
            }
        });

        return () => { mounted = false; };
    }, []);

    const filteredMentions = React.useMemo(() => {
        if (mentionSearch === null) return [];
        const term = mentionSearch.toLowerCase();
        return mentionItems
            .filter(item => item.text.toLowerCase().includes(term) || item.name.toLowerCase().includes(term))
            .slice(0, 10); // show top 10
    }, [mentionSearch, mentionItems]);

    useEffect(() => {
        const querySessionId = searchParams.get('session');
        if (querySessionId && querySessionId !== sessionId) {
            setSessionId(querySessionId);
            setLoading(true);
            api.getSessionHistory(querySessionId).then(res => {
                setMessages(res.messages.map(m => ({
                    role: m.role as 'human' | 'agent',
                    content: m.content
                })));
            }).catch(err => {
                console.error('Failed to load history', err);
                setMessages([{ role: 'agent', content: '❌ Failed to load session history.' }]);
            }).finally(() => {
                setLoading(false);
            });
        }
    }, [searchParams, sessionId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const handleSend = async () => {
        if (!input.trim() && selectedContexts.length === 0) return;

        const contextStr = selectedContexts.map(c => c.text).join(' ');
        const userText = [contextStr, input.trim()].filter(Boolean).join(' ');

        setInput('');
        setSelectedContexts([]);
        setMessages(prev => [...prev, { role: 'human', content: userText }]);
        setLoading(true);

        try {
            const result = await api.sendMessage(userText, sessionId, '');
            if (result.session_id) {
                setSessionId(result.session_id);
            }
            appendAgentMessage(result);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'agent', content: '❌ Failed to communicate with the agent.' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);

        const cursor = e.target.selectionStart || 0;
        const textBeforeCursor = val.slice(0, cursor);
        // Safely match K8s resource names: words, dots, slashes, dashes
        const match = textBeforeCursor.match(/@([\w./-]*)$/);

        if (match) {
            setMentionSearch(match[1]);
            setMentionIndex(0);
        } else {
            setMentionSearch(null);
        }
    };

    const insertMention = (item: MentionItem) => {
        if (!inputRef.current) return;
        const cursor = inputRef.current.selectionStart || 0;
        const textBeforeCursor = input.slice(0, cursor);
        const textAfterCursor = input.slice(cursor);

        const match = textBeforeCursor.match(/@([\w./-]*)$/);
        if (match) {
            const index = match.index!;
            // Remove the auto-complete search query completely
            const newValue = input.slice(0, index) + textAfterCursor;
            setInput(newValue);
            setMentionSearch(null);

            // Add as a context chip if it isn't already there
            setSelectedContexts(prev => {
                if (prev.find(c => c.text === item.text)) return prev;
                return [...prev, item];
            });

            // Set cursor position back correctly
            const newCursorPos = index;
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Backspace removes context chips when input is empty
        if (e.key === 'Backspace' && input === '' && selectedContexts.length > 0) {
            setSelectedContexts(prev => prev.slice(0, -1));
            return;
        }

        if (mentionSearch !== null && filteredMentions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => Math.min(prev + 1, filteredMentions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(filteredMentions[mentionIndex]);
                return;
            }
            if (e.key === 'Escape') {
                setMentionSearch(null);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleApprove = async (approved: boolean) => {
        setLoading(true);
        // Add a visual indicator that we responded to the approval
        setMessages(prev => [...prev, { role: 'human', content: approved ? 'Approved the action.' : 'Denied the action.' }]);

        try {
            const result = await api.approveAction(sessionId, approved);
            appendAgentMessage(result);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'agent', content: '❌ Failed to send approval.' }]);
        } finally {
            setLoading(false);
        }
    };

    const appendAgentMessage = (result: ChatResponse) => {
        setMessages(prev => [...prev, {
            role: 'agent',
            content: result.content,
            approvalInfo: result.type === 'approval_required' ? result.approval_info : null
        }]);
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-6 mx-auto animate-slide-up bg-slate-900">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <img src="/kube-copilot.svg" alt="App Logo" className="w-6 h-6" /> KubeCopilot Chat
                    </h1>
                    <p className="text-sm text-slate-400">Session: {sessionId || 'New'}</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 py-4 pr-2">
                {messages.length === 0 && (
                    <div className="m-auto text-center text-slate-500 max-w-sm">
                        <img src="/kube-copilot.svg" alt="App Logo" className="w-12 h-12 mx-auto mb-4 opacity-30 grayscale" />
                        <p>Welcome to KubeCopilot. Ask me to diagnose a pod, list resources, or restart a deployment.</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'human' ? 'flex-row-reverse' : ''}`}>
                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'human' ? 'bg-slate-700' : 'bg-brand/20 text-brand'}`}>
                            {msg.role === 'human' ? <User size={16} /> : <img src="/kube-copilot.svg" alt="Avatar" className="w-4 h-4" />}
                        </div>

                        <div className={`max-w-[85%] rounded-lg p-3 ${msg.role === 'human' ? 'bg-slate-800 text-slate-200' : 'bg-slate-800/50 text-slate-300 border border-slate-700/50'}`}>
                            {msg.content && (
                                <MessageContent content={msg.content} />
                            )}

                            {msg.approvalInfo && (
                                <div className="mt-4 p-4 bg-slate-900 border border-warning/50 rounded-lg">
                                    <h3 className="text-warning font-semibold flex items-center gap-2 mb-2">
                                        ⚠️ Action Approval Required
                                    </h3>
                                    <p className="text-sm text-slate-300 mb-3">{msg.approvalInfo.message}</p>
                                    <div className="bg-slate-800 p-3 rounded mb-4 max-h-40 overflow-auto text-xs font-mono text-slate-400">
                                        {msg.approvalInfo.actions.map((act, index) => (
                                            <div key={index} className="mb-2 last:mb-0">
                                                <span className="text-brand">Tool:</span> {act.tool} <br />
                                                <span className="text-brand">Args:</span> {JSON.stringify(act.args, null, 2)}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleApprove(true)} className="flex items-center gap-1.5 bg-success/20 text-success hover:bg-success hover:text-white px-3 py-1.5 rounded transition-colors text-sm cursor-pointer">
                                            <CheckCircle size={16} /> Approve
                                        </button>
                                        <button onClick={() => handleApprove(false)} className="flex items-center gap-1.5 bg-danger/20 text-danger hover:bg-danger hover:text-white px-3 py-1.5 rounded transition-colors text-sm cursor-pointer">
                                            <XCircle size={16} /> Deny
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex gap-3">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-brand/20 text-brand flex items-center justify-center">
                            <img src="/kube-copilot.svg" alt="Avatar" className="w-4 h-4" />
                        </div>
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-brand animate-ping"></div>
                            <span className="text-sm text-slate-400">Agent is thinking...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="pt-4 mt-auto relative">
                {/* Mention Popover */}
                {mentionSearch !== null && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20 animate-slide-up">
                        <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700/50 flex justify-between items-center">
                            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attach Context</span>
                            {mentionItems.length === 0 && <span className="text-[10px] text-brand animate-pulse">Loading data...</span>}
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            {filteredMentions.length > 0 ? (
                                filteredMentions.map((item, idx) => (
                                    <button
                                        key={idx}
                                        title={`${item.name}\n${item.text}`}
                                        onMouseDown={(e) => {
                                            // VERY IMPORTANT: Prevent default mouse down behavior.
                                            // If we don't do this, clicking the dropdown button will blur
                                            // the text input field, which sets the cursor index to 0, completely
                                            // breaking the insertMention logic.
                                            e.preventDefault();
                                            insertMention(item);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg flex flex-col gap-0.5 transition-colors cursor-pointer ${idx === mentionIndex ? 'bg-brand/20 border border-brand/30' : 'hover:bg-slate-700/50 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`text-sm font-medium ${idx === mentionIndex ? 'text-brand' : 'text-slate-200'} truncate mr-2`}>
                                                {item.name}
                                            </span>
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${item.type === 'namespace' ? 'bg-blue-900/30 text-blue-400' :
                                                item.type === 'pod' ? 'bg-green-900/30 text-green-400' :
                                                    item.type === 'deployment' ? 'bg-purple-900/30 text-purple-400' :
                                                        item.type === 'anomaly' ? 'bg-red-900/30 text-red-400' :
                                                            'bg-slate-700 text-slate-400'
                                                }`}>
                                                {item.type}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500 font-mono truncate">{item.text}</span>
                                    </button>
                                ))
                            ) : (
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
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
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
