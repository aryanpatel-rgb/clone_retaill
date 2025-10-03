/**
 * Call Management Routes
 * API endpoints for initiating and managing calls
 */

const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');
const databaseService = require('../services/postgresDatabaseService');
const dynamicAIService = require('../services/dynamicAIService');
const logger = require('../utils/logger');

// Middleware to check if Twilio is configured
const checkTwilioConfig = (req, res, next) => {
  if (!twilioService.isTwilioConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Twilio is not configured. Please add Twilio credentials to enable voice calling features.',
      configured: false
    });
  }
  next();
};

/**
 * Get all agents (for debugging)
 * GET /api/calls/agents
 */
router.get('/agents', async (req, res) => {
  try {
    const agents = await databaseService.getAllAgents();
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    logger.error('Failed to get agents', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Initiate a call (simple endpoint for frontend)
 * POST /api/calls
 */
router.post('/', async (req, res) => {
  try {
    const { agentId, phoneNumber, customerName } = req.body;

    // Validate required fields
    if (!agentId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID and phone number are required'
      });
    }

    // Check if agent exists
    const agent = await databaseService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Process and validate phone number
    let processedPhoneNumber = phoneNumber.replace(/\s+/g, '');
    
    // Auto-add country codes if not present
    if (!processedPhoneNumber.startsWith('+')) {
      const indianMobileRegex = /^[6-9]\d{9}$/;
      const indianWithCountryRegex = /^91[6-9]\d{9}$/;
      const usMobileRegex = /^[2-9]\d{9}$/;
      const usWithCountryRegex = /^1[2-9]\d{9}$/;
      
      if (indianMobileRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+91' + processedPhoneNumber;
      } else if (indianWithCountryRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+' + processedPhoneNumber;
      } else if (usMobileRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+1' + processedPhoneNumber;
      } else if (usWithCountryRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+' + processedPhoneNumber;
      } else {
        // Default to US if we can't determine
        processedPhoneNumber = '+1' + processedPhoneNumber.replace(/^1/, '');
      }
    }

    // Create call record in database
    const callData = {
      agent_id: agentId,
      phone_number: processedPhoneNumber,
      customer_name: customerName || 'Unknown',
      twilio_call_sid: null
    };

    const callId = await databaseService.createCall(callData);

    // For development/testing - simulate call initiation
    try {
      // Try to initiate the call through Twilio
      const callResult = await twilioService.initiateCall({
        to: processedPhoneNumber,
        agent: agent,
        customerName: customerName || 'Customer',
        callId: callId
      });

      if (callResult.success) {
        // Update call record with Twilio SID
        await databaseService.updateCallStatus(callId, 'ringing', {
          twilio_call_sid: callResult.callSid
        });

        logger.info('Call initiated successfully', {
          callId,
          agentId,
          phoneNumber: processedPhoneNumber,
          twilioCallSid: callResult.callSid
        });

        res.json({
          success: true,
          callId,
          twilioCallSid: callResult.callSid,
          message: 'Call initiated successfully'
        });
      } else {
        throw new Error(callResult.error);
      }
    } catch (twilioError) {
      // If Twilio fails, create a mock call for development
      logger.warn('Twilio call failed, creating mock call for development', {
        error: twilioError.message,
        callId
      });

      // Update call record with mock status
      await databaseService.updateCallStatus(callId, 'mock', {
        twilio_call_sid: 'mock-call-' + callId
      });

      res.json({
        success: true,
        callId,
        twilioCallSid: 'mock-call-' + callId,
        message: 'Mock call created (Twilio not configured)',
        mock: true
      });
    }
  } catch (error) {
    logger.error('Error initiating call', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Initiate a call with a specific agent
 * POST /api/calls/initiate
 */
router.post('/initiate', checkTwilioConfig, async (req, res) => {
  try {
    const { agentId, phoneNumber, customerName } = req.body;

    // Validate required fields
    if (!agentId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID and phone number are required'
      });
    }

    // Check if agent exists
    const agent = await databaseService.getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Process and validate phone number
    let processedPhoneNumber = phoneNumber.replace(/\s+/g, '');
    
    // Auto-add country codes if not present
    if (!processedPhoneNumber.startsWith('+')) {
      const indianMobileRegex = /^[6-9]\d{9}$/;
      const indianWithCountryRegex = /^91[6-9]\d{9}$/;
      const usMobileRegex = /^[2-9]\d{9}$/;
      const usWithCountryRegex = /^1[2-9]\d{9}$/;
      
      if (indianMobileRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+91' + processedPhoneNumber;
      } else if (indianWithCountryRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+' + processedPhoneNumber;
      } else if (usMobileRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+1' + processedPhoneNumber;
      } else if (usWithCountryRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+' + processedPhoneNumber;
      }
    }
    
    // Validate final phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(processedPhoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }

    // Create call record in database
    const call = await databaseService.createCall({
      agent_id: agentId,
      phone_number: processedPhoneNumber,
      customer_name: customerName?.trim() || null
    });

    // Initiate Twilio call
    const twilioResult = await twilioService.initiateCall(
      processedPhoneNumber,
      call.id,
      agentId
    );

    if (twilioResult.success) {
      // Update call with Twilio Call SID
      await databaseService.updateCallStatus(call.id, 'initiated', {
        twilio_call_sid: twilioResult.callSid
      });

      logger.info('Call initiated successfully', {
        callId: call.id,
        agentId,
        agentName: agent.name,
        phoneNumber: processedPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        twilioCallSid: twilioResult.callSid
      });

      res.json({
        success: true,
        message: 'Call initiated successfully',
        call: {
          id: call.id,
          agentId,
          agentName: agent.name,
          phoneNumber: processedPhoneNumber,
          status: 'initiated',
          twilioCallSid: twilioResult.callSid
        }
      });
    } else {
      // Update call status to failed
      await databaseService.updateCallStatus(call.id, 'failed');

      res.status(400).json({
        success: false,
        error: twilioResult.error || 'Failed to initiate call'
      });
    }

  } catch (error) {
    logger.error('Error initiating call', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to initiate call'
    });
  }
});

/**
 * Get call status
 * GET /api/calls/:callId/status
 */
router.get('/:callId/status', async (req, res) => {
  try {
    const { callId } = req.params;

    // Get call from database
    const call = await databaseService.getCallById(callId);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Get agent information
    const agent = await databaseService.getAgentById(call.agent_id);

    // Get conversation summary if available
    const conversationSummary = dynamicAIService.getConversationSummary(callId);

    // Get Twilio call details if available
    let twilioDetails = null;
    if (call.twilio_call_sid) {
      try {
        twilioDetails = await twilioService.getCallDetails(call.twilio_call_sid);
      } catch (error) {
        logger.warn('Could not get Twilio call details', { 
          callId, 
          twilioCallSid: call.twilio_call_sid,
          error: error.message 
        });
      }
    }

    res.json({
      success: true,
      call: {
        id: call.id,
        agent: {
          id: agent?.id,
          name: agent?.name
        },
        phoneNumber: call.phone_number,
        customerName: call.customer_name,
        status: call.status,
        duration: call.duration,
        startedAt: call.started_at,
        endedAt: call.ended_at,
        twilioCallSid: call.twilio_call_sid
      },
      twilio: twilioDetails,
      conversation: conversationSummary
    });

  } catch (error) {
    logger.error('Error getting call status', { error: error.message, callId: req.params.callId });
    res.status(500).json({
      success: false,
      error: 'Failed to get call status'
    });
  }
});

/**
 * Get all calls
 * GET /api/calls
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 50, agentId, status } = req.query;

    let sql = 'SELECT * FROM calls';
    let params = [];
    let conditions = [];

    if (agentId) {
      conditions.push('agent_id = ?');
      params.push(agentId);
    }

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY started_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const calls = await databaseService.allQuery(sql, params);

    // Get agent information for each call
    const callsWithAgents = await Promise.all(
      calls.map(async (call) => {
        const agent = await databaseService.getAgentById(call.agent_id);
        return {
          ...call,
          agent: {
            id: agent?.id,
            name: agent?.name
          }
        };
      })
    );

    res.json({
      success: true,
      calls: callsWithAgents,
      count: callsWithAgents.length
    });

  } catch (error) {
    logger.error('Error getting calls', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get calls'
    });
  }
});

/**
 * Hang up a call
 * POST /api/calls/:callId/hangup
 */
router.post('/:callId/hangup', async (req, res) => {
  try {
    const { callId } = req.params;

    // Get call from database
    const call = await databaseService.getCallById(callId);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Hang up Twilio call if available
    if (call.twilio_call_sid) {
      try {
        await twilioService.hangupCall(call.twilio_call_sid);
      } catch (error) {
        logger.warn('Could not hang up Twilio call', { 
          callId, 
          twilioCallSid: call.twilio_call_sid,
          error: error.message 
        });
      }
    }

    // Update call status
    await databaseService.updateCallStatus(callId, 'ended', {
      ended_at: new Date().toISOString()
    });

    // Cleanup conversation
    dynamicAIService.cleanupConversation(callId);

    logger.info('Call hung up', { callId });

    res.json({
      success: true,
      message: 'Call hung up successfully'
    });

  } catch (error) {
    logger.error('Error hanging up call', { error: error.message, callId: req.params.callId });
    res.status(500).json({
      success: false,
      error: 'Failed to hang up call'
    });
  }
});

/**
 * Get call conversation
 * GET /api/calls/:callId/conversation
 */
router.get('/:callId/conversation', async (req, res) => {
  try {
    const { callId } = req.params;

    // Get call from database
    const call = await databaseService.getCallById(callId);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Get conversation history from database
    const conversation = await databaseService.getConversationHistory(callId);

    res.json({
      success: true,
      call: {
        id: call.id,
        agentId: call.agent_id,
        phoneNumber: call.phone_number,
        customerName: call.customer_name,
        status: call.status
      },
      conversation: conversation.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    });

  } catch (error) {
    logger.error('Error getting call conversation', { error: error.message, callId: req.params.callId });
    res.status(500).json({
      success: false,
      error: 'Failed to get call conversation'
    });
  }
});

/**
 * Get platform statistics
 * GET /api/calls/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await databaseService.getPlatformStats();
    const activeConversations = dynamicAIService.getActiveConversationsCount();

    res.json({
      success: true,
      stats: {
        ...stats,
        activeConversations
      }
    });

  } catch (error) {
    logger.error('Error getting platform stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get platform stats'
    });
  }
});

module.exports = router;
