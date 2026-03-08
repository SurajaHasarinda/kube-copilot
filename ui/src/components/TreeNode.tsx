import React, { useState } from 'react';
import { ChevronRight, ChevronDown, AlertCircle } from 'lucide-react';
import { ClusterNode } from '../types';
import { getTypeColor, getNodeIcon, getStatusConfig } from './ClusterDetailPanel';

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
                    ${isSelected ? 'bg-slate-700/50 ring-1 ring-slate-600/50' : 'hover:bg-slate-700/20'}`}
                style={{
                    paddingLeft: `${level * 24 + 8}px`,
                    borderLeft: level > 0 ? `2px solid ${isSelected ? typeColor.accent : 'transparent'}` : undefined,
                }}
                onClick={handleClick}
            >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {hasChildren ? (
                        isExpanded
                            ? <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
                            : <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
                    ) : (
                        <span className="w-1 h-1 rounded-full bg-slate-600" />
                    )}
                </div>

                {getNodeIcon(node.type, node.status)}

                <span className={`text-sm font-medium truncate ${isSelected ? 'text-slate-100' : 'text-slate-300 group-hover:text-slate-100'} transition-colors`}>
                    {node.name}
                </span>

                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    {node.count !== undefined && (
                        <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">{node.count}</span>
                    )}
                    {statusConfig && (
                        <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor}`} />
                            {node.status}
                        </span>
                    )}
                    {node.restarts !== undefined && node.restarts > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-900/20 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                            <AlertCircle size={10} />{node.restarts}
                        </span>
                    )}
                    {node.replicas && (
                        <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">{node.replicas}</span>
                    )}
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div>
                    {node.children!.map((child, index) => (
                        <TreeNode key={`${child.name}-${index}`} node={child} level={level + 1} selectedNode={selectedNode} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TreeNode;
