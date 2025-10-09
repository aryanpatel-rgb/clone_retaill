import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Phone, Settings, BarChart3, Calendar, User } from 'lucide-react';

const Dashboard = ({ user }) => {
  const [stats, setStats] = useState({
    totalCalls: 0,
    totalChatSessions: 0,
    completedCalls: 0,
    activeSessionsToday: 0
  });
  const [loading, setLoading] = useState(true);
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/me', {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.stats) {
          setStats(data.data.stats);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardCards = [
    {
      title: 'Total Chat Sessions',
      value: stats.totalChatSessions,
      icon: MessageSquare,
      color: 'bg-blue-500',
      description: 'All-time chat conversations'
    },
    {
      title: 'Total Voice Calls',
      value: stats.totalCalls,
      icon: Phone,
      color: 'bg-green-500',
      description: 'Voice calls initiated'
    },
    {
      title: 'Completed Calls',
      value: stats.completedCalls,
      icon: BarChart3,
      color: 'bg-purple-500',
      description: 'Successfully completed calls'
    },
    {
      title: 'Active Today',
      value: stats.activeSessionsToday,
      icon: Calendar,
      color: 'bg-orange-500',
      description: 'Active sessions today'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.username}!
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your AI chatbot and voice calling features
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Account Status</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{card.description}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chat Interface */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <MessageSquare className="h-6 w-6 text-blue-600 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900">Chat Interface</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Start a conversation with your AI assistant. Perfect for testing and customer interactions.
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start Chat
          </button>
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center mb-4">
            <Settings className="h-6 w-6 text-gray-600 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
          </div>
          <p className="text-gray-600 mb-4">
            Update your Cal.com credentials and manage your account settings.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Manage Settings
          </button>
        </div>
      </div>

      {/* Cal.com Integration Status */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cal.com Integration</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">API Key</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              user?.calcomApiKey ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {user?.calcomApiKey ? 'Configured' : 'Not Configured'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Event ID</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              user?.calcomEventId ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {user?.calcomEventId ? 'Configured' : 'Not Configured'}
            </span>
          </div>
          {user?.calcomApiKey && user?.calcomEventId ? (
            <p className="text-sm text-green-600 mt-2">
              ✅ Cal.com integration is ready! You can book appointments through the chat interface.
            </p>
          ) : (
            <p className="text-sm text-amber-600 mt-2">
              ⚠️ Configure your Cal.com credentials to enable appointment booking features.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
