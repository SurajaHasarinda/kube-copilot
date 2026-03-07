import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { IncidentRecord } from '../types';
import { AlertTriangle, Clock, Terminal } from 'lucide-react';

const IncidentsPage: React.FC = () => {
    const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                const data = await api.getIncidents();
                setIncidents(data.incidents);
            } catch (err) {
                console.error("Failed to fetch incidents", err);
            } finally {
                setLoading(false);
            }
        };

        fetchIncidents();
    }, []);

    return (
        <div className="p-6 md:p-8 animate-slide-up flex flex-col gap-6 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                        <AlertTriangle className="text-warning" /> Incident History
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        A memory log of recurring issues diagnosed by the agent.
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                </div>
            ) : incidents.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center flex flex-col items-center justify-center">
                    <CheckCircle className="text-slate-600 mb-4" size={48} />
                    <h2 className="text-lg font-medium text-slate-300">No Incidents Recorded</h2>
                    <p className="text-slate-500 mt-2">The agent hasn't logged any diagnoses yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {incidents.map((incident) => (
                        <div key={incident.id} className="bg-slate-800 border border-slate-700 rounded-lg p-5 transition-all hover:border-slate-600">
                            <div className="flex items-start justify-between flex-wrap gap-4 mb-3">
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <Clock size={14} />
                                    <span>{new Date(incident.timestamp).toLocaleString()}</span>
                                    <span className="px-2 py-0.5 bg-slate-700 rounded text-xs ml-2 border border-slate-600">
                                        ns: {incident.namespace}
                                    </span>
                                </div>
                                <span className="text-xs font-mono text-slate-500">ID: #{incident.id}</span>
                            </div>

                            <div className="mb-4">
                                <h3 className="text-slate-200 font-medium flex items-center gap-2">
                                    <Terminal size={14} className="text-brand" />
                                    {incident.query}
                                </h3>
                            </div>

                            <div className="bg-slate-900 border border-slate-700/50 rounded p-4 text-sm text-slate-300">
                                <p className="whitespace-pre-wrap">{incident.diagnosis}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Import needed for empty state fallback
import { CheckCircle } from 'lucide-react';

export default IncidentsPage;
