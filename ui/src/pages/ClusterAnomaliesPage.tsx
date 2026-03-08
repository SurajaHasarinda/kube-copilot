import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, XCircle, AlertCircle, AlertTriangle, CheckCircle2, Search, Filter, Radar, X } from 'lucide-react';
import { api } from '../api';
import { Anomaly, AnomalyStats } from '../types';
import { AnomalyRow } from '../components/AnomalyRow';
import AnomalyDetail from '../components/AnomalyDetail';

const EMPTY_STATS: AnomalyStats = { critical: 0, errors: 0, warnings: 0, resolved: 0, total: 0 };

const ClusterAnomaliesPage: React.FC = () => {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [stats, setStats] = useState<AnomalyStats>(EMPTY_STATS);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
    const [filterSeverity, setFilterSeverity] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const loadAnomalies = async () => {
        setLoading(true);
        try {
            const data = await api.getAnomalies(undefined, filterSeverity || undefined);
            setAnomalies(data.anomalies || []);
            setStats(data.stats || EMPTY_STATS);
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
        setSelectedAnomaly(anomaly);
        const detail = await api.getAnomalyDetail(anomaly.id);
        if (detail && !detail.error) setSelectedAnomaly(detail);
    };

    useEffect(() => { loadAnomalies(); }, [filterSeverity]);
    useEffect(() => {
        const interval = setInterval(loadAnomalies, 60000);
        return () => clearInterval(interval);
    }, [filterSeverity]);

    const filteredAnomalies = anomalies.filter(a => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return a.resource_name.toLowerCase().includes(term) ||
            a.namespace.toLowerCase().includes(term) ||
            a.message.toLowerCase().includes(term) ||
            a.category.toLowerCase().includes(term);
    });

    const statCards = [
        { label: 'Critical', value: stats.critical, filterKey: 'critical', icon: <XCircle size={18} className="text-red-400" />, accent: '#EF4444' },
        { label: 'Errors', value: stats.errors, filterKey: 'error', icon: <AlertCircle size={18} className="text-orange-400" />, accent: '#F97316' },
        { label: 'Warnings', value: stats.warnings, filterKey: 'warning', icon: <AlertTriangle size={18} className="text-yellow-400" />, accent: '#EAB308' },
        { label: 'Resolved', value: stats.resolved, filterKey: 'resolved', icon: <CheckCircle2 size={18} className="text-green-400" />, accent: '#22C55E' },
    ];

    return (
        <div className="p-6 md:p-8 min-h-full flex flex-col" id="cluster-anomalies-page">
            <style>{`
                @keyframes slide-in-right {
                    from { opacity: 0; transform: translateX(30px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
            `}</style>

            <div className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                <div className="flex items-center gap-2 self-start md:self-auto">
                    <button onClick={handleScan} disabled={scanning} className="flex items-center gap-2 px-4 py-2.5 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 rounded-xl transition-all duration-200 disabled:opacity-50">
                        <Radar size={15} className={scanning ? 'animate-spin' : ''} />
                        <span className="text-sm font-medium">{scanning ? 'Scanning…' : 'Scan Now'}</span>
                    </button>
                    <button onClick={loadAnomalies} disabled={loading} className="flex items-center gap-2 px-3 py-2.5 bg-slate-800/50 hover:bg-slate-800/80 text-slate-400 border border-slate-700/40 rounded-xl transition-all duration-200 disabled:opacity-50">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {statCards.map(s => {
                    const isActive = filterSeverity === s.filterKey;
                    return (
                        <button
                            key={s.label}
                            onClick={() => setFilterSeverity(filterSeverity === s.filterKey ? '' : s.filterKey)}
                            className="text-left bg-slate-800/40 backdrop-blur-sm rounded-xl p-3.5 transition-all duration-200 group hover:bg-slate-800/60 cursor-pointer"
                            style={{
                                borderTopWidth: isActive ? '2px' : '1px', borderRightWidth: isActive ? '2px' : '1px',
                                borderBottomWidth: isActive ? '2px' : '1px', borderLeftWidth: '3px',
                                borderTopColor: isActive ? s.accent : 'rgba(51,65,85,0.4)',
                                borderRightColor: isActive ? s.accent : 'rgba(51,65,85,0.4)',
                                borderBottomColor: isActive ? s.accent : 'rgba(51,65,85,0.4)',
                                borderLeftColor: s.accent,
                                boxShadow: isActive ? `0 0 12px ${s.accent}20` : 'none',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                {s.icon}
                                <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                                {isActive && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/50 text-slate-300">Active</span>}
                            </div>
                            <span className="text-2xl font-bold text-slate-100">{s.value}</span>
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 flex gap-4 min-h-0 relative">
                <div className={`transition-all duration-300 bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-xl flex flex-col min-w-0 ${selectedAnomaly ? 'hidden lg:flex lg:flex-1' : 'w-full'}`}>
                    <div className="p-3 border-b border-slate-700/40 bg-slate-800/30 flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text" placeholder="Search anomalies..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-600/40 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded">
                                    <X size={14} className="text-slate-400" />
                                </button>
                            )}
                        </div>
                        {filterSeverity && (
                            <button onClick={() => setFilterSeverity('')} className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/40 border border-slate-600/40 rounded-lg text-xs text-slate-300 hover:bg-slate-700/60 transition-colors">
                                <Filter size={12} />{filterSeverity}<X size={12} />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 p-3 space-y-1">
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
                                <p className="text-slate-300 font-medium">{searchTerm ? 'No matching anomalies' : 'No anomalies detected'}</p>
                                <p className="text-slate-500 text-sm text-center max-w-xs">
                                    {searchTerm ? 'Try a different search term' : 'Your cluster looks healthy! Click "Scan Now" to run a fresh scan.'}
                                </p>
                            </div>
                        )}
                        {!loading && filteredAnomalies.map(anomaly => (
                            <AnomalyRow key={anomaly.id} anomaly={anomaly} isSelected={selectedAnomaly?.id === anomaly.id} onClick={() => handleSelectAnomaly(anomaly)} />
                        ))}
                    </div>

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

                {selectedAnomaly && (
                    <AnomalyDetail anomaly={selectedAnomaly} onClose={() => setSelectedAnomaly(null)} onResolve={handleResolve} />
                )}

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
