import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Clock, CheckCircle, XCircle, Plus, Bot, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import CallInterface from '../components/CallInterface';
import api from '../services/api';

const CallsEnhanced = () => {
  const { agents } = useApp();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCallInterface, setShowCallInterface] = useState(false);
  const [preSelectedContact, setPreSelectedContact] = useState(null);

  // Load calls on component mount
  useEffect(() => {
    loadCalls();
  }, []);

  // Ensure agents is always an array
  const safeAgents = Array.isArray(agents) ? agents : [];

  // Handle URL parameters for pre-selected contact
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const contactParam = urlParams.get('contact');
    
    if (contactParam) {
      try {
        const contact = JSON.parse(decodeURIComponent(contactParam));
        setPreSelectedContact(contact);
        setShowCallInterface(true);
      } catch (error) {
        console.error('Error parsing contact parameter:', error);
      }
    }
  }, []);

  const loadCalls = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getSessions({ limit: 50 });
      setCalls(response.sessions || response || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCallComplete = (callData) => {
    console.log('Call completed:', callData);
    // Refresh calls list
    loadCalls();
    setShowCallInterface(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'in_progress':
      case 'ringing':
        return <Clock className="w-5 h-5 text-blue-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
      case 'ringing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (duration) => {
    if (!duration) return '0:00';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Calls</h1>
          <p className="text-gray-600">Manage and initiate AI-powered voice calls</p>
        </div>
        <button
          onClick={() => setShowCallInterface(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Call
        </button>
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
              <p className="text-2xl font-bold text-gray-900">{calls.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Successful</p>
              <p className="text-2xl font-bold text-gray-900">
                {calls.filter(call => call.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-gray-900">
                {calls.filter(call => call.status === 'failed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="w-6 h-6 text-purple-600" />
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

      {/* Call Interface Modal */}
      {showCallInterface && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Make AI Call</h2>
                <button
                  onClick={() => setShowCallInterface(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <CallInterface 
                onCallComplete={handleCallComplete} 
                preSelectedContact={preSelectedContact}
                agents={safeAgents}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading calls: {error}</p>
        </div>
      )}

      {/* Calls List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Calls</h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading calls...</span>
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Phone className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No calls yet</h3>
            <p className="text-gray-600 mb-4">Start by making your first AI call</p>
            <button
              onClick={() => setShowCallInterface(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Make First Call
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {calls.map((call) => (
              <div key={call.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getStatusIcon(call.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <p className="text-sm font-medium text-gray-900">
                            {call.customer_name || 'Unknown'}
                          </p>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatPhoneNumber(call.phone_number)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center space-x-4">
                        <div className="flex items-center space-x-1">
                          <Bot className="w-4 h-4 text-gray-400" />
                          <p className="text-sm text-gray-600">
                            {call.agent?.name || 'Unknown Agent'}
                          </p>
                        </div>
                        {call.duration && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <p className="text-sm text-gray-600">
                              {formatDuration(call.duration)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                    <p className="text-sm text-gray-500">
                      {call.started_at ? new Date(call.started_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallsEnhanced;
