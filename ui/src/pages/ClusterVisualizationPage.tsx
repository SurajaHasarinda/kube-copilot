import React, { useState, useEffect } from 'react';
import { Network, RefreshCw, Box, Server, Globe, Folder, Circle, AlertCircle, X, Search } from 'lucide-react';
import { api } from '../api';
import { ClusterNode } from '../types';
import { DetailPanel } from '../components/ClusterDetailPanel';
import TreeNode from '../components/TreeNode';

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
            data.error ? setError(data.error) : setClusterData(data);
        } catch {
            setError('Failed to load cluster data. Please ensure you are authenticated and have access to the cluster.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadClusterData(); }, []);

    const getTotalCounts = () => {
        if (!clusterData) return { namespaces: 0, deployments: 0, pods: 0, services: 0 };
        let namespaces = 0, deployments = 0, pods = 0, services = 0;
        const countNodes = (node: ClusterNode) => {
            if (node.type === 'namespace') namespaces++;
            if (node.type === 'deployment') deployments++;
            if (node.type === 'pod') pods++;
            if (node.type === 'service') services++;
            node.children?.forEach(countNodes);
        };
        countNodes(clusterData);
        return { namespaces, deployments, pods, services };
    };

    const counts = getTotalCounts();

    const filterNode = (node: ClusterNode, term: string): ClusterNode | null => {
        if (!term) return node;
        const searchLower = term.toLowerCase();
        const matchesSearch = node.name.toLowerCase().includes(searchLower) || node.type.toLowerCase().includes(searchLower);
        if (node.children) {
            const filteredChildren = node.children.map(child => filterNode(child, term)).filter((child): child is ClusterNode => child !== null);
            if (filteredChildren.length > 0 || matchesSearch) return { ...node, children: filteredChildren };
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
        <div className="p-6 md:p-8 min-h-full flex flex-col" id="cluster-visualization-page">
            <style>{`
                @keyframes slide-in-right {
                    from { opacity: 0; transform: translateX(30px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.3); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(71, 85, 105, 0.5); border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 0.7); }
            `}</style>

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
                <button onClick={loadClusterData} disabled={loading} id="refresh-cluster-btn" className="flex items-center gap-2 px-4 py-2.5 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 rounded-xl transition-all duration-200 disabled:opacity-50">
                    <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    <span className="text-sm font-medium">Refresh</span>
                </button>
            </div>

            {!loading && !error && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {statCards.map(s => (
                        <div key={s.label} className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-xl p-3.5 hover:bg-slate-800/60 transition-all duration-200 group" style={{ borderLeftWidth: '3px', borderLeftColor: s.accent }}>
                            <div className="flex items-center gap-2 mb-1.5">
                                {s.icon}
                                <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                            </div>
                            <span className="text-2xl font-bold text-slate-100">{s.value}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex-1 flex gap-4 min-h-0">
                <div className={`transition-all duration-300 bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-xl flex flex-col min-w-0 ${selectedNode ? 'hidden lg:flex lg:flex-1' : 'w-full'}`}>
                    <div className="p-3 border-b border-slate-700/40 bg-slate-800/30">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text" placeholder="Search resources..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-10 py-2 bg-slate-900/50 border border-slate-600/40 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded transition-colors">
                                    <X size={14} className="text-slate-400" />
                                </button>
                            )}
                        </div>
                        {searchTerm && (
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                <Circle size={8} className="fill-brand text-brand" /> Showing results for "{searchTerm}"
                            </p>
                        )}
                    </div>

                    <div className="flex-1 p-3">
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
                                            <Circle size={12} className="animate-pulse" /> Click on any resource to view detailed information
                                        </p>
                                    </div>
                                )}
                                <TreeNode node={filteredData} level={0} selectedNode={selectedNode} onSelect={setSelectedNode} />
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

                {selectedNode && <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}

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
