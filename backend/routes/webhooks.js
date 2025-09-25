/**
 * Webhook Routes for Twilio Integration
 * Handles incoming webhooks from Twilio for call events
 */

const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const twilioService = require('../services/twilioService');
const databaseService = require('../services/databaseService');
const dynamicAIService = require('../services/dynamicAIService');
const elevenlabsService = require('../services/elevenlabsService');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Call start webhook
 * POST /webhook/call-start
 */
router.post('/call-start', async (req, res) => {
  try {
    const { CallSid, From, To } = req.body;
    
    logger.info('Call started', { CallSid, From, To });

    // Get call from database using Twilio Call SID
    const call = await databaseService.getCallByTwilioSid(CallSid);
    if (!call) {
      logger.error('Call not found in database', { CallSid });
      const errorTwiml = twilioService.generateTwiML('hangup', {
        message: 'Sorry, there was an error processing your call. Please try again later.'
      });
      return res.type('text/xml').send(errorTwiml);
    }

    // Get agent information
    const agent = await databaseService.getAgentById(call.agent_id);
    if (!agent) {
      logger.error('Agent not found', { callId: call.id, agentId: call.agent_id });
      const errorTwiml = twilioService.generateTwiML('hangup', {
        message: 'Sorry, the agent is not available. Please try again later.'
      });
      return res.type('text/xml').send(errorTwiml);
    }

    // Update call status
    await databaseService.updateCallStatus(call.id, 'in_progress');

    // Initialize conversation with the agent
    const aiResponse = await dynamicAIService.initializeConversation(
      call.id,
      call.agent_id,
      call.phone_number,
      call.customer_name
    );

    // Generate TwiML with TTS
    const twiml = createTwiMLWithTTS(aiResponse.response, agent.voice_id, '/webhook/speech');

    res.type('text/xml').send(twiml);

  } catch (error) {
    logger.error('Error in call-start webhook', { error: error.message, CallSid: req.body.CallSid });
    
    const errorTwiml = twilioService.generateTwiML('hangup', {
      message: 'Sorry, we are experiencing technical difficulties. Please call back later.'
    });
    res.type('text/xml').send(errorTwiml);
  }
});

/**
 * Speech processing webhook
 * POST /webhook/speech
 */
router.post('/speech', async (req, res) => {
  try {
    const { CallSid, SpeechResult, Confidence } = req.body;
    
    logger.info('Speech received', { 
      CallSid, 
      speech: SpeechResult?.substring(0, 50) + '...',
      confidence: Confidence 
    });

    // Get call from database
    const call = await databaseService.getCallByTwilioSid(CallSid);
    if (!call) {
      logger.error('Call not found in database', { CallSid });
      const errorTwiml = twilioService.generateTwiML('hangup', {
        message: 'Sorry, there was an error processing your call.'
      });
      return res.type('text/xml').send(errorTwiml);
    }

    // Get agent information
    const agent = await databaseService.getAgentById(call.agent_id);
    if (!agent) {
      logger.error('Agent not found', { callId: call.id, agentId: call.agent_id });
      const errorTwiml = twilioService.generateTwiML('hangup', {
        message: 'Sorry, the agent is not available.'
      });
      return res.type('text/xml').send(errorTwiml);
    }

    // Handle low confidence speech
    if (!SpeechResult || Confidence < 0.3) {
      const fallbackMessage = "I didn't catch that clearly. Could you please repeat what you said?";
      const fallbackTwiml = createTwiMLWithTTS(fallbackMessage, agent.voice_id, '/webhook/speech');
      return res.type('text/xml').send(fallbackTwiml);
    }

    // Log interruption detection
    logger.info('User input received (possible interruption)', {
      CallSid,
      speech: SpeechResult?.substring(0, 50) + '...',
      confidence: Confidence,
      isInterruption: true
    });

    // Process user input with AI
    const aiResponse = await dynamicAIService.processUserInput(
      call.id,
      SpeechResult,
      call.phone_number
    );

    // Generate response TwiML
    let twiml;
    if (aiResponse.conversationComplete) {
      // End the call
      twiml = twilioService.generateTwiML('play-audio', {
        audioUrl: await getTTSUrl(aiResponse.response, agent.voice_id),
        nextAction: 'hangup'
      });
    } else {
      // Continue conversation
      twiml = createTwiMLWithTTS(aiResponse.response, agent.voice_id, '/webhook/speech');
    }

    res.type('text/xml').send(twiml);

  } catch (error) {
    logger.error('Error in speech webhook', { 
      error: error.message, 
      CallSid: req.body.CallSid 
    });
    
    const fallbackTwiml = createTwiMLWithTTS(
      "I'm having trouble understanding. Could you please repeat that?", 
      config.get('elevenlabs.voiceId'), 
      '/webhook/speech'
    );
    res.type('text/xml').send(fallbackTwiml);
  }
});

/**
 * Call status webhook
 * POST /webhook/call-status
 */
router.post('/call-status', async (req, res) => {
  try {
    const { CallSid, CallStatus, Duration } = req.body;
    
    logger.info('Call status update', { CallSid, CallStatus, Duration });

    // Get call from database
    const call = await databaseService.getCallByTwilioSid(CallSid);
    if (call) {
      // Update call status
      let status = 'completed';
      if (CallStatus === 'in-progress') {
        status = 'in_progress';
      } else if (['failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
        status = 'failed';
      }

      await databaseService.updateCallStatus(call.id, status, {
        duration: parseInt(Duration) || 0,
        ended_at: new Date().toISOString()
      });

      // Cleanup conversation when call ends
      if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
        setTimeout(() => {
          dynamicAIService.cleanupConversation(call.id);
        }, 5000);
      }
    }

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Error in call-status webhook', { error: error.message });
    res.status(200).send('OK');
  }
});

