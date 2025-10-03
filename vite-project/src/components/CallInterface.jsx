import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Bot, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import api from '../services/api';

const CallInterface = ({ onCallComplete, preSelectedContact = null, agents = [] }) => {
  const [contacts, setContacts] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedContact, setSelectedContact] = useState(preSelectedContact || null);
  const [phoneNumber, setPhoneNumber] = useState(preSelectedContact?.phone_number || '');
  const [customerName, setCustomerName] = useState(preSelectedContact?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [callStatus, setCallStatus] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  // Load contacts only (agents are passed as prop)
  useEffect(() => {
    loadContacts();
  }, []);

  // Update phone number and customer name when preSelectedContact changes
  useEffect(() => {
    if (preSelectedContact) {
      setPhoneNumber(preSelectedContact.phone_number || '');
      setCustomerName(preSelectedContact.name || '');
      setSelectedContact(preSelectedContact);
    }
  }, [preSelectedContact]);


  const loadContacts = async () => {
    try {
      const response = await api.getContacts({ limit: 100 });
      setContacts(response.contacts || []);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const validateAgent = (agent) => {
    // Simple validation based on agent properties
    const issues = [];
    
    const hasPrompt = agent.aiPrompt && agent.aiPrompt.trim().length > 0;
    const isActive = agent.status === 'active';
    
    if (!hasPrompt) {
      issues.push('No AI prompt configured');
    }
    if (!isActive) {
      issues.push('Agent is not active');
    }
    
    const canMakeCalls = hasPrompt && isActive;
    
    const validation = {
      canMakeCalls,
      hasPrompt,
      isActive,
      twilioConfigured: true, // We'll assume Twilio is configured for now
      issues,
      agentId: agent.id
    };
    
    setValidationResult(validation);
    return validation;
  };

  const handleAgentSelect = (agent) => {
    setSelectedAgent(agent);
    setValidationResult(null);
    
    // Validate agent when selected
    const validation = validateAgent(agent);
    
    if (!validation.canMakeCalls) {
      setError(`Cannot make calls with this agent: ${validation.issues.join(', ')}`);
    } else {
      setError(null);
    }
  };

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
    setPhoneNumber(contact.phone_number);
    setCustomerName(contact.name);
  };

  const handleCall = async () => {
    if (!selectedAgent || !phoneNumber) {
      setError('Please select an agent and enter a phone number');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCallStatus('initiating');

      const response = await api.initiateCallWithValidation({
        agentId: selectedAgent.id,
        phoneNumber: phoneNumber.trim(),
        customerName: customerName.trim() || null
      });

      if (response.success) {
        setCallStatus(response.call.mock ? 'mock' : 'initiated');
        setError(null);
        
        // Show success message
        setTimeout(() => {
          setCallStatus(null);
          setPhoneNumber('');
          setCustomerName('');
          setSelectedAgent(null);
          setValidationResult(null);
          if (onCallComplete) {
            onCallComplete(response.call);
          }
        }, 3000);
      } else {
        setError(response.error || 'Failed to initiate call');
        setCallStatus(null);
      }
    } catch (error) {
      setError(error.message || 'Failed to initiate call');
      setCallStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const getAgentStatusIcon = (agent) => {
    const hasPrompt = agent.aiPrompt && agent.aiPrompt.trim().length > 0;
    const isActive = agent.status === 'active';
    
    if (hasPrompt && isActive) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    } else if (hasPrompt && !isActive) {
      return <Clock className="w-5 h-5 text-yellow-600" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getAgentStatusText = (agent) => {
    const hasPrompt = agent.aiPrompt && agent.aiPrompt.trim().length > 0;
    const isActive = agent.status === 'active';
    
    if (hasPrompt && isActive) {
      return 'Ready to call';
    } else if (!hasPrompt) {
      return 'No prompt configured';
    } else if (!isActive) {
      return 'Agent inactive';
    } else {
      return 'Not ready';
    }
  };

  const getCallStatusDisplay = () => {
    switch (callStatus) {
      case 'initiating':
        return {
          icon: <Clock className="w-6 h-6 text-blue-600 animate-spin" />,
          text: 'Initiating call...',
          color: 'text-blue-600'
        };
      case 'initiated':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-600" />,
          text: 'Call initiated successfully!',
          color: 'text-green-600'
        };
      case 'mock':
        return {
          icon: <CheckCircle className="w-6 h-6 text-yellow-600" />,
          text: 'Mock call created successfully!',
          color: 'text-yellow-600'
        };
      default:
        return null;
    }
  };

  const callStatusDisplay = getCallStatusDisplay();

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Phone className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Make AI Call</h2>
        <p className="text-gray-600">Select an agent and start a conversation</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Call Status Display */}
      {callStatusDisplay && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center">
            {callStatusDisplay.icon}
            <p className={`ml-2 font-medium ${callStatusDisplay.color}`}>
              {callStatusDisplay.text}
            </p>
          </div>
        </div>
      )}

      {/* Agent Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Agent *
        </label>
        
        {loading && agents.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading agents...</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No agents available</p>
            <p className="text-sm text-gray-500 mt-1">Create an agent first to make calls</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => handleAgentSelect(agent)}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedAgent?.id === agent.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!(agent.aiPrompt && agent.aiPrompt.trim().length > 0 && agent.status === 'active') ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Bot className="w-5 h-5 text-gray-600 mr-2" />
                      <h3 className="font-medium text-gray-900">{agent.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {agent.description || 'No description available'}
                    </p>
                    <div className="flex items-center text-xs">
                      {getAgentStatusIcon(agent)}
                      <span className="ml-1 text-gray-600">
                        {getAgentStatusText(agent)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div className="mb-6 p-4 rounded-lg border">
          <h4 className="font-medium text-gray-900 mb-2">Agent Validation</h4>
          <div className="space-y-2">
            <div className="flex items-center text-sm">
              <CheckCircle className={`w-4 h-4 mr-2 ${validationResult.hasPrompt ? 'text-green-600' : 'text-red-600'}`} />
              <span>Has Prompt: {validationResult.hasPrompt ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center text-sm">
              <CheckCircle className={`w-4 h-4 mr-2 ${validationResult.isActive ? 'text-green-600' : 'text-red-600'}`} />
              <span>Active: {validationResult.isActive ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center text-sm">
              <CheckCircle className={`w-4 h-4 mr-2 ${validationResult.twilioConfigured ? 'text-green-600' : 'text-yellow-600'}`} />
              <span>Twilio: {validationResult.twilioConfigured ? 'Configured' : 'Not configured (mock calls only)'}</span>
            </div>
            {validationResult.issues.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-red-600 font-medium">Issues:</p>
                <ul className="text-sm text-red-600 list-disc list-inside">
                  {validationResult.issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contact Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Contact (Optional)
        </label>
        <select
          value={selectedContact?.id || ''}
          onChange={(e) => {
            const contact = contacts.find(c => c.id == e.target.value);
            if (contact) {
              handleContactSelect(contact);
            } else {
              setSelectedContact(null);
              setPhoneNumber('');
              setCustomerName('');
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Or enter phone number manually below</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name} - {contact.phone_number}
              {contact.company && ` (${contact.company})`}
            </option>
          ))}
        </select>
      </div>

      {/* Phone Number Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number *
        </label>
        <input
          type="tel"
          value={phoneNumber || ''}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1 (555) 123-4567"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading || callStatus}
        />
        <p className="text-xs text-gray-500 mt-1">
          Include country code (e.g., +1 for US, +91 for India)
        </p>
      </div>

      {/* Customer Name Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Customer Name (Optional)
        </label>
        <input
          type="text"
          value={customerName || ''}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="John Doe"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading || callStatus}
        />
      </div>

      {/* Call Summary */}
      {selectedAgent && phoneNumber && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center mb-2">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <h4 className="font-semibold text-green-900">Call Summary</h4>
          </div>
          <div className="text-sm text-green-800">
            <p><strong>Agent:</strong> {selectedAgent.name}</p>
            <p><strong>Calling:</strong> {customerName || 'Unknown'} ({phoneNumber})</p>
            <p><strong>Type:</strong> AI-powered voice call</p>
          </div>
        </div>
      )}

      {/* Call Button */}
      <div className="flex items-center justify-center">
        <button
          onClick={handleCall}
          disabled={loading || callStatus || !selectedAgent || !phoneNumber}
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading || callStatus ? (
            <>
              <Clock className="w-5 h-5 mr-2 animate-spin" />
              {callStatus === 'initiating' ? 'Initiating...' : 
               callStatus === 'mock' ? 'Mock Call Created!' : 'Processing...'}
            </>
          ) : (
            <>
              <Phone className="w-5 h-5 mr-2" />
              Start Call
            </>
          )}
        </button>
      </div>

      {/* Selected Agent Info */}
      {selectedAgent && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center mb-3">
            <Bot className="w-5 h-5 text-blue-600 mr-2" />
            <h4 className="font-semibold text-blue-900">Selected Agent for Call</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-blue-800"><strong>Name:</strong> {selectedAgent.name}</p>
              <p className="text-blue-800"><strong>Status:</strong> {getAgentStatusText(selectedAgent)}</p>
            </div>
            <div>
              <p className="text-blue-800"><strong>Model:</strong> {selectedAgent.model || 'gpt-4o-mini'}</p>
              <p className="text-blue-800"><strong>Voice:</strong> {selectedAgent.voice || 'Default'}</p>
            </div>
          </div>
          {validationResult && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex items-center text-xs">
                {validationResult.canMakeCalls ? (
                  <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 mr-1" />
                )}
                <span className={validationResult.canMakeCalls ? 'text-green-700' : 'text-red-700'}>
                  {validationResult.canMakeCalls ? 'Ready to make calls' : 'Cannot make calls - check validation'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CallInterface;
