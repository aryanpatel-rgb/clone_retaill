/**
 * Webhook Routes for Twilio Integration
 * Handles incoming webhooks from Twilio for call events
 */

const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const twilioService = require('../services/twilioService');
const databaseService = require('../services/postgresDatabaseService');
const { executeQuery } = require('../database/connection');
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
    const twiml = createTwiMLWithTTS(aiResponse.response, agent.voice_id, '/api/webhooks/speech');

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
      speech: SpeechResult,
      confidence: Confidence,
      speechLength: SpeechResult?.length || 0
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

    // Handle low confidence speech - lowered threshold for better recognition
    if (!SpeechResult || Confidence < 0.1) {
      const fallbackMessage = "I didn't catch that clearly. Could you please repeat what you said?";
      const fallbackTwiml = createTwiMLWithTTS(fallbackMessage, agent.voice_id, '/api/webhooks/speech');
      return res.type('text/xml').send(fallbackTwiml);
    }

    // Log interruption detection with full speech
    logger.info('User input received (possible interruption)', {
      CallSid,
      speech: SpeechResult,
      confidence: Confidence,
      isInterruption: true,
      speechLength: SpeechResult?.length || 0
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
      const voiceId = agent.voice || config.get('elevenlabs.voiceId') || '21m00Tcm4TlvDq8ikWAM';
      twiml = twilioService.generateTwiML('play-audio', {
        audioUrl: await getTTSUrl(aiResponse.response, voiceId),
        nextAction: 'hangup'
      });
    } else {
      // Continue conversation
      const voiceId = agent.voice || config.get('elevenlabs.voiceId') || '21m00Tcm4TlvDq8ikWAM';
      twiml = createTwiMLWithTTS(aiResponse.response, voiceId, '/api/webhooks/speech');
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
      '/api/webhooks/speech'
    );
    res.type('text/xml').send(fallbackTwiml);
  }
});

/**
 * Partial speech webhook - handles real-time speech detection for interruptions
 * POST /webhook/speech-partial
 */
router.post('/speech-partial', async (req, res) => {
  try {
    const { CallSid, UnstableSpeechResult, SpeechResult } = req.body;
    
    // Log partial speech for debugging
    if (UnstableSpeechResult && UnstableSpeechResult.length > 0) {
      logger.info('Partial speech detected', { 
        CallSid, 
        partialSpeech: UnstableSpeechResult,
        finalSpeech: SpeechResult
      });
    }
    
    // Just acknowledge - Twilio will send final result to /speech
    res.status(200).send('OK');
    
  } catch (error) {
    logger.error('Error in speech-partial webhook', { 
      error: error.message, 
      CallSid: req.body.CallSid 
    });
    res.status(200).send('OK'); // Always acknowledge to avoid Twilio retries
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

    const voiceId = (voice_id && voice_id !== 'undefined') ? voice_id : (config.get('elevenlabs.voiceId') || '21m00Tcm4TlvDq8ikWAM');

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
      text: req.query.text?.substring(0, 50),
      voice_id: req.query.voice_id,
      textLength: text?.length
    });
    
    // Try fallback with shorter text if it's too long and timed out
    if (text && text.length > 200 && error.message.includes('timeout')) {
      try {
        logger.info('Attempting fallback with shorter text', { originalLength: text.length });
        const shorterText = text.substring(0, 200) + '...';
        const fallbackAudio = await elevenlabsService.generateSpeech(shorterText, voiceId);
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.send(fallbackAudio);
      } catch (fallbackError) {
        logger.error('Fallback TTS also failed', { error: fallbackError.message });
      }
    }
    
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
      'speech': 'POST /api/webhooks/speech',
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
  const ttsUrl = `${config.get('server.ngrokUrl')}/api/webhooks/tts-stream?text=${encodeURIComponent(message)}&voice_id=${voiceId}&v=${Date.now()}`;
  
  // Create TwiML with interruption handling
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Start speech gathering FIRST (before playing audio) - optimized for interruptions
  const gather = twiml.gather({
    input: 'speech',
    timeout: 10,
    action: `${config.get('server.ngrokUrl')}/api/webhooks/speech`,
    method: 'POST',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    enhanced: true,
    profanityFilter: false,
    hints: 'yes, no, hello, goodbye, help, repeat, speak, talk, wait, stop, interrupt, already, book, schedule, appointment, available, time, date',
    language: 'en-US',
    speechStartTimeout: 0.8, // Faster interruption detection
    speechEndTimeout: 0.3,   // Shorter pause detection
    partialResultCallback: `${config.get('server.ngrokUrl')}/api/webhooks/speech-partial`,
    partialResultCallbackMethod: 'POST'
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
    const { agentId, callId, customerName, formData, formName } = req.query;
    const { CallSid, From, To } = req.body;
    
    logger.info('AI Call webhook received', { 
      CallSid, From, To, agentId, callId, customerName, formName 
    });

    // Get call from database
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
    const conversationContext = {
      agentId: call.agent_id,
      customerName: customerName || call.customer_name || 'Customer',
      customerPhone: From,
      callId: call.id,
      formData: formData ? JSON.parse(decodeURIComponent(formData)) : null,
      formName: formName || null
    };

    const aiResponse = await dynamicAIService.initializeConversation(
      call.id,
      call.agent_id,
      From,
      conversationContext.customerName,
      conversationContext
    );

    // Generate TwiML with TTS
    const voiceId = agent.voice || config.get('elevenlabs.voiceId') || '21m00Tcm4TlvDq8ikWAM';
    const twiml = createTwiMLWithTTS(aiResponse.response, voiceId, '/api/webhooks/speech');

    res.type('text/xml').send(twiml);

  } catch (error) {
    logger.error('Error in AI call webhook', { 
      error: error.message, 
      CallSid: req.body.CallSid,
      stack: error.stack
    });
    
    const errorTwiml = createTwiMLWithTTS(
      "I'm having trouble connecting right now. Please call back in a few minutes.", 
      config.get('elevenlabs.voiceId'), 
      '/api/webhooks/speech'
    );
    res.type('text/xml').send(errorTwiml);
  }
});

/**
 * Get TTS URL
 */
async function getTTSUrl(text, voiceId) {
  // Ensure voiceId is never undefined in the URL
  const safeVoiceId = (voiceId && voiceId !== 'undefined') ? voiceId : (config.get('elevenlabs.voiceId') || '21m00Tcm4TlvDq8ikWAM');
  return `${config.get('server.ngrokUrl')}/api/webhooks/tts-stream?text=${encodeURIComponent(text)}&voice_id=${safeVoiceId}&v=${Date.now()}`;
}

module.exports = router;
