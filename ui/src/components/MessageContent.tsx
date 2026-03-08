import React from 'react';
import { ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

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
                if (lines[j].trim() !== '') { nextNonEmpty = lines[j]; break; }
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

export default MessageContent;
