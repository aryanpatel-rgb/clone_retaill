import { useState, useEffect } from 'react';
import { Plus, Settings, CheckCircle, XCircle, ExternalLink, Key, Calendar, MessageSquare, CreditCard, Database, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Integrations = () => {
    const { user } = useApp();
    const [integrations, setIntegrations] = useState([]);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [selectedIntegration, setSelectedIntegration] = useState(null);
    const [configForm, setConfigForm] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    // Available integrations
    const availableIntegrations = [
        {
            id: 'calcom',
            name: 'Cal.com',
            description: 'Calendar scheduling and appointment booking',
            icon: Calendar,
            color: 'bg-blue-500',
            status: 'connected',
            config: {
                apiKey: 'cal_live_ab4d1bf553fdebc1ff2be9325500a150',
                eventTypeId: '3053103',
                timezone: 'UTC'
            },
            features: ['Check availability', 'Book appointments', 'Cancel bookings'],
            category: 'calendar'
        },
        {
            id: 'twilio',
            name: 'Twilio',
            description: 'SMS messaging and phone calls',
            icon: MessageSquare,
            color: 'bg-red-500',
            status: 'available',
            config: {},
            features: ['Send SMS', 'Make calls', 'Receive messages'],
            category: 'communication'
        },
        {
            id: 'stripe',
            name: 'Stripe',
            description: 'Payment processing and billing',
            icon: CreditCard,
            color: 'bg-purple-500',
            status: 'available',
            config: {},
            features: ['Process payments', 'Manage subscriptions', 'Handle refunds'],
            category: 'payment'
        },
        {
            id: 'salesforce',
            name: 'Salesforce',
            description: 'CRM and customer management',
            icon: Database,
            color: 'bg-green-500',
            status: 'available',
            config: {},
            features: ['Sync contacts', 'Update records', 'Create opportunities'],
            category: 'crm'
        },
        {
            id: 'zapier',
            name: 'Zapier',
            description: 'Automation and workflow integration',
            icon: Zap,
            color: 'bg-orange-500',
            status: 'available',
            config: {},
            features: ['Create workflows', 'Automate tasks', 'Connect apps'],
            category: 'automation'
        }
    ];

    useEffect(() => {
        setIntegrations(availableIntegrations);
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'connected': return 'text-green-600 bg-green-100';
            case 'available': return 'text-blue-600 bg-blue-100';
            case 'error': return 'text-red-600 bg-red-100';
            case 'pending': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'connected': return <CheckCircle className="w-4 h-4" />;
            case 'error': return <XCircle className="w-4 h-4" />;
            default: return null;
        }
    };

    const handleConnect = (integration) => {
        setSelectedIntegration(integration);
        setConfigForm(integration.config || {});
        setShowConfigModal(true);
    };

    const handleDisconnect = (integrationId) => {
        if (window.confirm('Are you sure you want to disconnect this integration?')) {
            setIntegrations(prev => prev.map(integration => 
                integration.id === integrationId 
                    ? { ...integration, status: 'available', config: {} }
                    : integration
            ));
        }
    };

    const handleConfigSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            setIntegrations(prev => prev.map(integration => 
                integration.id === selectedIntegration.id 
                    ? { ...integration, status: 'connected', config: configForm }
                    : integration
            ));
            
            setShowConfigModal(false);
            setSelectedIntegration(null);
            setConfigForm({});
        } catch (error) {
            console.error('Error configuring integration:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const ConfigModal = () => {
        if (!selectedIntegration) return null;

        const Icon = selectedIntegration.icon;

        return (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div className="mt-3">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <div className={`p-2 rounded-lg ${selectedIntegration.color} mr-3`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900">
                                    Configure {selectedIntegration.name}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowConfigModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-6">
                            {selectedIntegration.description}
                        </p>

                        <form onSubmit={handleConfigSubmit} className="space-y-4">
                            {selectedIntegration.id === 'calcom' && (
                                <>
                                    <div>
                                        <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                                            API Key
                                        </label>
                                        <input
                                            type="text"
                                            id="apiKey"
                                            value={configForm.apiKey || ''}
                                            onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="cal_live_..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="eventTypeId" className="block text-sm font-medium text-gray-700">
                                            Event Type ID
                                        </label>
                                        <input
                                            type="text"
                                            id="eventTypeId"
                                            value={configForm.eventTypeId || ''}
                                            onChange={(e) => setConfigForm(prev => ({ ...prev, eventTypeId: e.target.value }))}
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="3053103"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
                                            Timezone
                                        </label>
                                        <select
                                            id="timezone"
                                            value={configForm.timezone || 'UTC'}
                                            onChange={(e) => setConfigForm(prev => ({ ...prev, timezone: e.target.value }))}
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        >
                                            <option value="UTC">UTC</option>
                                            <option value="America/New_York">Eastern Time</option>
                                            <option value="America/Chicago">Central Time</option>
                                            <option value="America/Denver">Mountain Time</option>
                                            <option value="America/Los_Angeles">Pacific Time</option>
                                            <option value="Europe/London">London</option>
                                            <option value="Asia/Tokyo">Tokyo</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {selectedIntegration.id === 'twilio' && (
                                <>
                                    <div>
                                        <label htmlFor="accountSid" className="block text-sm font-medium text-gray-700">
                                            Account SID
                                        </label>
                                        <input
                                            type="text"
                                            id="accountSid"
                                            value={configForm.accountSid || ''}
                                            onChange={(e) => setConfigForm(prev => ({ ...prev, accountSid: e.target.value }))}
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="AC..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="authToken" className="block text-sm font-medium text-gray-700">
                                            Auth Token
                                        </label>
                                        <input
                                            type="password"
                                            id="authToken"
                                            value={configForm.authToken || ''}
                                            onChange={(e) => setConfigForm(prev => ({ ...prev, authToken: e.target.value }))}
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="Your auth token"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                                            Phone Number
                                        </label>
                                        <input
                                            type="text"
                                            id="phoneNumber"
                                            value={configForm.phoneNumber || ''}
                                            onChange={(e) => setConfigForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="+1234567890"
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            {selectedIntegration.id === 'stripe' && (
                                <>
                                    <div>
                                        <label htmlFor="publishableKey" className="block text-sm font-medium text-gray-700">
                                            Publishable Key
                                        </label>
                                        <input
                                            type="text"
                                            id="publishableKey"
                                            value={configForm.publishableKey || ''}
                                            onChange={(e) => setConfigForm(prev => ({ ...prev, publishableKey: e.target.value }))}
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="pk_live_..."
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700">
                                            Secret Key
                                        </label>
                                        <input
                                            type="password"
                                            id="secretKey"
                                            value={configForm.secretKey || ''}
                                            onChange={(e) => setConfigForm(prev => ({ ...prev, secretKey: e.target.value }))}
                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="sk_live_..."
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowConfigModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {isLoading ? 'Connecting...' : 'Connect'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    };

    const categories = [
        { id: 'all', name: 'All Integrations', count: integrations.length },
        { id: 'calendar', name: 'Calendar', count: integrations.filter(i => i.category === 'calendar').length },
        { id: 'communication', name: 'Communication', count: integrations.filter(i => i.category === 'communication').length },
        { id: 'payment', name: 'Payment', count: integrations.filter(i => i.category === 'payment').length },
        { id: 'crm', name: 'CRM', count: integrations.filter(i => i.category === 'crm').length },
        { id: 'automation', name: 'Automation', count: integrations.filter(i => i.category === 'automation').length }
    ];

    const [selectedCategory, setSelectedCategory] = useState('all');

    const filteredIntegrations = selectedCategory === 'all' 
        ? integrations 
        : integrations.filter(integration => integration.category === selectedCategory);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
                    <p className="text-gray-600">Connect your favorite tools and services</p>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex space-x-2 overflow-x-auto pb-2">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                            selectedCategory === category.id
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        {category.name} ({category.count})
                    </button>
                ))}
            </div>

            {/* Integrations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIntegrations.map((integration) => {
                    const Icon = integration.icon;
                    return (
                        <div key={integration.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center">
                                    <div className={`p-3 rounded-lg ${integration.color} mr-3`}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {integration.name}
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            {integration.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(integration.status)}`}>
                                        {getStatusIcon(integration.status)}
                                        <span className="ml-1">{integration.status}</span>
                                    </span>
                                </div>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Features:</h4>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    {integration.features.map((feature, index) => (
                                        <li key={index} className="flex items-center">
                                            <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex space-x-2">
                                {integration.status === 'connected' ? (
                                    <>
                                        <button
                                            onClick={() => handleConnect(integration)}
                                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                            <Settings className="w-4 h-4 mr-2" />
                                            Configure
                                        </button>
                                        <button
                                            onClick={() => handleDisconnect(integration.id)}
                                            className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                                        >
                                            Disconnect
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleConnect(integration)}
                                        className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Connect
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Configuration Modal */}
            {showConfigModal && <ConfigModal />}
        </div>
    );
};

export default Integrations;
