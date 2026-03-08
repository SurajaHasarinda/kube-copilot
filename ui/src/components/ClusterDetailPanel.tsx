import React from 'react';
import { ClusterNode } from '../types';
import { Network, Folder, Layers, Box, Server, Globe, FileText, Lock, Circle, Activity, Wifi, Tag, Key, Database, Hash, Clock, RefreshCw, X } from 'lucide-react';

export const TYPE_COLORS: Record<string, { accent: string; bg: string; text: string; border: string }> = {
    'cluster': { accent: '#7484FC', bg: 'rgba(116,132,252,0.08)', text: 'text-brand', border: 'border-brand/30' },
    'namespace': { accent: '#3B82F6', bg: 'rgba(59,130,246,0.08)', text: 'text-blue-400', border: 'border-blue-500/30' },
    'resource-group': { accent: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', text: 'text-purple-400', border: 'border-purple-500/30' },
    'deployment': { accent: '#10B981', bg: 'rgba(16,185,129,0.08)', text: 'text-green-400', border: 'border-green-500/30' },
    'pod': { accent: '#22C55E', bg: 'rgba(34,197,94,0.08)', text: 'text-green-400', border: 'border-green-500/30' },
    'service': { accent: '#06B6D4', bg: 'rgba(6,182,212,0.08)', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    'configmap': { accent: '#F97316', bg: 'rgba(249,115,22,0.08)', text: 'text-orange-400', border: 'border-orange-500/30' },
    'secret': { accent: '#EC4899', bg: 'rgba(236,72,153,0.08)', text: 'text-pink-400', border: 'border-pink-500/30' },
};

export const getTypeColor = (type: string) =>
    TYPE_COLORS[type] || { accent: '#64748B', bg: 'rgba(100,116,139,0.08)', text: 'text-slate-400', border: 'border-slate-500/30' };

export const getNodeIcon = (type: string, status?: string, size = 16) => {
    const cls = "min-w-4 shrink-0";
    switch (type) {
        case 'cluster': return <Network size={size} className={`${cls} text-brand`} />;
        case 'namespace': return <Folder size={size} className={`${cls} text-blue-400`} />;
        case 'resource-group': return <Layers size={size} className={`${cls} text-purple-400`} />;
        case 'deployment': return <Box size={size} className={`${cls} text-green-400`} />;
        case 'pod': {
            const isHealthy = status === 'Running';
            const hasIssue = status && ['ImagePullBackOff', 'CrashLoopBackOff', 'Error', 'Pending'].includes(status);
            return <Server size={size} className={`${cls} ${hasIssue ? 'text-red-400' : isHealthy ? 'text-green-400' : 'text-yellow-400'}`} />;
        }
        case 'service': return <Globe size={size} className={`${cls} text-cyan-400`} />;
        case 'configmap': return <FileText size={size} className={`${cls} text-orange-400`} />;
        case 'secret': return <Lock size={size} className={`${cls} text-pink-400`} />;
        default: return <Circle size={size} className={`${cls} text-slate-400`} />;
    }
};

export const getStatusConfig = (status?: string) => {
    if (!status) return null;
    const isHealthy = status === 'Running' || status === 'Active';
    const hasIssue = ['ImagePullBackOff', 'CrashLoopBackOff', 'Error', 'Failed'].includes(status);
    return {
        label: status,
        dotColor: isHealthy ? 'bg-green-400' : hasIssue ? 'bg-red-400' : 'bg-yellow-400',
        textColor: isHealthy ? 'text-green-400' : hasIssue ? 'text-red-400' : 'text-yellow-400',
        bgColor: isHealthy ? 'bg-green-900/20' : hasIssue ? 'bg-red-900/20' : 'bg-yellow-900/20',
        borderColor: isHealthy ? 'border-green-500/20' : hasIssue ? 'border-red-500/20' : 'border-yellow-500/20',
    };
};

export const DetailPanel: React.FC<{ node: ClusterNode; onClose: () => void }> = ({ node, onClose }) => {
    const typeColor = getTypeColor(node.type);
    const statusConfig = getStatusConfig(node.status);

    const detailRows: { icon: React.ReactNode; label: string; value: string }[] = [];
    if (node.status) detailRows.push({ icon: <Activity size={14} className={statusConfig?.textColor} />, label: 'Status', value: node.status });
    if (node.replicas) detailRows.push({ icon: <Hash size={14} className="text-slate-400" />, label: 'Replicas', value: node.replicas });
    if (node.available !== undefined) detailRows.push({ icon: <Activity size={14} className="text-green-400" />, label: 'Available', value: String(node.available) });
    if (node.ip) detailRows.push({ icon: <Wifi size={14} className="text-blue-400" />, label: 'Pod IP', value: node.ip });
    if (node.node) detailRows.push({ icon: <Server size={14} className="text-slate-400" />, label: 'Node', value: node.node });
    if (node.restarts !== undefined) detailRows.push({ icon: <RefreshCw size={14} className={node.restarts > 0 ? "text-yellow-400" : "text-slate-400"} />, label: 'Restarts', value: String(node.restarts) });
    if (node.cluster_ip) detailRows.push({ icon: <Wifi size={14} className="text-cyan-400" />, label: 'Cluster IP', value: node.cluster_ip });
    if (node.service_type) detailRows.push({ icon: <Tag size={14} className="text-cyan-400" />, label: 'Service Type', value: node.service_type });
    if (node.ports?.length) detailRows.push({ icon: <Globe size={14} className="text-cyan-400" />, label: 'Ports', value: node.ports.join(', ') });
    if (node.secret_type) detailRows.push({ icon: <Key size={14} className="text-pink-400" />, label: 'Secret Type', value: node.secret_type });
    if (node.data_keys?.length) detailRows.push({ icon: <Database size={14} className="text-orange-400" />, label: 'Data Keys', value: node.data_keys.join(', ') });
    if (node.count !== undefined) detailRows.push({ icon: <Hash size={14} className="text-slate-400" />, label: 'Count', value: String(node.count) });
    if (node.created_at) detailRows.push({ icon: <Clock size={14} className="text-slate-400" />, label: 'Created', value: node.created_at });

    const childrenSummary: { type: string; count: number }[] = [];
    if (node.children) {
        const typeCounts: Record<string, number> = {};
        const countChildren = (children: ClusterNode[]) => {
            children.forEach(child => {
                if (child.type !== 'resource-group') typeCounts[child.type] = (typeCounts[child.type] || 0) + 1;
                if (child.children) countChildren(child.children);
            });
        };
        countChildren(node.children);
        Object.entries(typeCounts).forEach(([type, count]) => childrenSummary.push({ type, count }));
    }

    return (
        <div className="w-full lg:w-[420px] shrink-0 bg-slate-800/50 backdrop-blur-sm border-2 border-slate-700/50 rounded-xl flex flex-col shadow-2xl animate-slide-in-right">
            <div className="p-5 border-b-2 border-slate-700/50 relative" style={{ background: `linear-gradient(135deg, ${typeColor.bg}, transparent 70%)` }}>
                <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-all duration-200 hover:scale-110" title="Close">
                    <X size={18} />
                </button>
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 rounded-xl shadow-lg" style={{ backgroundColor: typeColor.bg, border: `2px solid ${typeColor.accent}40` }}>
                        {getNodeIcon(node.type, node.status, 26)}
                    </div>
                    <div className="min-w-0 flex-1 pr-8">
                        <h3 className="text-slate-100 font-bold text-base mb-0.5 truncate" title={node.name}>{node.name}</h3>
                        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: typeColor.accent }}>{node.type.replace('-', ' ')}</span>
                    </div>
                </div>
                {statusConfig && (
                    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border-2 ${statusConfig.bgColor} ${statusConfig.borderColor} shadow-sm`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.dotColor} animate-pulse shadow-lg`} />
                        <span className={`text-sm font-semibold ${statusConfig.textColor}`}>{statusConfig.label}</span>
                    </div>
                )}
            </div>

            <div className="flex-1 p-4 space-y-2">
                {detailRows.length === 0 && childrenSummary.length === 0 && (
                    <div className="text-center py-12">
                        <Circle size={40} className="text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 text-sm font-medium">No additional details available</p>
                    </div>
                )}
                {detailRows.map((row, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 hover:border-slate-600/60 hover:bg-slate-900/70 transition-all duration-200 group">
                        <div className="p-2 rounded-lg bg-slate-800/80 group-hover:bg-slate-800 transition-colors shadow-sm">{row.icon}</div>
                        <div className="min-w-0 flex-1">
                            <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1 font-medium">{row.label}</span>
                            <span className="text-sm text-slate-100 block break-words font-medium">{row.value}</span>
                        </div>
                    </div>
                ))}
                {childrenSummary.length > 0 && (
                    <div className="mt-4 pt-4 border-t-2 border-slate-700/40">
                        <h4 className="text-xs text-slate-400 uppercase tracking-widest mb-3 px-1 font-bold flex items-center gap-2">
                            <Folder size={14} /> Contains ({childrenSummary.reduce((sum, item) => sum + item.count, 0)} resources)
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {childrenSummary.map(({ type, count }) => {
                                const tc = getTypeColor(type);
                                return (
                                    <div key={type} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 hover:scale-105 transition-transform duration-200 cursor-default" style={{ backgroundColor: tc.bg, borderColor: `${tc.accent}30` }}>
                                        {getNodeIcon(type, undefined, 16)}
                                        <span className="text-xs text-slate-300 capitalize flex-1 font-medium">{type}s</span>
                                        <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-slate-900/50" style={{ color: tc.accent }}>{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