/**
 * TTS streaming endpoint
 * GET /webhook/tts-stream
 */
router.get('/tts-stream', async (req, res) => {
  try {
    const { text, voice_id } = req.query;
    
    logger.info('TTS stream request', { 
      text: text?.substring(0, 50) + (text?.length > 50 ? '...' : ''),
      voice_id,
      textLength: text?.length
    });
    
    if (!text || !text.trim()) {
      logger.error('TTS stream missing text', { text, voice_id });
      return res.status(400).send('Missing text parameter');
    }

    const voiceId = voice_id || config.get('elevenlabs.voiceId');

    // Generate TTS with ElevenLabs
    const audioBuffer = await elevenlabsService.generateSpeech(text.trim(), voiceId);
    
    logger.info('TTS generated successfully', { 
      audioSize: audioBuffer.length,
      voiceId,
      textLength: text.trim().length
    });
    
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(audioBuffer);

  } catch (error) {
    logger.error('TTS streaming error', { 
      error: error.message,
      text: text?.substring(0, 50),
      voice_id 
    });
    res.status(500).send('TTS error');
  }
});

/**
 * Health check for webhooks
 * GET /webhook/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'webhooks',
    timestamp: new Date().toISOString(),
    endpoints: {
      'call-start': 'POST /webhook/call-start',
      'speech': 'POST /webhook/speech',
      'call-status': 'POST /webhook/call-status',
      'tts-stream': 'GET /webhook/tts-stream'
    }
  });
});

// Helper Functions

/**
 * Create TwiML with TTS
 */
function createTwiMLWithTTS(message, voiceId, nextUrl) {
  const ttsUrl = `${config.get('server.ngrokUrl')}/webhook/tts-stream?text=${encodeURIComponent(message)}&voice_id=${voiceId}&v=${Date.now()}`;
  
  // Create TwiML with interruption handling
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Start speech gathering FIRST (before playing audio)
  const gather = twiml.gather({
    input: 'speech',
    timeout: 10,
    action: nextUrl,
    method: 'POST',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    enhanced: true,
    profanityFilter: false,
    hints: 'yes, no, hello, goodbye, help, repeat, speak, talk, wait, stop, interrupt',
    language: 'en-US',
    speechStartTimeout: 1, // Very short timeout to detect interruptions quickly
    speechEndTimeout: 0.5
  });
  
  // Play the AI response INSIDE the gather (this allows interruption)
  gather.play(ttsUrl);
  
  // Fallback if no speech is detected
  twiml.say('I didn\'t hear anything. Please try again.');
  
  return twiml.toString();
}

/**
 * AI Call webhook - Main entry point for AI agent calls
 * POST /webhook/ai-call?agentId=...&callId=...
 */
router.post('/ai-call', async (req, res) => {
  try {
    const { agentId, callId } = req.query;
    const { CallSid, From, To } = req.body;
    
    logger.info('AI Call webhook received', { CallSid, From, To, agentId, callId });

    // Get call from database
    const call = await databaseService.getCallById(callId);
    if (!call) {
      logger.error('Call not found in database', { callId });
      const errorTwiml = twilioService.generateTwiML('hangup', {
        message: 'Sorry, there was an error processing your call. Please try again later.'
      });
      return res.type('text/xml').send(errorTwiml);
    }

    // Get agent information
    const agent = await databaseService.getAgentById(agentId);
    if (!agent) {
      logger.error('Agent not found', { agentId });
      const errorTwiml = twilioService.generateTwiML('hangup', {
        message: 'Sorry, the agent is not available. Please try again later.'
      });
      return res.type('text/xml').send(errorTwiml);
    }

    // Update call status
    await databaseService.updateCallStatus(callId, 'in_progress');

    // Initialize conversation with the agent
    const aiResponse = await dynamicAIService.initializeConversation(
      callId,
      agentId,
      call.phone_number,
      call.customer_name || 'Customer'
    );

    // Generate TTS URL for the response
    const ttsUrl = await getTTSUrl(aiResponse.response, agent.voice_id);

    // Generate TwiML to play the AI response
    const twiml = twilioService.generateTwiML('play', { url: ttsUrl });

    logger.info('AI Call initialized successfully', { 
      callId, 
      agentId, 
      responseLength: aiResponse.response.length,
      ttsUrl: ttsUrl.substring(0, 100) + '...',
      twimlLength: twiml.length
    });
    
    // Log full TwiML for debugging
    logger.info('Generated TwiML', { 
      callId, 
      twiml: twiml
    });

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Error in AI call webhook', { error: error.message });
    const errorTwiml = twilioService.generateTwiML('hangup', {
      message: 'Sorry, there was an error processing your call. Please try again later.'
    });
    res.type('text/xml').send(errorTwiml);
  }
});

/**
 * Get TTS URL
 */
async function getTTSUrl(text, voiceId) {
  return `${config.get('server.ngrokUrl')}/webhook/tts-stream?text=${encodeURIComponent(text)}&voice_id=${voiceId}&v=${Date.now()}`;
}

module.exports = router;
