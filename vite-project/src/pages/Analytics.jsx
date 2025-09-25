import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, Download, Filter, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Analytics = () => {
    const { analytics, loading, error, fetchAnalytics, agents } = useApp();
    const [dateRange, setDateRange] = useState('7d');
    const [selectedAgent, setSelectedAgent] = useState('all');

    const getDateFromRange = useCallback((range) => {
        const now = new Date();
        switch (range) {
            case '24h':
                return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            case '7d':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            case '30d':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            case '90d':
                return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
            default:
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        }
    }, []);

    useEffect(() => {
        const params = {
            date_from: getDateFromRange(dateRange),
            date_to: new Date().toISOString()
        };
        
        // Only add agent_id if a specific agent is selected
        if (selectedAgent !== 'all') {
            params.agent_id = selectedAgent;
        }
        
        fetchAnalytics(params);
    }, [dateRange, selectedAgent, fetchAnalytics, getDateFromRange]);

    if (loading.analytics) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading analytics...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">Error loading analytics: {error}</p>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">No analytics data available</p>
            </div>
        );
    }

    const COLORS = ['#10B981', '#EF4444', '#F59E0B'];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
                    <p className="text-gray-600">Monitor your agent performance and insights</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="24h">Last 24 hours</option>
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                            <option value="90d">Last 90 days</option>
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Agents</option>
                            <option value="agent1">Customer Support Agent</option>
                            <option value="agent2">Sales Assistant</option>
                            <option value="agent3">Appointment Scheduler</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Total Calls</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.metrics?.totalCalls?.toLocaleString() || 0}</p>
                        </div>
                        <div className="flex items-center text-green-600">
                            <TrendingUp className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">+12.5%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Success Rate</p>
                            <p className="text-2xl font-bold text-gray-900">{analytics.metrics?.successRate || 0}%</p>
                        </div>
                        <div className="flex items-center text-green-600">
                            <TrendingUp className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">+2.1%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {analytics.metrics?.avgDuration ?
                                    `${Math.floor(analytics.metrics.avgDuration / 60)}:${String(Math.floor(analytics.metrics.avgDuration % 60)).padStart(2, '0')}` :
                                    '0:00'
                                }
                            </p>
                        </div>
                        <div className="flex items-center text-red-600">
                            <TrendingDown className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium">-0.3m</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600">Active Agents</p>
                            <p className="text-2xl font-bold text-gray-900">{agents.filter(a => a.status === 'active').length}</p>
                        </div>
                        <div className="flex items-center text-gray-600">
                            <span className="text-sm font-medium">No change</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Calls Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Calls Over Time</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analytics.callVolume || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="calls" fill="#3B82F6" />
                            <Bar dataKey="successful" fill="#10B981" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Duration Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Average Call Duration</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics.durationTrends || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="duration" stroke="#8B5CF6" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Status Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Call Status Distribution</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={analytics.statusDistribution || []}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {(analytics.statusDistribution || []).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Agent Performance */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Performance</h3>
                    <div className="space-y-4">
                        {(analytics.agentPerformance || []).map((agent, index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <h4 className="font-medium text-gray-900">{agent.name || 'Unknown Agent'}</h4>
                                    <p className="text-sm text-gray-600">{(agent.calls || 0).toLocaleString()} calls</p>
                                </div>
                                <div className="flex items-center space-x-6">
                                    <div className="text-center">
                                        <p className="text-sm text-gray-600">Success Rate</p>
                                        <p className="font-semibold text-gray-900">{agent.successRate || 0}%</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm text-gray-600">Avg Duration</p>
                                        <p className="font-semibold text-gray-900">
                                            {agent.avgDuration ?
                                                `${Math.floor(agent.avgDuration / 60)}:${String(Math.floor(agent.avgDuration % 60)).padStart(2, '0')}` :
                                                '0:00'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(Analytics);
