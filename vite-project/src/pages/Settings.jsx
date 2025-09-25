import { useState, useEffect } from 'react';
import { User, Mail, Lock, Key, Bell, Shield, Save, AlertCircle, CheckCircle, Phone, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const Settings = () => {
    const { user, updateUser, changePassword } = useApp();
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Profile form state
    const [profileForm, setProfileForm] = useState({
        name: '',
        email: ''
    });

    // Password form state
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    // Notification preferences
    const [notifications, setNotifications] = useState({
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        weeklyReports: true,
        agentAlerts: true
    });

    // Twilio configuration
    const [twilioConfig, setTwilioConfig] = useState({
        accountSid: '',
        authToken: '',
        phoneNumber: ''
    });
    const [twilioStatus, setTwilioStatus] = useState({ connected: false, testing: false });

    useEffect(() => {
        if (user) {
            setProfileForm({
                name: user.name || '',
                email: user.email || ''
            });
        }
    }, [user]);

    const tabs = [
        { id: 'profile', name: 'Profile', icon: User },
        { id: 'security', name: 'Security', icon: Lock },
        { id: 'notifications', name: 'Notifications', icon: Bell },
        { id: 'twilio', name: 'Twilio', icon: Phone },
        { id: 'api-keys', name: 'API Keys', icon: Key }
    ];

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await updateUser(profileForm);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            setIsLoading(false);
            return;
        }

        try {
            await changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to change password' });
        } finally {
            setIsLoading(false);
        }
    };

    // Load Twilio settings on component mount
    useEffect(() => {
        const loadTwilioSettings = async () => {
            try {
                const settings = await api.request('/settings');
                if (settings.twilio) {
                    setTwilioConfig({
                        accountSid: settings.twilio.accountSid || '',
                        authToken: settings.twilio.authToken || '',
                        phoneNumber: settings.twilio.phoneNumber || ''
                    });
                    setTwilioStatus({ connected: settings.twilio.enabled || false, testing: false });
                }
            } catch (error) {
                console.error('Failed to load Twilio settings:', error);
            }
        };
        loadTwilioSettings();
    }, []);

    const handleTwilioSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await api.request('/settings/twilio', {
                method: 'POST',
                body: twilioConfig
            });

            setMessage({ type: 'success', text: 'Twilio configuration saved successfully!' });
            setTwilioStatus({ connected: true, testing: false });
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Failed to save Twilio configuration' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTwilioTest = async () => {
        setTwilioStatus(prev => ({ ...prev, testing: true }));
        setMessage({ type: '', text: '' });

        try {
            const response = await api.request('/settings/twilio/test', {
                method: 'POST'
            });

            setMessage({ type: 'success', text: 'Twilio connection test successful!' });
            setTwilioStatus({ connected: true, testing: false });
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Twilio connection test failed' });
            setTwilioStatus({ connected: false, testing: false });
        }
    };

    const handleNotificationChange = (key, value) => {
        setNotifications(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const renderProfileTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
                <p className="text-sm text-gray-500">Update your personal information and contact details.</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Full Name
                    </label>
                    <input
                        type="text"
                        id="name"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address
                    </label>
                    <input
                        type="email"
                        id="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );

    const renderSecurityTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
                <p className="text-sm text-gray-500">Update your password to keep your account secure.</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                        Current Password
                    </label>
                    <input
                        type="password"
                        id="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                        New Password
                    </label>
                    <input
                        type="password"
                        id="newPassword"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                        Confirm New Password
                    </label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                            <Lock className="w-4 h-4 mr-2" />
                        )}
                        Change Password
                    </button>
                </div>
            </form>
        </div>
    );

    const renderNotificationsTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
                <p className="text-sm text-gray-500">Choose how you want to be notified about updates and alerts.</p>
            </div>

            <div className="space-y-4">
                {Object.entries(notifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-medium text-gray-900">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </h4>
                            <p className="text-sm text-gray-500">
                                {key === 'emailNotifications' && 'Receive notifications via email'}
                                {key === 'pushNotifications' && 'Receive push notifications in browser'}
                                {key === 'smsNotifications' && 'Receive notifications via SMS'}
                                {key === 'weeklyReports' && 'Get weekly performance reports'}
                                {key === 'agentAlerts' && 'Get alerts when agents need attention'}
                            </p>
                        </div>
                        <button
                            onClick={() => handleNotificationChange(key, !value)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                value ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    value ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderTwilioTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Twilio Configuration</h3>
                <p className="text-sm text-gray-500">Configure your Twilio credentials for voice calling and SMS features.</p>
            </div>

            <div className="flex items-center space-x-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${twilioStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                    {twilioStatus.connected ? 'Connected' : 'Not Connected'}
                </span>
            </div>

            <form onSubmit={handleTwilioSubmit} className="space-y-4">
                <div>
                    <label htmlFor="accountSid" className="block text-sm font-medium text-gray-700">
                        Account SID
                    </label>
                    <input
                        type="text"
                        id="accountSid"
                        value={twilioConfig.accountSid}
                        onChange={(e) => setTwilioConfig(prev => ({ ...prev, accountSid: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
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
                        value={twilioConfig.authToken}
                        onChange={(e) => setTwilioConfig(prev => ({ ...prev, authToken: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Your Twilio Auth Token"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                        Phone Number
                    </label>
                    <input
                        type="tel"
                        id="phoneNumber"
                        value={twilioConfig.phoneNumber}
                        onChange={(e) => setTwilioConfig(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="+1234567890"
                        required
                    />
                </div>

                <div className="flex space-x-3">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {isLoading ? 'Saving...' : 'Save Configuration'}
                    </button>

                    <button
                        type="button"
                        onClick={handleTwilioTest}
                        disabled={isLoading || twilioStatus.testing || !twilioStatus.connected}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {twilioStatus.testing ? 'Testing...' : 'Test Connection'}
                    </button>
                </div>
            </form>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">How to get your Twilio credentials:</h4>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Sign up for a Twilio account at <a href="https://twilio.com" target="_blank" rel="noopener noreferrer" className="underline">twilio.com</a></li>
                    <li>Go to your Twilio Console Dashboard</li>
                    <li>Find your Account SID and Auth Token in the Account Info section</li>
                    <li>Purchase a phone number from the Phone Numbers section</li>
                    <li>Enter these credentials above to enable voice calling features</li>
                </ol>
            </div>
        </div>
    );

    const renderApiKeysTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
                <p className="text-sm text-gray-500">Manage your API keys for integrations and external access.</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                    <Shield className="h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">API Key Management</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                            <p>API key management features are coming soon. This will allow you to:</p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Generate new API keys for integrations</li>
                                <li>View and manage existing keys</li>
                                <li>Set permissions and expiration dates</li>
                                <li>Monitor API usage and limits</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600">Manage your account settings and preferences.</p>
            </div>

            {message.text && (
                <div className={`mb-6 rounded-md p-4 ${
                    message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                    <div className="flex">
                        {message.type === 'success' ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-red-400" />
                        )}
                        <div className="ml-3">
                            <p className={`text-sm font-medium ${
                                message.type === 'success' ? 'text-green-800' : 'text-red-800'
                            }`}>
                                {message.text}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white shadow rounded-lg">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8 px-6">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                                        activeTab === tab.id
                                            ? 'border-blue-500 text-blue-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <Icon className="w-4 h-4 mr-2" />
                                    {tab.name}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'profile' && renderProfileTab()}
                    {activeTab === 'security' && renderSecurityTab()}
                    {activeTab === 'notifications' && renderNotificationsTab()}
                    {activeTab === 'twilio' && renderTwilioTab()}
                    {activeTab === 'api-keys' && renderApiKeysTab()}
                </div>
            </div>
        </div>
    );
};

export default Settings;
