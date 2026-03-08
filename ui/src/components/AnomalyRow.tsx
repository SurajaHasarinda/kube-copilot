import React from 'react';
import { Anomaly } from '../types';
import { XCircle, AlertCircle, AlertTriangle, Server, Box, Activity, CircleDot } from 'lucide-react';

export const SEVERITY_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string; label: string }> = {
    critical: { icon: <XCircle size={16} />, color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500/30', label: 'Critical' },
    error: { icon: <AlertCircle size={16} />, color: 'text-orange-400', bg: 'bg-orange-900/20', border: 'border-orange-500/30', label: 'Error' },
    warning: { icon: <AlertTriangle size={16} />, color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-500/30', label: 'Warning' },
};

export const getSeverityConfig = (severity: string) =>
    SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;

export const formatTimestamp = (ts: string) => {
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

        return { relative, full: date.toLocaleString() };
    } catch {
        return { relative: ts, full: ts };
    }
};

export const getResourceIcon = (type: string) => {
    switch (type) {
        case 'pod': return <Server size={14} className="text-green-400" />;
        case 'deployment': return <Box size={14} className="text-blue-400" />;
        case 'node': return <Activity size={14} className="text-purple-400" />;
        default: return <CircleDot size={14} className="text-slate-400" />;
    }
};

export const AnomalyRow: React.FC<{
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
                ${isSelected ? `${sevConfig.bg} ring-1 ${sevConfig.border}` : 'hover:bg-slate-700/20'}
                ${anomaly.resolved ? 'opacity-50' : ''}
            `}
            style={{
                borderLeft: `3px solid ${isSelected ? (
                    anomaly.severity === 'critical' ? '#EF4444' :
                        anomaly.severity === 'error' ? '#F97316' : '#EAB308'
                ) : 'transparent'}`
            }}
        >
            <div className={`p-2 rounded-lg ${sevConfig.bg} ${sevConfig.color} shrink-0`}>
                {sevConfig.icon}
            </div>
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
            <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">{anomaly.namespace}</span>
                <span className="text-[10px] text-slate-500" title={time.full}>{time.relative}</span>
            </div>
        </div>
    );
};
