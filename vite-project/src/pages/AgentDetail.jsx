import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Phone, MessageSquare, Settings, Play, Pause, Copy, Edit, Trash2, BarChart3, Loader2, Code } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import FunctionManager from '../components/FunctionManager';

const AgentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { updateAgent, deleteAgent } = useApp();
    const [activeTab, setActiveTab] = useState('overview');
    const [agent, setAgent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});

    const fetchAgent = useCallback(async () => {
        try {
            setLoading(true);
            const agentData = await api.getAgent(id);
            setAgent(agentData);
            setEditForm({
                name: agentData.name || '',
                description: agentData.description || '',
                aiPrompt: agentData.aiPrompt || '',
                voice: agentData.voice || 'Emma',
                language: agentData.language || 'English',
                model: agentData.model || 'gpt-4o-mini',
                webhookUrl: agentData.webhookUrl || ''
            });
        } catch (error) {
            setError('Failed to load agent details');
            console.error('Error fetching agent:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAgent();
    }, [fetchAgent]);

    const tabs = [
        { id: 'overview', name: 'Overview' },
        { id: 'configuration', name: 'Configuration' },
        { id: 'functions', name: 'Functions' },
        { id: 'analytics', name: 'Analytics' },
        { id: 'integrations', name: 'Integrations' }
    ];

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

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // You could add a toast notification here
    };

    const handleToggleStatus = async () => {
        try {
            setActionLoading(true);
            const newStatus = agent.status === 'active' ? 'paused' : 'active';
            const updatedAgent = await updateAgent(agent.id, { ...agent, status: newStatus });
            setAgent(updatedAgent);
        } catch (error) {
            setError('Failed to update agent status');
            console.error('Error updating agent status:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        try {
            setActionLoading(true);
            const updatedAgent = await updateAgent(agent.id, { ...agent, ...editForm });
            setAgent(updatedAgent);
            setIsEditing(false);
        } catch (error) {
            setError('Failed to update agent');
            console.error('Error updating agent:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditForm({
            name: agent.name,
            description: agent.description,
            voice: agent.voice,
            language: agent.language,
            model: agent.model,
            webhookUrl: agent.webhookUrl
        });
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
            try {
                setActionLoading(true);
                await deleteAgent(agent.id);
                navigate('/');
            } catch (error) {
                setError('Failed to delete agent');
                console.error('Error deleting agent:', error);
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleEditFormChange = (e) => {
        setEditForm({
            ...editForm,
            [e.target.name]: e.target.value
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading agent details...</span>
            </div>
        );
    }

    if (error && !agent) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
                <button 
                    onClick={() => navigate('/')}
                    className="mt-2 text-blue-600 hover:text-blue-800"
                >
                    ← Back to Agents
                </button>
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Agent not found</p>
                <button 
                    onClick={() => navigate('/')}
                    className="mt-2 text-blue-600 hover:text-blue-800"
                >
                    ← Back to Agents
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link
                        to="/"
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{agent.name || 'Unknown Agent'}</h1>
                        <p className="text-gray-600">{agent.description || 'No description available'}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(agent.status)}`}>
                        {agent.status}
                    </span>
                    <button 
                        onClick={handleToggleStatus}
                        disabled={actionLoading}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {actionLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : agent.status === 'active' ? (
                            <>
                                <Pause className="w-4 h-4 mr-2" />
                                Pause Agent
                            </>
                        ) : (
                            <>
                                <Play className="w-4 h-4 mr-2" />
                                Start Agent
                            </>
                        )}
                    </button>
                    <button 
                        onClick={handleDelete}
                        disabled={actionLoading}
                        className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Phone className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Calls</p>
                            <p className="text-2xl font-bold text-gray-900">{(agent.calls || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <MessageSquare className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Success Rate</p>
                            <p className="text-2xl font-bold text-gray-900">{agent.successRate || 0}%</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Bot className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                            <p className="text-2xl font-bold text-gray-900">{agent.avgDuration || '0:00'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Settings className="w-6 h-6 text-orange-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Last Active</p>
                            <p className="text-2xl font-bold text-gray-900">{agent.lastActive || 'Never'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Information</h3>
                                    <dl className="space-y-3">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Agent ID</dt>
                                            <dd className="mt-1 text-sm text-gray-900 font-mono">{agent.id}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Voice</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{agent.voice || 'Default'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Language</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{agent.language || 'English'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Model</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{agent.model || 'gpt-4'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Created</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{agent.createdAt}</dd>
                                        </div>
                                    </dl>
                                </div>

                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">API Information</h3>
                                    <dl className="space-y-3">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">API Key</dt>
                                            <dd className="mt-1 flex items-center space-x-2">
                                                <span className="text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                                                    {agent.apiKey || 'No API key'}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(agent.apiKey || '')}
                                                    className="p-1 text-gray-400 hover:text-gray-600"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Webhook URL</dt>
                                            <dd className="mt-1 flex items-center space-x-2">
                                                <span className="text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                                                    {agent.webhookUrl || 'No webhook URL'}
                                                </span>
                                                <button
                                                    onClick={() => copyToClipboard(agent.webhookUrl || '')}
                                                    className="p-1 text-gray-400 hover:text-gray-600"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'configuration' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium text-gray-900">Agent Configuration</h3>
                                {!isEditing ? (
                                    <button 
                                        onClick={handleEdit}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit Configuration
                                    </button>
                                ) : (
                                    <div className="flex space-x-2">
                                        <button 
                                            onClick={handleCancelEdit}
                                            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleSaveEdit}
                                            disabled={actionLoading}
                                            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {actionLoading ? (
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : null}
                                            Save Changes
                                        </button>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                    <p className="text-red-800 text-sm">{error}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Agent Name</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={isEditing ? (editForm.name || '') : (agent?.name || '')}
                                            onChange={isEditing ? handleEditFormChange : undefined}
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            readOnly={!isEditing}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Description</label>
                                        <textarea
                                            name="description"
                                            value={isEditing ? (editForm.description || '') : (agent?.description || '')}
                                            onChange={isEditing ? handleEditFormChange : undefined}
                                            rows={3}
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            readOnly={!isEditing}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">AI Prompt</label>
                                        <textarea
                                            name="aiPrompt"
                                            value={isEditing ? (editForm.aiPrompt || '') : (agent?.aiPrompt || '')}
                                            onChange={isEditing ? handleEditFormChange : undefined}
                                            rows={6}
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            readOnly={!isEditing}
                                            placeholder="Enter the AI prompt that defines how this agent should behave..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Voice</label>
                                        <select
                                            name="voice"
                                            value={isEditing ? (editForm.voice || 'Emma') : (agent?.voice || 'Emma')}
                                            onChange={isEditing ? handleEditFormChange : undefined}
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            disabled={!isEditing}
                                        >
                                            <option value="Emma">Emma</option>
                                            <option value="James">James</option>
                                            <option value="Sarah">Sarah</option>
                                            <option value="Michael">Michael</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Language</label>
                                        <select
                                            name="language"
                                            value={isEditing ? (editForm.language || 'English') : (agent?.language || 'English')}
                                            onChange={isEditing ? handleEditFormChange : undefined}
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            disabled={!isEditing}
                                        >
                                            <option value="English">English</option>
                                            <option value="Spanish">Spanish</option>
                                            <option value="French">French</option>
                                            <option value="German">German</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Model</label>
                                        <select
                                            name="model"
                                            value={isEditing ? (editForm.model || 'gpt-4o-mini') : (agent?.model || 'gpt-4o-mini')}
                                            onChange={isEditing ? handleEditFormChange : undefined}
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            disabled={!isEditing}
                                        >
                                            <option value="gpt-4">GPT-4</option>
                                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                            <option value="claude-3">Claude 3</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
                                        <input
                                            type="url"
                                            name="webhookUrl"
                                            value={isEditing ? (editForm.webhookUrl || '') : (agent?.webhookUrl || '')}
                                            onChange={isEditing ? handleEditFormChange : undefined}
                                            className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            readOnly={!isEditing}
                                            placeholder="https://api.example.com/webhook"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'functions' && (
                        <div className="space-y-6">
                            <FunctionManager agentId={id} />
                        </div>
                    )}

                    {activeTab === 'analytics' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-medium text-gray-900">Analytics</h3>
                            <div className="text-center py-12 text-gray-500">
                                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>Analytics charts and detailed metrics will be displayed here.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'integrations' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-medium text-gray-900">Integrations</h3>
                            <div className="text-center py-12 text-gray-500">
                                <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>Integration settings and webhook configurations will be displayed here.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgentDetail;
