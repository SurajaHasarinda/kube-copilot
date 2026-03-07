import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { ChatResponse, ApprovalInfo } from '../types';
import { Send, User, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

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
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userText = input.trim();
        setInput('');
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
                <button
                    onClick={() => { setMessages([]); setSessionId(''); }}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded text-sm transition-colors cursor-pointer"
                >
                    Clear Chat
                </button>
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
            <div className="pt-4 mt-auto">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                        placeholder="Ask KubeCopilot..."
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-4 pr-12 focus:outline-none focus:border-brand transition-colors"
                        disabled={loading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="absolute right-2 p-2 text-brand hover:text-white bg-slate-800 hover:bg-brand rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
