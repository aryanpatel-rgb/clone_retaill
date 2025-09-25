import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Bot, Phone, MessageSquare, Settings, MoreVertical, Play, Pause, Loader2, Trash2, Edit } from 'lucide-react';
import { useApp } from '../context/AppContext';
import CreateAgentModal from '../components/CreateAgentModal';

const Agents = () => {
    const { agents, loading, error, updateAgent, deleteAgent } = useApp();
    const [actionLoading, setActionLoading] = useState({});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState({});
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown({});
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'paused':
                return 'bg-yellow-100 text-yellow-800';
            case 'inactive':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const handleToggleStatus = async (agent) => {
        try {
            setActionLoading({ [agent.id]: true });
            const newStatus = agent.status === 'active' ? 'paused' : 'active';
            await updateAgent(agent.id, { ...agent, status: newStatus });
        } catch (error) {
            console.error('Failed to update agent status:', error);
        } finally {
            setActionLoading({ [agent.id]: false });
        }
    };

    const handleDeleteAgent = async (agentId) => {
        if (window.confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
            try {
                setActionLoading({ [agentId]: true });
                await deleteAgent(agentId);
                setShowDropdown({ [agentId]: false });
            } catch (error) {
                console.error('Failed to delete agent:', error);
            } finally {
                setActionLoading({ [agentId]: false });
            }
        }
    };

    const toggleDropdown = (agentId) => {
        setShowDropdown(prev => ({
            ...prev,
            [agentId]: !prev[agentId]
        }));
    };

    if (loading.agents) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading agents...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">Error loading agents: {error}</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
                        <p className="text-gray-600">Manage your AI voice agents</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Agent
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Bot className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Agents</p>
                                <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Phone className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Calls</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {agents.reduce((sum, agent) => sum + (agent.calls || 0), 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <MessageSquare className="w-6 h-6 text-purple-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Avg Success Rate</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {agents.length > 0 ? (agents.reduce((sum, agent) => sum + (agent.successRate || 0), 0) / agents.length).toFixed(1) : 0}%
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <Settings className="w-6 h-6 text-orange-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Active Agents</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {agents.filter(agent => agent.status === 'active').length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agents Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {agents.map((agent) => (
                        <div key={agent.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <div className="p-6">
                                {/* Agent Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center">
                                        <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                            <Bot className="w-6 h-6 text-white" />
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-lg font-semibold text-gray-900">{agent.name || 'Unknown Agent'}</h3>
                                            <p className="text-sm text-gray-600">{agent.description || 'No description available'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                                            {agent.status}
                                        </span>
                                        <div className="relative" ref={dropdownRef}>
                                            <button 
                                                onClick={() => toggleDropdown(agent.id)}
                                                className="p-1 text-gray-400 hover:text-gray-600"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            {showDropdown[agent.id] && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                                    <div className="py-1">
                                                        <Link
                                                            to={`/agents/${agent.id}`}
                                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                            onClick={() => setShowDropdown({ [agent.id]: false })}
                                                        >
                                                            <Edit className="w-4 h-4 mr-2" />
                                                            Edit Agent
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDeleteAgent(agent.id)}
                                                            disabled={actionLoading[agent.id]}
                                                            className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {actionLoading[agent.id] ? (
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                            )}
                                                            Delete Agent
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Agent Stats */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Calls</p>
                                        <p className="text-lg font-semibold text-gray-900">{(agent.calls || 0).toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Avg Duration</p>
                                        <p className="text-lg font-semibold text-gray-900">{agent.avgDuration || '0:00'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Success Rate</p>
                                        <p className="text-lg font-semibold text-gray-900">{agent.successRate || 0}%</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Last Active</p>
                                        <p className="text-lg font-semibold text-gray-900">{agent.lastActive || 'Never'}</p>
                                    </div>
                                </div>

                                {/* Agent Details */}
                                <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                                    <span>Voice: {agent.voice || 'Default'}</span>
                                    <span>Language: {agent.language || 'English'}</span>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center space-x-3">
                                    <Link
                                        to={`/agents/${agent.id}`}
                                        className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Configure
                                    </Link>
                                    <button
                                        onClick={() => handleToggleStatus(agent)}
                                        disabled={actionLoading[agent.id]}
                                        className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {actionLoading[agent.id] ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : agent.status === 'active' ? (
                                            <>
                                                <Pause className="w-4 h-4 mr-2" />
                                                Pause
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4 mr-2" />
                                                Start
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create Agent Modal */}
            <CreateAgentModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
        </>
    );
};

export default Agents;
