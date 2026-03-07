import React, { useState, useEffect } from 'react';
import {
    Network,
    RefreshCw,
    ChevronRight,
    ChevronDown,
    Box,
    Layers,
    Server,
    Globe,
    FileText,
    Lock,
    Folder,
    Circle,
    AlertCircle,
    X,
    Clock,
    Hash,
    Wifi,
    Tag,
    Key,
    Database,
    Activity,
    Search
} from 'lucide-react';
import { api } from '../api';

interface ClusterNode {
    name: string;
    type: string;
    children?: ClusterNode[];
    status?: string;
    replicas?: string;
    available?: number;
    ip?: string;
    node?: string;
    restarts?: number;
    cluster_ip?: string;
    service_type?: string;
    ports?: string[];
    data_keys?: string[];
    secret_type?: string;
    count?: number;
    created_at?: string;
}

// ─── Type colors for the left accent bars & icon tints ───────────────────────
const TYPE_COLORS: Record<string, { accent: string; bg: string; text: string; border: string }> = {
    'cluster': { accent: '#7484FC', bg: 'rgba(116,132,252,0.08)', text: 'text-brand', border: 'border-brand/30' },
    'namespace': { accent: '#3B82F6', bg: 'rgba(59,130,246,0.08)', text: 'text-blue-400', border: 'border-blue-500/30' },
    'resource-group': { accent: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', text: 'text-purple-400', border: 'border-purple-500/30' },
    'deployment': { accent: '#10B981', bg: 'rgba(16,185,129,0.08)', text: 'text-green-400', border: 'border-green-500/30' },
    'pod': { accent: '#22C55E', bg: 'rgba(34,197,94,0.08)', text: 'text-green-400', border: 'border-green-500/30' },
    'service': { accent: '#06B6D4', bg: 'rgba(6,182,212,0.08)', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    'configmap': { accent: '#F97316', bg: 'rgba(249,115,22,0.08)', text: 'text-orange-400', border: 'border-orange-500/30' },
    'secret': { accent: '#EC4899', bg: 'rgba(236,72,153,0.08)', text: 'text-pink-400', border: 'border-pink-500/30' },
};

const getTypeColor = (type: string) => TYPE_COLORS[type] || { accent: '#64748B', bg: 'rgba(100,116,139,0.08)', text: 'text-slate-400', border: 'border-slate-500/30' };

const getNodeIcon = (type: string, status?: string, size = 16) => {
    const iconProps = { size, className: "min-w-4 shrink-0" };

    switch (type) {
        case 'cluster':
            return <Network {...iconProps} className={`min-w-4 shrink-0 text-brand`} />;
        case 'namespace':
            return <Folder {...iconProps} className="min-w-4 shrink-0 text-blue-400" />;
        case 'resource-group':
            return <Layers {...iconProps} className="min-w-4 shrink-0 text-purple-400" />;
        case 'deployment':
            return <Box {...iconProps} className="min-w-4 shrink-0 text-green-400" />;
        case 'pod': {
            const isHealthy = status === 'Running';
            const hasIssue = status && ['ImagePullBackOff', 'CrashLoopBackOff', 'Error', 'Pending'].includes(status);
            return <Server {...iconProps} className={`min-w-4 shrink-0 ${hasIssue ? "text-red-400" : isHealthy ? "text-green-400" : "text-yellow-400"}`} />;
        }
        case 'service':
            return <Globe {...iconProps} className="min-w-4 shrink-0 text-cyan-400" />;
        case 'configmap':
            return <FileText {...iconProps} className="min-w-4 shrink-0 text-orange-400" />;
        case 'secret':
            return <Lock {...iconProps} className="min-w-4 shrink-0 text-pink-400" />;
        default:
            return <Circle {...iconProps} className="min-w-4 shrink-0 text-slate-400" />;
    }
};

const getStatusConfig = (status?: string) => {
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

// ─── Detail Panel ────────────────────────────────────────────────────────────

const DetailPanel: React.FC<{ node: ClusterNode; onClose: () => void }> = ({ node, onClose }) => {
    const typeColor = getTypeColor(node.type);
    const statusConfig = getStatusConfig(node.status);

    const detailRows: { icon: React.ReactNode; label: string; value: string }[] = [];

    if (node.status) {
        detailRows.push({ icon: <Activity size={14} className={statusConfig?.textColor} />, label: 'Status', value: node.status });
    }
    if (node.replicas) {
        detailRows.push({ icon: <Hash size={14} className="text-slate-400" />, label: 'Replicas', value: node.replicas });
    }
    if (node.available !== undefined) {
        detailRows.push({ icon: <Activity size={14} className="text-green-400" />, label: 'Available', value: String(node.available) });
    }
    if (node.ip) {
        detailRows.push({ icon: <Wifi size={14} className="text-blue-400" />, label: 'Pod IP', value: node.ip });
    }
    if (node.node) {
        detailRows.push({ icon: <Server size={14} className="text-slate-400" />, label: 'Node', value: node.node });
    }
    if (node.restarts !== undefined) {
        detailRows.push({ icon: <RefreshCw size={14} className={node.restarts > 0 ? "text-yellow-400" : "text-slate-400"} />, label: 'Restarts', value: String(node.restarts) });
    }
    if (node.cluster_ip) {
        detailRows.push({ icon: <Wifi size={14} className="text-cyan-400" />, label: 'Cluster IP', value: node.cluster_ip });
    }
    if (node.service_type) {
        detailRows.push({ icon: <Tag size={14} className="text-cyan-400" />, label: 'Service Type', value: node.service_type });
    }
    if (node.ports && node.ports.length > 0) {
        detailRows.push({ icon: <Globe size={14} className="text-cyan-400" />, label: 'Ports', value: node.ports.join(', ') });
    }
    if (node.secret_type) {
        detailRows.push({ icon: <Key size={14} className="text-pink-400" />, label: 'Secret Type', value: node.secret_type });
    }
    if (node.data_keys && node.data_keys.length > 0) {
        detailRows.push({ icon: <Database size={14} className="text-orange-400" />, label: 'Data Keys', value: node.data_keys.join(', ') });
    }
    if (node.count !== undefined) {
        detailRows.push({ icon: <Hash size={14} className="text-slate-400" />, label: 'Count', value: String(node.count) });
    }
    if (node.created_at) {
        detailRows.push({ icon: <Clock size={14} className="text-slate-400" />, label: 'Created', value: node.created_at });
    }

    const childrenSummary: { type: string; count: number }[] = [];
    if (node.children) {
        const typeCounts: Record<string, number> = {};
        const countChildren = (children: ClusterNode[]) => {
            children.forEach(child => {
                if (child.type !== 'resource-group') {
                    typeCounts[child.type] = (typeCounts[child.type] || 0) + 1;
                }
                if (child.children) countChildren(child.children);
            });
        };
        countChildren(node.children);
        Object.entries(typeCounts).forEach(([type, count]) => {
            childrenSummary.push({ type, count });
        });
    }

    return (
        <div className="w-[420px] shrink-0 bg-slate-800/50 backdrop-blur-sm border-2 border-slate-700/50 rounded-xl flex flex-col overflow-hidden shadow-2xl animate-slide-in-right">
            {/* Detail Header */}
            <div
                className="p-5 border-b-2 border-slate-700/50 relative"
                style={{ background: `linear-gradient(135deg, ${typeColor.bg}, transparent 70%)` }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-all duration-200 hover:scale-110"
                    title="Close detail panel"
                >
                    <X size={18} />
                </button>
                <div className="flex items-center gap-3 mb-3">
                    <div
                        className="p-3 rounded-xl shadow-lg"
                        style={{ backgroundColor: typeColor.bg, border: `2px solid ${typeColor.accent}40` }}
                    >
                        {getNodeIcon(node.type, node.status, 26)}
                    </div>
                    <div className="min-w-0 flex-1 pr-8">
                        <h3 className="text-slate-100 font-bold text-base mb-0.5 truncate" title={node.name}>{node.name}</h3>
                        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: typeColor.accent }}>
                            {node.type.replace('-', ' ')}
                        </span>
                    </div>
                </div>
                {statusConfig && (
                    <div className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border-2 ${statusConfig.bgColor} ${statusConfig.borderColor} shadow-sm`}>
                        <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.dotColor} animate-pulse shadow-lg`} />
                        <span className={`text-sm font-semibold ${statusConfig.textColor}`}>{statusConfig.label}</span>
                    </div>
                )}
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-auto custom-scrollbar p-4 space-y-2">
                {detailRows.length === 0 && childrenSummary.length === 0 && (
                    <div className="text-center py-12">
                        <Circle size={40} className="text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 text-sm font-medium">No additional details available</p>
                    </div>
                )}

                {detailRows.map((row, i) => (
                    <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 hover:border-slate-600/60 hover:bg-slate-900/70 transition-all duration-200 group"
                    >
                        <div className="p-2 rounded-lg bg-slate-800/80 group-hover:bg-slate-800 transition-colors shadow-sm">{row.icon}</div>
                        <div className="min-w-0 flex-1">
                            <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1 font-medium">{row.label}</span>
                            <span className="text-sm text-slate-100 block break-words font-medium">{row.value}</span>
                        </div>
                    </div>
                ))}

                {/* Children summary */}
                {childrenSummary.length > 0 && (
                    <div className="mt-4 pt-4 border-t-2 border-slate-700/40">
                        <h4 className="text-xs text-slate-400 uppercase tracking-widest mb-3 px-1 font-bold flex items-center gap-2">
                            <Folder size={14} />
                            Contains ({childrenSummary.reduce((sum, item) => sum + item.count, 0)} resources)
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {childrenSummary.map(({ type, count }) => {
                                const tc = getTypeColor(type);
                                return (
                                    <div
                                        key={type}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 hover:scale-105 transition-transform duration-200 cursor-default"
                                        style={{ backgroundColor: tc.bg, borderColor: `${tc.accent}30` }}
                                    >
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

// ─── Tree Node ───────────────────────────────────────────────────────────────

const TreeNode: React.FC<{
    node: ClusterNode;
    level: number;
    selectedNode: ClusterNode | null;
    onSelect: (node: ClusterNode) => void;
}> = ({ node, level, selectedNode, onSelect }) => {
    const [isExpanded, setIsExpanded] = useState(level < 2);
    const hasChildren = node.children && node.children.length > 0;
    const typeColor = getTypeColor(node.type);
    const isSelected = selectedNode === node;
    const statusConfig = getStatusConfig(node.status);

    const handleClick = () => {
        if (hasChildren) setIsExpanded(!isExpanded);
        onSelect(node);
    };

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer group transition-all duration-150
                    ${isSelected
                        ? 'bg-slate-700/50 ring-1 ring-slate-600/50'
                        : 'hover:bg-slate-700/20'
                    }`}
                style={{
                    paddingLeft: `${level * 24 + 8}px`,
                    borderLeft: level > 0 ? `2px solid ${isSelected ? typeColor.accent : 'transparent'}` : undefined,
                }}
                onClick={handleClick}
            >

                {/* Expand/Collapse chevron */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {hasChildren ? (
                        isExpanded
                            ? <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
                            : <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
                    ) : (
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                    )}
                </div>

                {/* Icon */}
                {getNodeIcon(node.type, node.status)}

                {/* Name */}
                <span className={`text-sm font-medium truncate ${isSelected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-100'} transition-colors`}>
                    {node.name}
                </span>

                {/* Inline badges */}
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    {node.count !== undefined && (
                        <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                            {node.count}
                        </span>
                    )}

                    {statusConfig && (
                        <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                            {node.status}
                        </span>
                    )}

                    {node.restarts !== undefined && node.restarts > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-900/20 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                            <AlertCircle size={10} />
                            {node.restarts}
                        </span>
                    )}

                    {node.replicas && (
                        <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">
                            {node.replicas}
                        </span>
                    )}
                </div>
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
                    {node.children!.map((child, index) => (
                        <TreeNode
                            key={`${child.name}-${index}`}
                            node={child}
                            level={level + 1}
                            selectedNode={selectedNode}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

const ClusterVisualizationPage: React.FC = () => {
    const [clusterData, setClusterData] = useState<ClusterNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<ClusterNode | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const loadClusterData = async () => {
        setLoading(true);
        setError(null);
        setSelectedNode(null);
        try {
            const data = await api.getClusterStructure();
            if (data.error) {
                setError(data.error);
            } else {
                setClusterData(data);
            }
        } catch (err) {
            setError('Failed to load cluster data. Please ensure you are authenticated and have access to the cluster.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadClusterData();
    }, []);

    const getTotalCounts = () => {
        if (!clusterData) return { namespaces: 0, deployments: 0, pods: 0, services: 0 };

        let namespaces = 0;
        let deployments = 0;
        let pods = 0;
        let services = 0;

        const countNodes = (node: ClusterNode) => {
            if (node.type === 'namespace') namespaces++;
            if (node.type === 'deployment') deployments++;
            if (node.type === 'pod') pods++;
            if (node.type === 'service') services++;
            if (node.children) node.children.forEach(countNodes);
        };

        countNodes(clusterData);
        return { namespaces, deployments, pods, services };
    };

    const counts = getTotalCounts();

    // Filter tree based on search term
    const filterNode = (node: ClusterNode, term: string): ClusterNode | null => {
        if (!term) return node;

        const searchLower = term.toLowerCase();
        const matchesSearch = node.name.toLowerCase().includes(searchLower) ||
            node.type.toLowerCase().includes(searchLower);

        if (node.children) {
            const filteredChildren = node.children
                .map(child => filterNode(child, term))
                .filter((child): child is ClusterNode => child !== null);

            if (filteredChildren.length > 0 || matchesSearch) {
                return { ...node, children: filteredChildren };
            }
        } else if (matchesSearch) {
            return node;
        }

        return null;
    };

    const filteredData = clusterData && searchTerm ? filterNode(clusterData, searchTerm) : clusterData;

    const statCards = [
        { icon: <Folder size={18} className="text-blue-400" />, label: 'Namespaces', value: counts.namespaces, accent: '#3B82F6' },
        { icon: <Box size={18} className="text-green-400" />, label: 'Deployments', value: counts.deployments, accent: '#10B981' },
        { icon: <Server size={18} className="text-emerald-400" />, label: 'Pods', value: counts.pods, accent: '#22C55E' },
        { icon: <Globe size={18} className="text-cyan-400" />, label: 'Services', value: counts.services, accent: '#06B6D4' },
    ];

    return (
        <div className="p-6 md:p-8 h-full flex flex-col" id="cluster-visualization-page">
            <style>{`
                @keyframes slide-in-right {
                    from {
                        opacity: 0;
                        transform: translateX(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                .animate-slide-in-right {
                    animation: slide-in-right 0.3s ease-out;
                }
                
                /* Custom scrollbar for detail panel */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.3);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(71, 85, 105, 0.5);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(71, 85, 105, 0.7);
                }
            `}</style>
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1.5">
                        <div className="p-2 rounded-xl bg-brand/10 border border-brand/20">
                            <Network className="text-brand" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-100">Cluster Visualization</h1>
                            <p className="text-slate-500 text-xs">Explore your Kubernetes cluster resources</p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={loadClusterData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 rounded-xl transition-all duration-200 disabled:opacity-50"
                    id="refresh-cluster-btn"
                >
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    <span className="text-sm font-medium">Refresh</span>
                </button>
            </div>

            {/* Stats */}
            {!loading && !error && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {statCards.map(s => (
                        <div
                            key={s.label}
                            className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-xl p-3.5 hover:bg-slate-800/60 transition-all duration-200 group"
                            style={{ borderLeftWidth: '3px', borderLeftColor: s.accent }}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                {s.icon}
                                <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                            </div>
                            <span className="text-2xl font-bold text-slate-100">{s.value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Content: Tree + Detail Panel */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Tree View */}
                <div className={`transition-all duration-300 bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-xl overflow-hidden flex flex-col min-w-0 ${selectedNode ? 'flex-1' : 'w-full'
                    }`}>
                    {/* Search Bar */}
                    <div className="p-3 border-b border-slate-700/40 bg-slate-800/30">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search resources..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-10 py-2 bg-slate-900/50 border border-slate-600/40 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded transition-colors"
                                >
                                    <X size={14} className="text-slate-400" />
                                </button>
                            )}
                        </div>
                        {searchTerm && (
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                <Circle size={8} className="fill-brand text-brand" />
                                Showing results for "{searchTerm}"
                            </p>
                        )}
                    </div>

                    {/* Tree Content */}
                    <div className="flex-1 overflow-auto custom-scrollbar p-3">
                        {loading && (
                            <div className="flex flex-col items-center justify-center h-full gap-3">
                                <RefreshCw className="animate-spin text-brand" size={32} />
                                <span className="text-slate-500 text-sm">Loading cluster resources…</span>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center max-w-sm">
                                    <div className="p-4 rounded-2xl bg-red-900/10 border border-red-500/20 inline-block mb-4">
                                        <AlertCircle className="text-red-400" size={40} />
                                    </div>
                                    <p className="text-red-400 text-lg font-medium mb-2">Error Loading Cluster</p>
                                    <p className="text-slate-500 text-sm">{error}</p>
                                </div>
                            </div>
                        )}

                        {!loading && !error && filteredData && (
                            <>
                                {!selectedNode && !searchTerm && (
                                    <div className="mb-3 p-3 bg-brand/5 border border-brand/20 rounded-lg">
                                        <p className="text-sm text-brand flex items-center gap-2">
                                            <Circle size={12} className="animate-pulse" />
                                            Click on any resource to view detailed information
                                        </p>
                                    </div>
                                )}
                                <TreeNode
                                    node={filteredData}
                                    level={0}
                                    selectedNode={selectedNode}
                                    onSelect={setSelectedNode}
                                />
                            </>
                        )}

                        {!loading && !error && searchTerm && !filteredData && (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <Search size={40} className="text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400 font-medium mb-1">No results found</p>
                                    <p className="text-slate-500 text-sm">Try a different search term</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Detail Panel */}
                {selectedNode && (
                    <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
                )}

                {/* Empty state hint when nothing selected */}
                {!selectedNode && !loading && !error && clusterData && (
                    <div className="hidden lg:flex w-[380px] shrink-0 bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-xl items-center justify-center p-8">
                        <div className="text-center">
                            <div className="p-4 rounded-2xl bg-slate-700/30 border border-slate-600/30 inline-block mb-4">
                                <Box size={40} className="text-slate-500" />
                            </div>
                            <p className="text-slate-400 font-medium mb-2">No Resource Selected</p>
                            <p className="text-slate-500 text-sm">Select any resource from the tree to view its details</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClusterVisualizationPage;
