const twilio = require('twilio');
const logger = require('./logger');

/**
 * Twilio Service for Chatbot Voice Calling
 * Handles all Twilio-related operations for voice calling
 */
class TwilioService {
  constructor() {
    this.isConfigured = false;
    this.client = null;
    this.fromNumber = null;
    this.accountSid = null;
    this.authToken = null;
    this.activeCalls = new Map();
  }

  /**
   * Initialize Twilio service
   */
  async initialize() {
    try {
      this.accountSid = process.env.TWILIO_ACCOUNT_SID;
      this.authToken = process.env.TWILIO_AUTH_TOKEN;
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
      
      if (this._validateConfiguration()) {
        this._initializeClient();
        logger.info('Twilio service initialized successfully for chatbot');
      }
    } catch (error) {
      logger.error('Failed to initialize Twilio service:', error);
    }
  }

  /**
   * Check if Twilio is properly configured
   */
  isTwilioConfigured() {
    return this.isConfigured;
  }

  /**
   * Validate required Twilio configuration
   */
  _validateConfiguration() {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      logger.warn('Twilio configuration incomplete for chatbot');
      this.isConfigured = false;
      return false;
    }
    this.isConfigured = true;
    return true;
  }

  /**
   * Initialize Twilio client
   */
  _initializeClient() {
    try {
      this.client = twilio(this.accountSid, this.authToken);
      logger.info('Twilio client initialized for chatbot');
    } catch (error) {
      logger.error('Failed to initialize Twilio client:', error);
      throw new Error(`Twilio client initialization failed: ${error.message}`);
    }
  }

  /**
   * Initiate a voice call
   */
  async initiateCall(callData) {
    if (!this.isConfigured) {
      return {
        success: false,
        message: 'Twilio is not configured. Please add Twilio credentials.',
        configured: false
      };
    }

    try {
      const { to, agentPrompt, customerName, callId } = callData;
      
      // Create webhook URL for this call
      const webhookUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/api/voice-webhook?callId=${callId}`;
      
      // Make the outbound call
      const call = await this.client.calls.create({
        to: to,
        from: this.fromNumber,
        url: webhookUrl,
        method: 'POST',
        statusCallback: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/api/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer'],
        statusCallbackMethod: 'POST',
        record: false,
        timeout: 30
      });

      // Store call data
      this.activeCalls.set(call.sid, {
        callSid: call.sid,
        to: to,
        from: this.fromNumber,
        status: call.status,
        startTime: new Date(),
        agentPrompt,
        customerName,
        callId
      });

      logger.info('Voice call initiated successfully', {
        callSid: call.sid,
        to: this._maskPhoneNumber(to),
        customerName
      });

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
        message: 'Voice call initiated successfully'
      };

    } catch (error) {
      logger.error('Failed to initiate voice call:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to initiate voice call'
      };
    }
  }

  /**
   * Generate TwiML response for voice interactions
   */
  generateTwiML(type, options = {}) {
    try {
      const twiml = new twilio.twiml.VoiceResponse();

      switch (type) {
        case 'greeting':
          return this._generateGreetingTwiML(twiml, options);
        case 'speech-gather':
          return this._generateSpeechGatherTwiML(twiml, options);
        case 'play-audio':
          return this._generatePlayAudioTwiML(twiml, options);
        case 'hangup':
          return this._generateHangupTwiML(twiml, options);
        case 'redirect':
          return this._generateRedirectTwiML(twiml, options);
        default:
          return this._generateDefaultTwiML(twiml, options);
      }
    } catch (error) {
      logger.error('Error generating TwiML:', error);
      return this._generateErrorTwiML();
    }
  }

  /**
   * Generate greeting TwiML
   */
  _generateGreetingTwiML(twiml, options) {
    const greeting = options.message || 'Hello! I\'m Anna from Textdrip. I\'m here to help you book your session. Is now a good time to talk?';
    
    twiml.say({
      voice: 'Polly.Joanna'
    }, greeting);

    // Add speech gathering
    const gather = twiml.gather({
      input: 'speech',
      timeout: 10,
      speechTimeout: 'auto',
      action: '/api/voice-webhook',
      method: 'POST',
      speechModel: 'phone_call',
      enhanced: true,
      profanityFilter: false
    });

    // Fallback if no speech is detected
    twiml.say({
      voice: 'Polly.Joanna'
    }, 'I didn\'t hear anything. Please try again or say goodbye to end the call.');
    
    return twiml.toString();
  }

  /**
   * Generate speech-gather TwiML
   */
  _generateSpeechGatherTwiML(twiml, options) {
    if (options.message) {
      twiml.say({
        voice: 'Polly.Joanna'
      }, options.message);
    }

    const gather = twiml.gather({
      input: 'speech',
      timeout: options.timeout || 10,
      action: options.action || '/api/voice-webhook',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      profanityFilter: false
    });

    return twiml.toString();
  }

  /**
   * Generate play-audio TwiML
   */
  _generatePlayAudioTwiML(twiml, options) {
    if (options.audioUrl) {
      twiml.play(options.audioUrl);
    }

    if (options.nextAction === 'gather') {
      const gather = twiml.gather({
        input: 'speech',
        timeout: 10,
        action: '/api/voice-webhook',
        method: 'POST',
        speechTimeout: 'auto'
      });
    }

    if (options.nextAction === 'hangup') {
      twiml.hangup();
    }

    return twiml.toString();
  }

  /**
   * Generate hangup TwiML
   */
  _generateHangupTwiML(twiml, options) {
    if (options.message) {
      twiml.say({
        voice: 'Polly.Joanna'
      }, options.message);
    }
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Generate redirect TwiML
   */
  _generateRedirectTwiML(twiml, options) {
    twiml.redirect(options.url);
    return twiml.toString();
  }

  /**
   * Generate default TwiML
   */
  _generateDefaultTwiML(twiml, options) {
    twiml.say({
      voice: 'Polly.Joanna'
    }, options.message || 'Thank you for calling. Have a great day!');
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Generate error TwiML
   */
  _generateErrorTwiML() {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({
      voice: 'Polly.Joanna'
    }, 'I apologize, but we are experiencing technical difficulties. Please call back later.');
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Get active call data
   */
  getActiveCall(callSid) {
    return this.activeCalls.get(callSid) || null;
  }

  /**
   * Update call status
   */
  updateCallStatus(callSid, status, additionalData = {}) {
    const callData = this.activeCalls.get(callSid);
    if (callData) {
      callData.status = status;
      callData.lastUpdate = new Date();
      Object.assign(callData, additionalData);
      this.activeCalls.set(callSid, callData);
    }
    return callData;
  }

  /**
   * Clean up call data
   */
  cleanupCall(callSid) {
    this.activeCalls.delete(callSid);
  }

  /**
   * Mask phone number for privacy
   */
  _maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return phoneNumber;
    }
    
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length < 4) {
      return phoneNumber;
    }
    
    return phoneNumber.replace(/\d(?=\d{4})/g, '*');
  }

  /**
   * Test Twilio connection
   */
  async testConnection() {
    if (!this.isConfigured) {
      return {
        success: false,
        message: 'Twilio is not configured',
        configured: false
      };
    }

    try {
      const balance = await this.client.balance.fetch();
      return {
        success: true,
        balance: {
          amount: balance.balance,
          currency: balance.currency
        }
      };
    } catch (error) {
      logger.error('Twilio connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new TwilioService();
