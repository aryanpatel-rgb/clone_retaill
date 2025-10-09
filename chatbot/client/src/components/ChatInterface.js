import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Bot, User, Loader2, Phone, PhoneOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ChatInterface = ({ agentConfig, onBack, user }) => {
  const { getAuthHeaders } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: 'Hi! I\'m Anna from Textdrip. I\'m here to help you book your session. Is now a good time to talk?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVoiceCallModal, setShowVoiceCallModal] = useState(false);
  const [voiceCallData, setVoiceCallData] = useState({
    phoneNumber: '',
    customerName: '',
    reason: ''
  });
  const [isCalling, setIsCalling] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: inputMessage,
          messages: [...messages, userMessage],
          agentConfig: agentConfig
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: data.message,
        timestamp: new Date(),
        functionCall: data.functionCall || null
      };

      setMessages(prev => [...prev, botMessage]);

      // Handle function calls
      if (data.functionCall) {
        handleFunctionCall(data.functionCall);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleVoiceCall = async () => {
    if (!voiceCallData.phoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    setIsCalling(true);
    
    try {
      const response = await fetch('http://localhost:5001/api/voice/initiate-call', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          phoneNumber: voiceCallData.phoneNumber,
          customerName: voiceCallData.customerName,
          agentPrompt: agentConfig.prompt,
          calComApiKey: agentConfig.calComApiKey,
          calComEventId: agentConfig.calComEventId
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Add success message to chat
        const successMessage = {
          id: Date.now(),
          type: 'bot',
          content: `✅ Voice call initiated successfully! Calling ${voiceCallData.customerName || 'customer'} at ${voiceCallData.phoneNumber}. Call ID: ${result.callId}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
        
        // Close modal and reset form
        setShowVoiceCallModal(false);
        setVoiceCallData({ phoneNumber: '', customerName: '', reason: '' });
      } else {
        alert(`Failed to initiate call: ${result.error}`);
      }
    } catch (error) {
      console.error('Error initiating voice call:', error);
      alert('Failed to initiate voice call. Please try again.');
    } finally {
      setIsCalling(false);
    }
  };

  const handleFunctionCall = (functionCall) => {
    if (functionCall.name === 'initiate_voice_call') {
      setVoiceCallData({
        phoneNumber: functionCall.arguments.phoneNumber || '',
        customerName: functionCall.arguments.customerName || '',
        reason: functionCall.arguments.reason || ''
      });
      setShowVoiceCallModal(true);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-3"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center">
                <Bot className="h-8 w-8 text-primary-600 mr-3" />
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Anna - Textdrip Assistant</h1>
                  <p className="text-sm text-gray-500">Testing your AI agent</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-500">Online</span>
              </div>
              <button
                onClick={() => setShowVoiceCallModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Phone className="h-4 w-4 mr-2" />
                Make Voice Call
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-xs lg:max-w-md ${
                    message.type === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 ${
                      message.type === 'user' ? 'ml-3' : 'mr-3'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user'
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {message.type === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div
                    className={`px-4 py-2 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.functionCall && (
                      <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                        <div className="font-medium text-gray-700">Function Call:</div>
                        <div className="text-gray-600">{message.functionCall.name}</div>
                        {message.functionCall.arguments && (
                          <div className="text-gray-500 mt-1">
                            {JSON.stringify(message.functionCall.arguments, null, 2)}
                          </div>
                        )}
                      </div>
                    )}
                    <div
                      className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-primary-100' : 'text-gray-500'
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex max-w-xs lg:max-w-md">
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="px-4 py-2 rounded-lg bg-white text-gray-900 border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Anna is typing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-end space-x-3">
            <div className="flex-1">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                rows="1"
                style={{ minHeight: '40px', maxHeight: '120px' }}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Voice Call Modal */}
      {showVoiceCallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Make Voice Call</h3>
              <button
                onClick={() => setShowVoiceCallModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <PhoneOff className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={voiceCallData.phoneNumber}
                  onChange={(e) => setVoiceCallData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={voiceCallData.customerName}
                  onChange={(e) => setVoiceCallData(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Customer name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Call
                </label>
                <input
                  type="text"
                  value={voiceCallData.reason}
                  onChange={(e) => setVoiceCallData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g., follow up on appointment booking"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowVoiceCallModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleVoiceCall}
                disabled={isCalling || !voiceCallData.phoneNumber}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center"
              >
                {isCalling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calling...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Make Call
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
