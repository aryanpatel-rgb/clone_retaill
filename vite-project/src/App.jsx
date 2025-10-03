import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Agents from './pages/Agents';
import AgentDetail from './pages/AgentDetail';
import Analytics from './pages/Analytics';
import Sessions from './pages/Sessions';
import CallsEnhanced from './pages/CallsEnhanced';
import Contacts from './pages/Contacts';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Integrations from './pages/Integrations';
import './App.css';

const Help = () => (
  <div className="text-center py-12">
    <h1 className="text-2xl font-bold text-gray-900 mb-4">Help & Support</h1>
    <p className="text-gray-600">Help documentation coming soon...</p>
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Agents />} />
              <Route path="agents/:id" element={<AgentDetail />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="calls" element={<CallsEnhanced />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="team" element={<Team />} />
              <Route path="settings" element={<Settings />} />
              <Route path="help" element={<Help />} />
            </Route>
            
            {/* Redirect any unknown routes to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
