const API_BASE_URL = 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Agents API
  async getAgents() {
    return this.request('/agents');
  }

  async getAgent(id) {
    return this.request(`/agents/${id}`);
  }

  async createAgent(agentData) {
    return this.request('/agents', {
      method: 'POST',
      body: agentData,
    });
  }

  async updateAgent(id, agentData) {
    return this.request(`/agents/${id}`, {
      method: 'PUT',
      body: agentData,
    });
  }

  async deleteAgent(id) {
    return this.request(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  // Sessions API
  async getSessions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/sessions?${queryString}` : '/sessions';
    return this.request(endpoint);
  }

  async getSession(id) {
    return this.request(`/sessions/${id}`);
  }

  async getSessionStats(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/sessions/stats?${queryString}` : '/sessions/stats';
    return this.request(endpoint);
  }

  async createSession(sessionData) {
    return this.request('/sessions', {
      method: 'POST',
      body: sessionData,
    });
  }

  async updateSession(id, sessionData) {
    return this.request(`/sessions/${id}`, {
      method: 'PUT',
      body: sessionData,
    });
  }

  async deleteSession(id) {
    return this.request(`/sessions/${id}`, {
      method: 'DELETE',
    });
  }

  // Analytics API
  async getAnalytics(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/analytics?${queryString}` : '/analytics';
    return this.request(endpoint);
  }

  async getRealtimeAnalytics() {
    return this.request('/analytics/realtime');
  }

  // Auth API
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: credentials,
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async updateUser(userData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: userData,
    });
  }

  async changePassword(passwordData) {
    return this.request('/auth/password', {
      method: 'PUT',
      body: passwordData,
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Function management methods
  async getAgentFunctions(agentId) {
    return this.request(`/functions/agent/${agentId}`);
  }

  async createAgentFunction(agentId, functionData) {
    return this.request(`/functions/agent/${agentId}`, {
      method: 'POST',
      body: functionData,
    });
  }

  async updateAgentFunction(functionId, functionData) {
    return this.request(`/functions/${functionId}`, {
      method: 'PUT',
      body: functionData,
    });
  }

  async deleteAgentFunction(functionId) {
    return this.request(`/functions/${functionId}`, {
      method: 'DELETE',
    });
  }

  async executeFunction(functionId, params = {}) {
    return this.request(`/functions/${functionId}/execute`, {
      method: 'POST',
      body: { params },
    });
  }

  // Calls API
  async getCalls(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = queryString ? `/calls?${queryString}` : '/calls';
    return this.request(endpoint);
  }

  async initiateCall(callData) {
    return this.request('/calls/initiate', {
      method: 'POST',
      body: callData,
    });
  }

  async getCallStatus(callId) {
    return this.request(`/calls/${callId}/status`);
  }

  async hangupCall(callId) {
    return this.request(`/calls/${callId}/hangup`, {
      method: 'POST',
    });
  }

  async getCallConversation(callId) {
    return this.request(`/calls/${callId}/conversation`);
  }

  async getCallStats() {
    return this.request('/calls/stats');
  }

  // Settings API
  async getSettings() {
    return this.request('/settings');
  }

  async updateSettings(settingsData) {
    return this.request('/settings', {
      method: 'PUT',
      body: settingsData,
    });
  }

  async getIntegrations() {
    return this.request('/settings/integrations');
  }

  async updateIntegration(integrationName, config) {
    return this.request(`/settings/integrations/${integrationName}`, {
      method: 'PUT',
      body: config,
    });
  }

  async testIntegration(integrationName) {
    return this.request(`/settings/integrations/${integrationName}/test`, {
      method: 'POST',
    });
  }

  // User Profile API
  async getUserProfile() {
    return this.request('/user/profile');
  }

  async updateUserProfile(profileData) {
    return this.request('/user/profile', {
      method: 'PUT',
      body: profileData,
    });
  }

  // Custom Functions API
  async getCustomFunctions() {
    return this.request('/custom-functions');
  }

  async createCustomFunction(functionData) {
    return this.request('/custom-functions', {
      method: 'POST',
      body: functionData,
    });
  }

  async updateCustomFunction(functionId, functionData) {
    return this.request(`/custom-functions/${functionId}`, {
      method: 'PUT',
      body: functionData,
    });
  }

  async deleteCustomFunction(functionId) {
    return this.request(`/custom-functions/${functionId}`, {
      method: 'DELETE',
    });
  }

  async testCustomFunction(functionId, params = {}) {
    return this.request(`/custom-functions/${functionId}/test`, {
      method: 'POST',
      body: { params },
    });
  }

}

export default new ApiService();
