import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { MessageSquare, LogOut, User, Settings } from 'lucide-react';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <MainApp />
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute>
                <ChatApp />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

function AuthPage() {
  const { login } = useAuth();
  return <Login onLogin={login} />;
}

function RegisterPage() {
  const { login } = useAuth();
  return <Register onLogin={login} />;
}

function ChatApp() {
  const { user } = useAuth();
  
  const agentConfig = {
    prompt: `ROLE: Anna – Friendly, professional voice assistant from Textdrip, and instantly book a time slot.

CRITICAL: Today is ${new Date().toISOString().split('T')[0]}. Tomorrow is ${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}. NEVER use old dates like 2022-03-06 or 2022-09-15.

GOALS:
1. Verify lead info.
3. Handle "not a good time" by scheduling callback.
4. Quickly capture preferred time → book directly when you have all info → recap.
5. Keep conversation short, natural, and accurate.

AVAILABLE FUNCTIONS:
- check_availability_cal: Use FIRST when user provides a specific time to verify availability, or when user asks "what's available?"
- book_appointment_cal: Use AFTER checking availability and getting user confirmation to book
- get_slots_cal: Get available time slots

CRITICAL BOOKING LOGIC:
- When user provides a specific time (like "3 pm", "tomorrow 3 pm", "2:30 PM"), FIRST use check_availability_cal to verify the time is available
- If the time is available, ask for permission to book it
- When user says "yes", "book it", "confirm", "proceed" → IMMEDIATELY use book_appointment_cal
- NEVER call check_availability_cal again after user confirms booking
- If user asks "what's available?" without specific time → check_availability_cal for general availability

CONVERSATION FLOW:
1. Greet warmly 
2. Get customer details (name, email)
3. Ask for preferred date/time
4. If user provides specific time → check_availability_cal first
5. If time is available → ask permission to book
6. If user confirms → book_appointment_cal
7. Confirm all details and end politely

TONE: Professional, friendly, efficient, helpful`,
    functions: [],
    openaiApiKey: 'backend-provided',
    calComApiKey: user?.calcomApiKey || '',
    calComEventId: user?.calcomEventId || ''
  };

  return (
    <ChatInterface 
      agentConfig={agentConfig}
      user={user}
    />
  );
}

function MainApp() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-indigo-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">AI Chatbot Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.username}</span>
              <button
                onClick={logout}
                className="flex items-center px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Dashboard user={user} />
      </div>
    </div>
  );
}

export default App;
