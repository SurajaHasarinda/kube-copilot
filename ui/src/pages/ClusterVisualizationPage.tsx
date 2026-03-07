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
    AlertCircle
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

const getNodeIcon = (type: string, status?: string) => {
    const iconProps = { size: 16, className: "min-w-4" };
    
    switch (type) {
        case 'cluster':
            return <Network {...iconProps} className="text-brand" />;
        case 'namespace':
            return <Folder {...iconProps} className="text-blue-400" />;
        case 'resource-group':
            return <Layers {...iconProps} className="text-purple-400" />;
        case 'deployment':
            return <Box {...iconProps} className="text-green-400" />;
        case 'pod':
            const isHealthy = status === 'Running';
            const hasIssue = status && ['ImagePullBackOff', 'CrashLoopBackOff', 'Error', 'Pending'].includes(status);
            return <Server {...iconProps} className={hasIssue ? "text-red-400" : isHealthy ? "text-green-400" : "text-yellow-400"} />;
        case 'service':
            return <Globe {...iconProps} className="text-cyan-400" />;
        case 'configmap':
            return <FileText {...iconProps} className="text-orange-400" />;
        case 'secret':
            return <Lock {...iconProps} className="text-pink-400" />;
        default:
            return <Circle {...iconProps} className="text-slate-400" />;
    }
};

const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    const isHealthy = status === 'Running' || status === 'Active';
    const hasIssue = ['ImagePullBackOff', 'CrashLoopBackOff', 'Error', 'Failed'].includes(status);
    
    return (
        <span className={`px-2 py-0.5 text-xs rounded-full ${
            isHealthy ? 'bg-green-900/30 text-green-400' :
            hasIssue ? 'bg-red-900/30 text-red-400' :
            'bg-yellow-900/30 text-yellow-400'
        }`}>
            {status}
        </span>
    );
};

const TreeNode: React.FC<{ node: ClusterNode; level: number }> = ({ node, level }) => {
    const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first two levels
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="select-none">
            <div 
                className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-700/30 rounded cursor-pointer group"
                style={{ paddingLeft: `${level * 20 + 8}px` }}
                onClick={() => hasChildren && setIsExpanded(!isExpanded)}
            >
                {hasChildren ? (
                    isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                ) : (
                    <span className="w-3.5" />
                )}
                
                {getNodeIcon(node.type, node.status)}
                
                <span className="text-slate-200 font-medium">{node.name}</span>
                
                {node.count !== undefined && (
                    <span className="text-xs text-slate-400 ml-1">({node.count})</span>
                )}
                
                {node.status && getStatusBadge(node.status)}
                
                {node.replicas && (
                    <span className="text-xs text-slate-400 ml-2">
                        Replicas: {node.replicas}
                    </span>
                )}
                
                {node.restarts !== undefined && node.restarts > 0 && (
                    <span className="text-xs text-yellow-400 ml-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Restarts: {node.restarts}
                    </span>
                )}
                
                {node.ip && (
                    <span className="text-xs text-slate-500 ml-2">
                        IP: {node.ip}
                    </span>
                )}
                
                {node.cluster_ip && (
                    <span className="text-xs text-slate-500 ml-2">
                        {node.cluster_ip}
                    </span>
                )}
                
                {node.service_type && (
                    <span className="text-xs text-slate-400 ml-2">
                        {node.service_type}
                    </span>
                )}
                
                {node.ports && node.ports.length > 0 && (
                    <span className="text-xs text-slate-500 ml-2">
                        Ports: {node.ports.join(', ')}
                    </span>
                )}
            </div>
            
            {isExpanded && hasChildren && (
                <div>
                    {node.children!.map((child, index) => (
                        <TreeNode key={`${child.name}-${index}`} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const ClusterVisualizationPage: React.FC = () => {
    const [clusterData, setClusterData] = useState<ClusterNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadClusterData = async () => {
        setLoading(true);
        setError(null);
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
            
            if (node.children) {
                node.children.forEach(countNodes);
            }
        };

        countNodes(clusterData);
        return { namespaces, deployments, pods, services };
    };

    const counts = getTotalCounts();

    return (
        <div className="p-6 md:p-8 h-full flex flex-col">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Network className="text-brand" size={32} />
                        <h1 className="text-3xl font-bold text-slate-100">Cluster Visualization</h1>
                    </div>
                    <p className="text-slate-400">Hierarchical view of your Kubernetes cluster resources</p>
                </div>
                <button
                    onClick={loadClusterData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-md transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            {!loading && !error && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Folder size={16} className="text-blue-400" />
                            <span className="text-slate-400 text-sm">Namespaces</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-100">{counts.namespaces}</span>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Box size={16} className="text-green-400" />
                            <span className="text-slate-400 text-sm">Deployments</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-100">{counts.deployments}</span>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Server size={16} className="text-green-400" />
                            <span className="text-slate-400 text-sm">Pods</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-100">{counts.pods}</span>
                    </div>
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <Globe size={16} className="text-cyan-400" />
                            <span className="text-slate-400 text-sm">Services</span>
                        </div>
                        <span className="text-2xl font-bold text-slate-100">{counts.services}</span>
                    </div>
                </div>
            )}

            {/* Tree View */}
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-auto custom-scrollbar">
                {loading && (
                    <div className="flex items-center justify-center h-full">
                        <RefreshCw className="animate-spin text-brand" size={32} />
                    </div>
                )}
                
                {error && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
                            <p className="text-red-400 text-lg mb-2">Error Loading Cluster</p>
                            <p className="text-slate-400">{error}</p>
                        </div>
                    </div>
                )}
                
                {!loading && !error && clusterData && (
                    <TreeNode node={clusterData} level={0} />
                )}
            </div>
        </div>
    );
};

export default ClusterVisualizationPage;
