import React, { useState, useEffect } from 'react';
import {
    ShieldAlert,
    RefreshCw,
    AlertTriangle,
    AlertCircle,
    XCircle,
    CheckCircle2,
    Clock,
    Server,
    Box,
    Folder,
    ChevronDown,
    ChevronRight,
    Terminal,
    X,
    Search,
    Filter,
    Radar,
    Activity,
    CircleDot,
} from 'lucide-react';
import { api } from '../api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Anomaly {
    id: number;
    timestamp: string;
    severity: string;
    category: string;
    namespace: string;
    resource_type: string;
    resource_name: string;
    message: string;
    details: string;
    logs: string;
    node_name: string;
    resolved: boolean;
}

interface AnomalyStats {
    critical: number;
    errors: number;
    warnings: number;
    resolved: number;
    total: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string }> = {
    critical: {
        icon: <XCircle size={16} />,
        color: 'text-red-400',
        bg: 'bg-red-900/20',
        border: 'border-red-500/30',
        label: 'Critical',
    },
    error: {
        icon: <AlertCircle size={16} />,
        color: 'text-orange-400',
        bg: 'bg-orange-900/20',
        border: 'border-orange-500/30',
        label: 'Error',
    },
    warning: {
        icon: <AlertTriangle size={16} />,
        color: 'text-yellow-400',
        bg: 'bg-yellow-900/20',
        border: 'border-yellow-500/30',
        label: 'Warning',
    },
};

const getSeverityConfig = (severity: string) =>
    SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;

const formatTimestamp = (ts: string) => {
    try {
        const date = new Date(ts);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);

        let relative = '';
        if (diffMin < 1) relative = 'Just now';
        else if (diffMin < 60) relative = `${diffMin}m ago`;
        else if (diffHr < 24) relative = `${diffHr}h ago`;
        else relative = `${diffDay}d ago`;

        const full = date.toLocaleString();
        return { relative, full };
    } catch {
        return { relative: ts, full: ts };
    }
};

const getResourceIcon = (type: string) => {
    switch (type) {
        case 'pod': return <Server size={14} className="text-green-400" />;
        case 'deployment': return <Box size={14} className="text-blue-400" />;
        case 'node': return <Activity size={14} className="text-purple-400" />;
        default: return <CircleDot size={14} className="text-slate-400" />;
    }
};

// ─── Detail Panel ────────────────────────────────────────────────────────────

