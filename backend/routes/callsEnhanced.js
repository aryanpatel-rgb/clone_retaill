/**
 * Enhanced Call Management Routes
 * API endpoints for initiating and managing calls with agent prompt validation
 */

const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');
const { executeQuery } = require('../database/connection');
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
 * Initiate a call with agent prompt validation
 * POST /api/calls/initiate-with-validation
 */
router.post('/initiate-with-validation', async (req, res) => {
  try {
    const { agentId, phoneNumber, customerName } = req.body;

    // Validate required fields
    if (!agentId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID and phone number are required'
      });
    }

    // Check if agent exists and has a prompt
    const agentResult = await executeQuery('SELECT * FROM agents WHERE agent_id = $1', [agentId]);
    const agent = agentResult.rows[0];
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Validate that agent has a prompt
    if (!agent.ai_prompt || agent.ai_prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Agent must have a prompt configured before making calls. Please add a prompt to the agent first.',
        requiresPrompt: true,
        agentId: agentId,
        agentName: agent.name
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
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format. Please include country code.'
        });
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

    // Create call record in calls table
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const callResult = await executeQuery(`
      INSERT INTO calls (id, agent_id, phone_number, customer_name, status, started_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'initiating', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [callId, agentId, processedPhoneNumber, customerName?.trim() || 'Unknown']);
    const call = callResult.rows[0];

    // Try to initiate Twilio call if configured, otherwise create mock call
    if (twilioService.isTwilioConfigured()) {
      try {
        const twilioResult = await twilioService.initiateCall({
          to: processedPhoneNumber,
          agent: agent,
          customerName: customerName?.trim() || 'Unknown',
          callId: call.id
        });

        if (twilioResult.success) {
          // Update call with Twilio Call SID
          await executeQuery(`
            UPDATE calls 
            SET status = $1, twilio_call_sid = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
          `, ['initiated', twilioResult.callSid, call.id]);

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
          throw new Error(twilioResult.error || 'Failed to initiate call');
        }
      } catch (twilioError) {
        // If Twilio fails, create a mock call instead of failing
        logger.warn('Twilio call failed, creating mock call', {
          callId: call.id,
          agentId,
          error: twilioError.message
        });

        // Create mock call for development
        await executeQuery(`
          UPDATE calls 
          SET status = $1, twilio_call_sid = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, ['mock', 'mock-call-' + call.id, call.id]);

        logger.info('Mock call created (Twilio failed)', {
          callId: call.id,
          agentId,
          agentName: agent.name,
          phoneNumber: processedPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
        });

        res.json({
          success: true,
          message: 'Mock call created (Twilio not working)',
          call: {
            id: call.id,
            agentId,
            agentName: agent.name,
            phoneNumber: processedPhoneNumber,
            status: 'mock',
            mock: true
          }
        });
      }
    } else {
      // Create mock call for development
      await executeQuery(`
        UPDATE calls 
        SET status = $1, twilio_call_sid = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, ['mock', 'mock-call-' + call.id, call.id]);

      logger.info('Mock call created (Twilio not configured)', {
        callId: call.id,
        agentId,
        agentName: agent.name,
        phoneNumber: processedPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      });

      res.json({
        success: true,
        message: 'Mock call created (Twilio not configured)',
        call: {
          id: call.id,
          agentId,
          agentName: agent.name,
          phoneNumber: processedPhoneNumber,
          status: 'mock',
          twilioCallSid: 'mock-call-' + call.id
        },
        mock: true
      });
    }

  } catch (error) {
    logger.error('Error initiating call with validation', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to initiate call'
    });
  }
});

/**
 * Get agents with prompt validation status
 * GET /api/calls/agents-with-validation
 */
router.get('/agents-with-validation', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM agents ORDER BY created_at DESC');
    const agents = result.rows;
    
    const agentsWithValidation = agents.map(agent => ({
      id: agent.agent_id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      hasPrompt: !!(agent.ai_prompt && agent.ai_prompt.trim().length > 0),
      promptLength: agent.ai_prompt ? agent.ai_prompt.length : 0,
      voice: agent.voice,
      language: agent.language,
      model: agent.model,
      canMakeCalls: !!(agent.ai_prompt && agent.ai_prompt.trim().length > 0 && agent.status === 'active')
    }));
    
    res.json({
      success: true,
      agents: agentsWithValidation
    });
  } catch (error) {
    logger.error('Failed to get agents with validation', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Validate agent for calling
 * POST /api/calls/validate-agent
 */
router.post('/validate-agent', async (req, res) => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required'
      });
    }

    // Get agent
    const agentResult = await executeQuery('SELECT * FROM agents WHERE agent_id = $1', [agentId]);
    const agent = agentResult.rows[0];
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Check if agent has prompt
    const hasPrompt = !!(agent.ai_prompt && agent.ai_prompt.trim().length > 0);
    
    // Check if agent is active
    const isActive = agent.status === 'active';
    
    // Check if Twilio is configured
    const twilioConfigured = twilioService.isTwilioConfigured();

    const validation = {
      agentId: agent.agent_id,
      agentName: agent.name,
      hasPrompt,
      isActive,
      twilioConfigured,
      canMakeCalls: hasPrompt && isActive,
      issues: []
    };

    if (!hasPrompt) {
      validation.issues.push('Agent does not have a prompt configured');
    }
    
    if (!isActive) {
      validation.issues.push('Agent is not active');
    }
    
    if (!twilioConfigured) {
      validation.issues.push('Twilio is not configured');
    }

    res.json({
      success: true,
      validation
    });

  } catch (error) {
    logger.error('Error validating agent', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to validate agent'
    });
  }
});

module.exports = router;
