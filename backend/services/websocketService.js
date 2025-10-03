/**
 * WebSocket Service for Real-Time Communication
 * Inspired by Retell AI's approach for lower latency communication
 */

const WebSocket = require('ws');
const logger = require('../utils/logger');
const dynamicAIService = require('./dynamicAIService');
const databaseService = require('./postgresDatabaseService');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.connections = new Map(); // Map of callId to WebSocket connection
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/llm-websocket'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    logger.info('WebSocket server initialized on /llm-websocket');
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const callId = this.extractCallId(req.url);
    
    if (!callId) {
      logger.warn('WebSocket connection without call ID');
      ws.close(1008, 'Call ID required');
      return;
    }

    // Store connection
    this.connections.set(callId, ws);
    
    logger.info('WebSocket connection established', { callId });

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(callId, message);
      } catch (error) {
        logger.error('Error parsing WebSocket message', { error: error.message });
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    // Handle connection close
    ws.on('close', () => {
      this.connections.delete(callId);
      logger.info('WebSocket connection closed', { callId });
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { callId, error: error.message });
      this.connections.delete(callId);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection_established',
      callId: callId,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Extract call ID from WebSocket URL
   */
  extractCallId(url) {
    const urlObj = new URL(url, 'http://localhost');
    return urlObj.searchParams.get('callId');
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(callId, message) {
    try {
      const { type, data } = message;

      switch (type) {
        case 'transcript':
          await this.handleTranscript(callId, data);
          break;
        
        case 'call_start':
          await this.handleCallStart(callId, data);
          break;
        
        case 'call_end':
          await this.handleCallEnd(callId, data);
          break;
        
        default:
          logger.warn('Unknown WebSocket message type', { callId, type });
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', { 
        callId, 
        error: error.message 
      });
      
      this.sendMessage(callId, {
        type: 'error',
        error: 'Internal server error'
      });
    }
  }

  /**
   * Handle live transcript
   */
  async handleTranscript(callId, transcriptData) {
    const { transcript, is_final, confidence } = transcriptData;
    
    logger.info('Received transcript', { 
      callId, 
      transcript: transcript.substring(0, 50) + '...',
      is_final,
      confidence 
    });

    // Only process final transcripts
    if (!is_final) {
      return;
    }

    // Get call information
    const call = await databaseService.getCallById(callId);
    if (!call) {
      logger.error('Call not found for transcript', { callId });
      return;
    }

    // Process with AI
    const aiResponse = await dynamicAIService.processUserInput(
      callId,
      transcript,
      call.phone_number
    );

    // Send response back
    this.sendMessage(callId, {
      type: 'response',
      response: aiResponse.response,
      conversationComplete: aiResponse.conversationComplete
    });
  }

  /**
   * Handle call start
   */
  async handleCallStart(callId, callData) {
    const { agentId, phoneNumber, customerName } = callData;
    
    logger.info('Call started via WebSocket', { callId, agentId, phoneNumber });

    // Initialize conversation
    const aiResponse = await dynamicAIService.initializeConversation(
      callId,
      agentId,
      phoneNumber,
      customerName
    );

    // Send initial response
    this.sendMessage(callId, {
      type: 'response',
      response: aiResponse.response,
      conversationComplete: aiResponse.conversationComplete
    });
  }

  /**
   * Handle call end
   */
  async handleCallEnd(callId, callData) {
    logger.info('Call ended via WebSocket', { callId });
    
    // Cleanup conversation
    dynamicAIService.cleanupConversation(callId);
    
    // Close WebSocket connection
    const ws = this.connections.get(callId);
    if (ws) {
      ws.close();
      this.connections.delete(callId);
    }
  }

  /**
   * Send message to specific call
   */
  sendMessage(callId, message) {
    const ws = this.connections.get(callId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      logger.info('Message sent via WebSocket', { callId, type: message.type });
    } else {
      logger.warn('WebSocket connection not available', { callId });
    }
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message) {
    this.connections.forEach((ws, callId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Get active connections count
   */
  getActiveConnectionsCount() {
    return this.connections.size;
  }

  /**
   * Get all active connections
   */
  getActiveConnections() {
    const connections = [];
    this.connections.forEach((ws, callId) => {
      connections.push({
        callId,
        readyState: ws.readyState,
        connected: ws.readyState === WebSocket.OPEN
      });
    });
    return connections;
  }

  /**
   * Close all connections
   */
  closeAllConnections() {
    this.connections.forEach((ws, callId) => {
      ws.close();
    });
    this.connections.clear();
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

module.exports = webSocketService;