const AnomalyDetail: React.FC<{
    anomaly: Anomaly;
    onClose: () => void;
    onResolve: (id: number) => void;
}> = ({ anomaly, onClose, onResolve }) => {
    const sevConfig = getSeverityConfig(anomaly.severity);
    const time = formatTimestamp(anomaly.timestamp);
    const [logsExpanded, setLogsExpanded] = useState(true);

    return (
        <div className="w-[460px] shrink-0 bg-slate-800/50 backdrop-blur-sm border-2 border-slate-700/50 rounded-xl flex flex-col overflow-hidden shadow-2xl animate-slide-in-right">
            {/* Header */}
            <div className={`p-5 border-b-2 border-slate-700/50 relative ${sevConfig.bg}`}>
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-all duration-200"
                >
                    <X size={18} />
                </button>

                <div className="flex items-center gap-3 mb-3">
                    <div className={`p-3 rounded-xl ${sevConfig.bg} border-2 ${sevConfig.border} shadow-lg`}>
                        <span className={sevConfig.color}>{sevConfig.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1 pr-8">
                        <h3 className="text-slate-100 font-bold text-base mb-0.5 truncate">{anomaly.resource_name}</h3>
                        <span className={`text-xs uppercase tracking-widest font-semibold ${sevConfig.color}`}>
                            {anomaly.category}
                        </span>
                    </div>
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border-2 ${sevConfig.bg} ${sevConfig.border}`}>
                    {anomaly.resolved ? (
                        <>
                            <CheckCircle2 size={14} className="text-green-400" />
                            <span className="text-sm font-semibold text-green-400">Resolved</span>
                        </>
                    ) : (
                        <>
                            <span className={`w-2.5 h-2.5 rounded-full ${anomaly.severity === 'critical' ? 'bg-red-400' :
                                anomaly.severity === 'error' ? 'bg-orange-400' : 'bg-yellow-400'
                                } animate-pulse shadow-lg`} />
                            <span className={`text-sm font-semibold ${sevConfig.color}`}>{sevConfig.label}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-2">
                {/* Message */}
                <div className="px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1 font-medium">Message</span>
                    <span className="text-sm text-slate-100 block break-words">{anomaly.message}</span>
                </div>

                {/* Metadata rows */}
                {[
                    { label: 'Namespace', value: anomaly.namespace, icon: <Folder size={14} className="text-blue-400" /> },
                    { label: 'Resource', value: `${anomaly.resource_type} / ${anomaly.resource_name}`, icon: getResourceIcon(anomaly.resource_type) },
                    { label: 'Detected', value: `${time.full} (${time.relative})`, icon: <Clock size={14} className="text-slate-400" /> },
                    ...(anomaly.node_name ? [{ label: 'Node', value: anomaly.node_name, icon: <Server size={14} className="text-purple-400" /> }] : []),
                    ...(anomaly.details ? [{ label: 'Details', value: anomaly.details, icon: <Activity size={14} className="text-slate-400" /> }] : []),
                ].map((row, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 group">
                        <div className="p-2 rounded-lg bg-slate-800/80 shadow-sm">{row.icon}</div>
                        <div className="min-w-0 flex-1">
                            <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1 font-medium">{row.label}</span>
                            <span className="text-sm text-slate-100 block break-words font-medium">{row.value}</span>
                        </div>
                    </div>
                ))}

                {/* Logs section */}
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

                {/* Resolve button */}
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

// ─── Anomaly Row ─────────────────────────────────────────────────────────────

const AnomalyRow: React.FC<{
    anomaly: Anomaly;
    isSelected: boolean;
    onClick: () => void;
}> = ({ anomaly, isSelected, onClick }) => {
    const sevConfig = getSeverityConfig(anomaly.severity);
    const time = formatTimestamp(anomaly.timestamp);

    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-150 group
                ${isSelected
                    ? `${sevConfig.bg} ring-1 ${sevConfig.border}`
                    : 'hover:bg-slate-700/20'
                }
                ${anomaly.resolved ? 'opacity-50' : ''}
            `}
            style={{
                borderLeft: `3px solid ${isSelected ? (
                    anomaly.severity === 'critical' ? '#EF4444' :
                        anomaly.severity === 'error' ? '#F97316' : '#EAB308'
                ) : 'transparent'}`
            }}
        >
            {/* Severity icon */}
            <div className={`p-2 rounded-lg ${sevConfig.bg} ${sevConfig.color} shrink-0`}>
                {sevConfig.icon}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-slate-200 truncate">{anomaly.resource_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sevConfig.bg} ${sevConfig.border} ${sevConfig.color} font-medium uppercase`}>
                        {anomaly.category}
                    </span>
                    {anomaly.resolved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/20 border border-green-500/20 text-green-400 font-medium">
                            Resolved
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-400 truncate">{anomaly.message}</p>
            </div>

            {/* Meta */}
            <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">{anomaly.namespace}</span>
                <span className="text-[10px] text-slate-500" title={time.full}>{time.relative}</span>
            </div>
        </div>
    );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

const ClusterAnomaliesPage: React.FC = () => {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [stats, setStats] = useState<AnomalyStats>({ critical: 0, errors: 0, warnings: 0, resolved: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
    const [filterSeverity, setFilterSeverity] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    const loadAnomalies = async () => {
        setLoading(true);
        try {
            const data = await api.getAnomalies(undefined, filterSeverity || undefined);
            setAnomalies(data.anomalies || []);
            setStats(data.stats || { critical: 0, errors: 0, warnings: 0, resolved: 0, total: 0 });
        } catch (err) {
            console.error('Failed to load anomalies:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleScan = async () => {
        setScanning(true);
        try {
            await api.scanCluster();
            await loadAnomalies();
        } catch (err) {
            console.error('Scan failed:', err);
        } finally {
            setScanning(false);
        }
    };

    const handleResolve = async (id: number) => {
        const success = await api.resolveAnomaly(id);
        if (success) {
            await loadAnomalies();
            if (selectedAnomaly?.id === id) {
                setSelectedAnomaly(prev => prev ? { ...prev, resolved: true } : null);
            }
        }
    };

    const handleSelectAnomaly = async (anomaly: Anomaly) => {
        // Show it immediately with what we have
        setSelectedAnomaly(anomaly);
        // Then fetch full detail (with logs) in background
        const detail = await api.getAnomalyDetail(anomaly.id);
        if (detail && !detail.error) {
            setSelectedAnomaly(detail);
        }
    };

    useEffect(() => {
        loadAnomalies();
    }, [filterSeverity]);

    // Auto-refresh every 60s
    useEffect(() => {
        const interval = setInterval(loadAnomalies, 60000);
        return () => clearInterval(interval);
    }, [filterSeverity]);

    // Filter by search
    const filteredAnomalies = anomalies.filter(a => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            a.resource_name.toLowerCase().includes(term) ||
            a.namespace.toLowerCase().includes(term) ||
            a.message.toLowerCase().includes(term) ||
            a.category.toLowerCase().includes(term)
        );
    });

    const statCards = [
        { label: 'Critical', value: stats.critical, filterKey: 'critical', icon: <XCircle size={18} className="text-red-400" />, accent: '#EF4444' },
        { label: 'Errors', value: stats.errors, filterKey: 'error', icon: <AlertCircle size={18} className="text-orange-400" />, accent: '#F97316' },
        { label: 'Warnings', value: stats.warnings, filterKey: 'warning', icon: <AlertTriangle size={18} className="text-yellow-400" />, accent: '#EAB308' },
        { label: 'Resolved', value: stats.resolved, filterKey: '', icon: <CheckCircle2 size={18} className="text-green-400" />, accent: '#22C55E' },
    ];

    return (
        <div className="p-6 md:p-8 h-full flex flex-col" id="cluster-anomalies-page">
            <style>{`
                @keyframes slide-in-right {
                    from { opacity: 0; transform: translateX(30px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
            `}</style>

            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1.5">
                        <div className="p-2 rounded-xl bg-red-900/15 border border-red-500/20">
                            <ShieldAlert className="text-red-400" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-100">Cluster Anomalies</h1>
                            <p className="text-slate-500 text-xs">Monitor abnormal behaviors across your Kubernetes cluster</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleScan}
                        disabled={scanning}
                        className="flex items-center gap-2 px-4 py-2.5 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 rounded-xl transition-all duration-200 disabled:opacity-50"
                    >
                        <Radar size={15} className={scanning ? 'animate-spin' : ''} />
                        <span className="text-sm font-medium">{scanning ? 'Scanning…' : 'Scan Now'}</span>
                    </button>
                    <button
                        onClick={loadAnomalies}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2.5 bg-slate-800/50 hover:bg-slate-800/80 text-slate-400 border border-slate-700/40 rounded-xl transition-all duration-200 disabled:opacity-50"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {statCards.map(s => {
                    const isActive = s.filterKey !== '' && filterSeverity === s.filterKey;
                    return (
                        <button
                            key={s.label}
                            onClick={() => {
                                if (s.filterKey === '') return; // Resolved card is not filterable
                                setFilterSeverity(filterSeverity === s.filterKey ? '' : s.filterKey);
                            }}
                            className={`text-left bg-slate-800/40 backdrop-blur-sm rounded-xl p-3.5 transition-all duration-200 group hover:bg-slate-800/60 ${s.filterKey === '' ? 'cursor-default' : 'cursor-pointer'
                                }`}
                            style={{
                                borderWidth: isActive ? '2px' : '1px',
                                borderColor: isActive ? s.accent : 'rgba(51,65,85,0.4)',
                                borderLeftWidth: '3px',
                                borderLeftColor: s.accent,
                                boxShadow: isActive ? `0 0 12px ${s.accent}20` : 'none',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                {s.icon}
                                <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                                {isActive && (
                                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300">
                                        Active
                                    </span>
                                )}
                            </div>
                            <span className="text-2xl font-bold text-slate-100">{s.value}</span>
                        </button>
                    );
                })}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* List */}
                <div className={`transition-all duration-300 bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-xl overflow-hidden flex flex-col min-w-0 ${selectedAnomaly ? 'flex-1' : 'w-full'
                    }`}>
                    {/* Search & Filter bar */}
                    <div className="p-3 border-b border-slate-700/40 bg-slate-800/30 flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search anomalies..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-600/40 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded">
                                    <X size={14} className="text-slate-400" />
                                </button>
                            )}
                        </div>
                        {filterSeverity && (
                            <button
                                onClick={() => setFilterSeverity('')}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/40 border border-slate-600/40 rounded-lg text-xs text-slate-300 hover:bg-slate-700/60 transition-colors"
                            >
                                <Filter size={12} />
                                {filterSeverity}
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* List content */}
                    <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-1">
                        {loading && (
                            <div className="flex flex-col items-center justify-center h-full gap-3">
                                <RefreshCw className="animate-spin text-brand" size={32} />
                                <span className="text-slate-500 text-sm">Loading anomalies…</span>
                            </div>
                        )}

                        {!loading && filteredAnomalies.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                                <div className="p-4 rounded-2xl bg-green-900/10 border border-green-500/20">
                                    <CheckCircle2 size={40} className="text-green-400" />
                                </div>
                                <p className="text-slate-300 font-medium">
                                    {searchTerm ? 'No matching anomalies' : 'No anomalies detected'}
                                </p>
                                <p className="text-slate-500 text-sm text-center max-w-xs">
                                    {searchTerm
                                        ? 'Try a different search term'
                                        : 'Your cluster looks healthy! Click "Scan Now" to run a fresh scan.'}
                                </p>
                            </div>
                        )}

                        {!loading && filteredAnomalies.map(anomaly => (
                            <AnomalyRow
                                key={anomaly.id}
                                anomaly={anomaly}
                                isSelected={selectedAnomaly?.id === anomaly.id}
                                onClick={() => handleSelectAnomaly(anomaly)}
                            />
                        ))}
                    </div>

                    {/* Footer */}
                    {!loading && filteredAnomalies.length > 0 && (
                        <div className="p-3 border-t border-slate-700/40 bg-slate-800/30">
                            <p className="text-xs text-slate-500 text-center">
                                Showing {filteredAnomalies.length} of {anomalies.length} anomalies
                                {filterSeverity && ` (filtered: ${filterSeverity})`}
                                {' · '}Auto-refreshes every 60s
                            </p>
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                {selectedAnomaly && (
                    <AnomalyDetail
                        anomaly={selectedAnomaly}
                        onClose={() => setSelectedAnomaly(null)}
                        onResolve={handleResolve}
                    />
                )}

                {/* Empty detail hint */}
                {!selectedAnomaly && !loading && anomalies.length > 0 && (
                    <div className="hidden lg:flex w-[420px] shrink-0 bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-xl items-center justify-center p-8">
                        <div className="text-center">
                            <div className="p-4 rounded-2xl bg-slate-700/30 border border-slate-600/30 inline-block mb-4">
                                <ShieldAlert size={40} className="text-slate-500" />
                            </div>
                            <p className="text-slate-400 font-medium mb-2">No Anomaly Selected</p>
                            <p className="text-slate-500 text-sm">Click an anomaly to view details and logs</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClusterAnomaliesPage;
