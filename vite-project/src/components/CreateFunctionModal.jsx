import { useState } from 'react';
import { X, Calendar, Phone, MessageSquare, Settings, Plus } from 'lucide-react';

const CreateFunctionModal = ({ isOpen, onClose, onSubmit, loading }) => {
    const [formData, setFormData] = useState({
        function_type: 'end_call',
        name: '',
        description: '',
        config: {}
    });

    const defaultFunctions = {
        end_call: {
            name: 'end_call',
            description: 'End the current call when user wants to end the conversation',
            config: {}
        },
        check_availability: {
            name: 'check_availability',
            description: 'Check calendar availability for booking appointments',
            config: {
                api_key: '',
                event_type_id: '',
                timezone: 'UTC'
            }
        },
        book_appointment: {
            name: 'book_appointment',
            description: 'Book an appointment on the calendar',
            config: {
                api_key: '',
                event_type_id: '',
                timezone: 'UTC'
            }
        },
        send_sms: {
            name: 'send_sms',
            description: 'Send SMS message to user',
            config: {
                api_key: '',
                from_number: '',
                message_template: ''
            }
        },
        custom: {
            name: '',
            description: '',
            config: {
                endpoint: '',
                method: 'POST',
                headers: {},
                timeout: 120000
            }
        }
    };

    const handleFunctionTypeChange = (type) => {
        const defaultConfig = defaultFunctions[type];
        setFormData({
            function_type: type,
            name: defaultConfig.name,
            description: defaultConfig.description,
            config: { ...defaultConfig.config }
        });
    };

    const handleConfigChange = (key, value) => {
        setFormData({
            ...formData,
            config: {
                ...formData.config,
                [key]: value
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const getFunctionIcon = (type) => {
        switch (type) {
            case 'end_call':
                return <Phone className="w-5 h-5" />;
            case 'check_availability':
            case 'book_appointment':
                return <Calendar className="w-5 h-5" />;
            case 'send_sms':
                return <MessageSquare className="w-5 h-5" />;
            default:
                return <Settings className="w-5 h-5" />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900">Add Function</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-6">
                        {/* Function Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Function Type *
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(defaultFunctions).map(([type, config]) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleFunctionTypeChange(type)}
                                        className={`p-4 border-2 rounded-lg text-left transition-colors ${
                                            formData.function_type === type
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center mb-2">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center mr-2 ${
                                                formData.function_type === type ? 'bg-blue-600' : 'bg-gray-100'
                                            }`}>
                                                {getFunctionIcon(type)}
                                            </div>
                                            <span className="font-medium text-gray-900 capitalize">
                                                {type.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">{config.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Function Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Function Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., end_call"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Brief description of what this function does"
                                />
                            </div>
                        </div>

                        {/* Configuration Fields */}
                        {formData.function_type === 'check_availability' && (
                            <div className="space-y-4">
                                <h4 className="font-medium text-gray-900">Cal.com Configuration</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            API Key *
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.config.api_key || ''}
                                            onChange={(e) => handleConfigChange('api_key', e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="cal_live_..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Event Type ID *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.config.event_type_id || ''}
                                            onChange={(e) => handleConfigChange('event_type_id', e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="3060687"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Timezone
                                    </label>
                                    <select
                                        value={formData.config.timezone || 'UTC'}
                                        onChange={(e) => handleConfigChange('timezone', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="UTC">UTC</option>
                                        <option value="America/New_York">America/New_York</option>
                                        <option value="America/Los_Angeles">America/Los_Angeles</option>
                                        <option value="Europe/London">Europe/London</option>
                                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                                        <option value="Asia/Tokyo">Asia/Tokyo</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {formData.function_type === 'book_appointment' && (
                            <div className="space-y-4">
                                <h4 className="font-medium text-gray-900">Cal.com Configuration</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            API Key *
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.config.api_key || ''}
                                            onChange={(e) => handleConfigChange('api_key', e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="cal_live_..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Event Type ID *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.config.event_type_id || ''}
                                            onChange={(e) => handleConfigChange('event_type_id', e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="3060687"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Timezone
                                    </label>
                                    <select
                                        value={formData.config.timezone || 'UTC'}
                                        onChange={(e) => handleConfigChange('timezone', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="UTC">UTC</option>
                                        <option value="America/New_York">America/New_York</option>
                                        <option value="America/Los_Angeles">America/Los_Angeles</option>
                                        <option value="Europe/London">Europe/London</option>
                                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                                        <option value="Asia/Tokyo">Asia/Tokyo</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {formData.function_type === 'send_sms' && (
                            <div className="space-y-4">
                                <h4 className="font-medium text-gray-900">SMS Configuration</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            API Key *
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.config.api_key || ''}
                                            onChange={(e) => handleConfigChange('api_key', e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Your SMS API key"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            From Number *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.config.from_number || ''}
                                            onChange={(e) => handleConfigChange('from_number', e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="+1234567890"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Message Template
                                    </label>
                                    <textarea
                                        value={formData.config.message_template || ''}
                                        onChange={(e) => handleConfigChange('message_template', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Hello {name}, thank you for your interest in our services..."
                                    />
                                </div>
                            </div>
                        )}

                        {formData.function_type === 'custom' && (
                            <div className="space-y-4">
                                <h4 className="font-medium text-gray-900">Custom API Configuration</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            HTTP Method
                                        </label>
                                        <select
                                            value={formData.config.method || 'POST'}
                                            onChange={(e) => handleConfigChange('method', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="GET">GET</option>
                                            <option value="POST">POST</option>
                                            <option value="PUT">PUT</option>
                                            <option value="DELETE">DELETE</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Timeout (ms)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.config.timeout || 120000}
                                            onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        API Endpoint *
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.config.endpoint || ''}
                                        onChange={(e) => handleConfigChange('endpoint', e.target.value)}
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="https://api.example.com/endpoint"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end space-x-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Creating...' : 'Create Function'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateFunctionModal;
