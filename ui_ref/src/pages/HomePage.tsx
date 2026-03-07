import React, { useState, useEffect } from 'react';
// import { api } from '../api';

const HomePage: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        // Example: load data on mount
        const loadInitialData = async () => {
            setLoading(true);
            try {
                // const data = await api.getData('/dashboard/stats');
                // process data...
            } catch (err) {
                console.error("Failed to fetch initial data", err);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    return (
        <div className="p-6 md:p-8 animate-slide-up flex flex-col gap-6 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Home Dashboard</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Welcome to the basic UI skeleton application logic. Data flow starts here.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button className="bg-brand hover:bg-brand/80 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer">
                        Primary Action
                    </button>
                </div>
            </div>

            {/* Main Content Sections */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Example Card */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 flex flex-col gap-2">
                    <span className="text-slate-400 text-sm">Active Metrics</span>
                    {loading ? (
                        <div className="h-8 bg-slate-700 rounded animate-pulse w-24"></div>
                    ) : (
                        <span className="text-3xl font-bold text-white">420</span>
                    )}
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 flex flex-col gap-2">
                    <span className="text-slate-400 text-sm">Status</span>
                    {loading ? (
                        <div className="h-8 bg-slate-700 rounded animate-pulse w-32"></div>
                    ) : (
                        <span className="text-3xl font-bold text-success">All Systems Go</span>
                    )}
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 flex flex-col gap-2">
                    <span className="text-slate-400 text-sm">Warnings</span>
                    {loading ? (
                        <div className="h-8 bg-slate-700 rounded animate-pulse w-12"></div>
                    ) : (
                        <span className="text-3xl font-bold text-warning">12</span>
                    )}
                </div>
            </div>

            {/* List/Table Placeholder Section */}
            <div className="bg-slate-800 border border-slate-700 rounded-lg mt-4 flex-1">
                <div className="border-b border-slate-700 p-4">
                    <h2 className="text-slate-100 font-semibold">Recent Activity</h2>
                </div>
                <div className="p-4 text-slate-400 text-sm flex items-center justify-center min-h-64">
                    {loading ? 'Initializing interface dependencies...' : 'No relevant activity found. This UI skeleton is fully set up.'}
                </div>
            </div>
        </div>
    );
};

export default HomePage;
