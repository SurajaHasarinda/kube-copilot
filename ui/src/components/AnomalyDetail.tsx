import React, { useState } from 'react';
import { Anomaly } from '../types';
import { getSeverityConfig, formatTimestamp, getResourceIcon } from './AnomalyRow';
import { X, CheckCircle2, Clock, Server, Folder, Activity, ChevronDown, ChevronRight, Terminal } from 'lucide-react';

const AnomalyDetail: React.FC<{
    anomaly: Anomaly;
    onClose: () => void;
    onResolve: (id: number) => void;
}> = ({ anomaly, onClose, onResolve }) => {
    const sevConfig = getSeverityConfig(anomaly.severity);
    const time = formatTimestamp(anomaly.timestamp);
    const [logsExpanded, setLogsExpanded] = useState(true);

    const metadataRows = [
        { label: 'Namespace', value: anomaly.namespace, icon: <Folder size={14} className="text-blue-400" /> },
        { label: 'Resource', value: `${anomaly.resource_type} / ${anomaly.resource_name}`, icon: getResourceIcon(anomaly.resource_type) },
        { label: 'Detected', value: `${time.full} (${time.relative})`, icon: <Clock size={14} className="text-slate-400" /> },
        ...(anomaly.node_name ? [{ label: 'Node', value: anomaly.node_name, icon: <Server size={14} className="text-purple-400" /> }] : []),
        ...(anomaly.details ? [{ label: 'Details', value: anomaly.details, icon: <Activity size={14} className="text-slate-400" /> }] : []),
    ];

    return (
        <div className="w-full lg:w-[460px] shrink-0 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 lg:border-2 rounded-xl flex flex-col shadow-2xl animate-slide-in-right">
            <div className={`p-5 border-b-2 border-slate-700/50 relative ${sevConfig.bg}`}>
                <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-all duration-200">
                    <X size={18} />
                </button>
                <div className="flex items-center gap-3 mb-3">
                    <div className={`p-3 rounded-xl ${sevConfig.bg} border-2 ${sevConfig.border} shadow-lg`}>
                        <span className={sevConfig.color}>{sevConfig.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1 pr-8">
                        <h3 className="text-slate-100 font-bold text-base mb-0.5 truncate">{anomaly.resource_name}</h3>
                        <span className={`text-xs uppercase tracking-widest font-semibold ${sevConfig.color}`}>{anomaly.category}</span>
                    </div>
                </div>
                <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border-2 ${sevConfig.bg} ${sevConfig.border}`}>
                    {anomaly.resolved ? (
                        <><CheckCircle2 size={14} className="text-green-400" /><span className="text-sm font-semibold text-green-400">Resolved</span></>
                    ) : (
                        <>
                            <span className={`w-2.5 h-2.5 rounded-full ${anomaly.severity === 'critical' ? 'bg-red-400' : anomaly.severity === 'error' ? 'bg-orange-400' : 'bg-yellow-400'} animate-pulse shadow-lg`} />
                            <span className={`text-sm font-semibold ${sevConfig.color}`}>{sevConfig.label}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 space-y-2">
                <div className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1 font-medium">Message</span>
                    <span className="text-sm text-slate-100 block break-words">{anomaly.message}</span>
                </div>

                {metadataRows.map((row, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 group">
                        <div className="p-2 rounded-lg bg-slate-800/80 shadow-sm">{row.icon}</div>
                        <div className="min-w-0 flex-1">
                            <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1 font-medium">{row.label}</span>
                            <span className="text-sm text-slate-100 block break-words font-medium">{row.value}</span>
                        </div>
                    </div>
                ))}

                {anomaly.logs && (
                    <div className="mt-4 pt-4 border-t-2 border-slate-700/40">
                        <button
                            onClick={() => setLogsExpanded(!logsExpanded)}
                            className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3 px-1 hover:text-slate-200 transition-colors w-full"
                        >
                            <Terminal size={14} />
                            <span className="flex-1 text-left">Pod Logs</span>
                            {logsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        {logsExpanded && (
                            <pre className="bg-slate-950 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-300 overflow-auto custom-scrollbar max-h-64 whitespace-pre-wrap break-words font-mono leading-relaxed">
                                {anomaly.logs || '(No logs available)'}
                            </pre>
                        )}
                    </div>
                )}

                {!anomaly.resolved && (
                    <div className="mt-4 pt-3">
                        <button
                            onClick={() => onResolve(anomaly.id)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-900/20 hover:bg-green-900/40 border-2 border-green-500/30 text-green-400 rounded-xl transition-all duration-200 font-medium text-sm"
                        >
                            <CheckCircle2 size={16} />
                            Mark as Resolved
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnomalyDetail;
