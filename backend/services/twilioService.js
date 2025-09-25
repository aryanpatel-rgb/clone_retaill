const twilio = require('twilio');
const config = require('../config/config');
const logger = require('../utils/logger');
const { executeQuery } = require('../database/connection');

// Constants
const CALL_STATUS = {
  INITIATED: 'initiated',
  RINGING: 'ringing',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BUSY: 'busy',
  NO_ANSWER: 'no-answer',
  CANCELED: 'canceled'
};

const SPEECH_CONSTANTS = {
  DEFAULT_LANGUAGE: 'en-US',
  DEFAULT_VOICE: 'alice',
  TIMEOUT: 5,
  FINISH_ON_KEY: '#',
  NUM_DIGITS: 1
};

const REGEX_PATTERNS = {
  PHONE_NUMBER: /^\+?[1-9]\d{1,14}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9\s]+$/
};

/**
 * Enhanced Twilio Service
 * Handles all Twilio-related operations with improved error handling and validation
 */
class TwilioService {
  constructor() {
    this.isConfigured = false;
    this.client = null;
    this.fromNumber = null;
    this.accountSid = null;
    this.authToken = null;
  }

  /**
   * Initialize Twilio service with database settings
   */
  async initialize() {
    try {
      const result = await executeQuery(`
        SELECT settings FROM platform_settings WHERE id = 1
      `);

      if (result.rows.length > 0 && result.rows[0].settings.twilio?.enabled) {
        const twilioConfig = result.rows[0].settings.twilio;
        this.accountSid = twilioConfig.accountSid;
        this.authToken = twilioConfig.authToken;
        this.fromNumber = twilioConfig.phoneNumber;
        
        if (this._validateConfiguration()) {
          this._initializeClient();
          this._initializeProperties();
          logger.info('Twilio service initialized successfully');
        }
      } else {
        logger.warn('Twilio not configured in database settings');
      }
    } catch (error) {
      logger.error('Failed to initialize Twilio service:', error);
    }
  }

  /**
   * Check if Twilio is properly configured
   * @private
   * @returns {boolean} True if configured
   */
  _isConfigured() {
    return this.isConfigured;
  }

  /**
   * Public method to check if Twilio is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return this.isConfigured;
  }

  /**
   * Validate required Twilio configuration
   * @private
   * @returns {boolean} True if configured, false if missing config
   */
  _validateConfiguration() {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      logger.warn('Twilio configuration incomplete. Missing required credentials.');
      this.isConfigured = false;
      return false;
    }
    this.isConfigured = true;
    return true;
  }

  /**
   * Initialize Twilio client
   * @private
   */
  _initializeClient() {
    try {
      this.client = twilio(this.accountSid, this.authToken);
      this.authMethod = 'ACCOUNT_SID_AUTH_TOKEN';
      logger.info('Twilio client initialized successfully', { authMethod: this.authMethod });
    } catch (error) {
      logger.error('Failed to initialize Twilio client', { error: error.message });
      throw new Error(`Twilio client initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize service properties
   * @private
   */
  _initializeProperties() {
    this.webhookUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    this.activeCallsCache = new Map();
    this.callStatistics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0
    };
  }

  /**
   * Initiate a call from form submission
   * @param {Object} callData - Call data including phone number, agent info, form data
   * @returns {Promise<Object>} Call initiation result
   */
  async initiateCallFromForm(callData) {
    if (!this._isConfigured()) {
      return {
        success: false,
        message: 'Twilio is not configured. Please add Twilio credentials to enable voice calling features.',
        configured: false
      };
    }

    try {
      const { to, agentId, customerName, formData, formName, agentPrompt, callSettings } = callData;
      
      // Validate phone number
      this._validatePhoneNumber(to);
      
      // Create enhanced webhook URL with form context
      const webhookUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/api/webhooks/ai-call?agentId=${agentId}&customerName=${encodeURIComponent(customerName)}&formData=${encodeURIComponent(JSON.stringify(formData))}&formName=${encodeURIComponent(formName)}`;
      
      // Make the outbound call
      const call = await this.client.calls.create({
        to: to,
        from: this.fromNumber,
        url: webhookUrl,
        method: 'POST',
        statusCallback: `${process.env.FRONTEND_URL || 'http://localhost:5000'}/api/webhooks/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer'],
        statusCallbackMethod: 'POST',
        record: callSettings.record || false,
        timeout: callSettings.timeout || 30
      });

      logger.info('Call initiated successfully from form submission', {
        callSid: call.sid,
        to: this._maskPhoneNumber(to),
        agentId,
        customerName,
        formName
      });

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
        message: 'Call initiated successfully'
      };

    } catch (error) {
      logger.error('Failed to initiate call from form submission', {
        error: error.message,
        callData: { ...callData, to: this._maskPhoneNumber(callData.to) }
      });

      throw new Error(`Failed to initiate call: ${error.message}`);
    }
  }

  /**
   * Test Twilio connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    if (!this._isConfigured()) {
      return {
        success: false,
        message: 'Twilio is not configured. Please add Twilio credentials to enable voice calling features.',
        configured: false
      };
    }

    try {
      const balance = await this.client.balance.fetch();
      
      logger.info('Twilio connection successful', {
        authMethod: this.authMethod,
        balance: balance.balance,
        currency: balance.currency
      });
      
      return {
        success: true,
        balance: {
          amount: balance.balance,
          currency: balance.currency
        }
      };
    } catch (error) {
      logger.error('Twilio connection failed', {
        authMethod: this.authMethod,
        error: error.message,
        code: error.code
      });
      
      throw new Error('Twilio connection test failed: ' + JSON.stringify({
        error: error.message,
        code: error.code
      }))
    }
  }

  /**
   * Initiate a call with agent and customer data (wrapper for makeOutboundCall)
   * @param {Object} callData - Call data object
   * @param {string} callData.to - Destination phone number
   * @param {Object} callData.agent - Agent object
   * @param {string} callData.customerName - Customer name
   * @param {string} callData.callId - Call ID
   * @returns {Promise<Object>} Call creation result
   */
  async initiateCall(callData) {
    try {
      logger.info('initiateCall received callData:', { callData });
      const { to, agent, customerName, callId } = callData;
      logger.info('Destructured values:', { to, agent: agent?.id, customerName, callId });
      
      // Validate required parameters
      if (!to || !agent) {
        throw new Error('Phone number and agent are required');
      }
      
      // Create webhook URL for this call
      const webhookUrl = `${config.get('server.ngrokUrl')}/webhook/ai-call?agentId=${agent.id}&callId=${callId}`;
      
      // Call the existing makeOutboundCall method
      const result = await this.makeOutboundCall(to, webhookUrl, {
        agent: agent,
        customerName: customerName || 'Customer',
        callId: callId
      });
      
      return result;
    } catch (error) {
      logger.error('Error initiating AI agent call', {
        error: error.message,
        callData
      });
      
      throw new Error('Failed to initiate call: ' + error.message);
    }
  }

  /**
   * Make an outbound call
   * @param {string} toNumber - Destination phone number
   * @param {string} webhookUrl - Webhook URL for call handling
   * @param {Object} options - Additional call options
   * @returns {Promise<Object>} Call creation result
   */
  async makeOutboundCall(toNumber, webhookUrl, options = {}) {
    try {
      this._validatePhoneNumber(toNumber);
      
      const callOptions = {
        to: toNumber,
        from: this.fromNumber,
        url: webhookUrl,
        method: 'POST',
        statusCallback: `${config.get('server.ngrokUrl')}/webhook/call-status`,
        statusCallbackEvent: [
          'initiated', 'ringing', 'answered', 'completed', 
          'busy', 'failed', 'no-answer'
        ],
        statusCallbackMethod: 'POST',
        record: false,
        timeout: options.timeout || 30,
        ...options
      };

      logger.info('Initiating outbound call', {
        toNumber: this._maskPhoneNumber(toNumber),
        webhookUrl,
        authMethod: this.authMethod
      });

      const call = await this.client.calls.create(callOptions);

      // Store call data
      this._storeCallData(call.sid, {
        sid: call.sid,
        to: toNumber,
        from: this.fromNumber,
        status: call.status,
        startTime: new Date(),
        webhookUrl,
        ...options
      });

      // Update statistics
      this.callStatistics.totalCalls++;

      logger.info('Call created successfully', {
        callSid: call.sid,
        status: call.status,
        toNumber: this._maskPhoneNumber(toNumber),
        authMethod: this.authMethod
      });

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
        message: 'Call initiated successfully'
      };
    } catch (error) {
      this.callStatistics.failedCalls++;
      
      logger.error('Error making outbound call', {
        error: error.message,
        toNumber: this._maskPhoneNumber(toNumber),
        code: error.code,
        authMethod: this.authMethod
      });

      throw new Error('Twilio', 'Failed to create call', {
        error: error.message,
        code: error.code
      });
    }
  }

  /**
   * Generate TwiML response
   * @param {string} type - TwiML type
   * @param {Object} options - TwiML options
   * @returns {string} TwiML XML string
   */
  generateTwiML(type, options = {}) {
    try {
      const twiml = new twilio.twiml.VoiceResponse();

      switch (type) {
        case 'play':
          return this._generatePlayTwiML(twiml, options);
        case 'play-audio':
          return this._generatePlayAudioTwiML(twiml, options);
        case 'speech-gather':
          return this._generateSpeechGatherTwiML(twiml, options);
        case 'hangup':
          return this._generateHangupTwiML(twiml, options);
        case 'redirect':
          return this._generateRedirectTwiML(twiml, options);
        case 'greeting':
          return this._generateGreetingTwiML(twiml, options);
        default:
          return this._generateDefaultTwiML(twiml, options);
      }
    } catch (error) {
      logger.error('Error generating TwiML', { type, error: error.message });
      return this._generateErrorTwiML();
    }
  }

  /**
   * Generate play TwiML for TTS URL with speech gathering
   * @private
   * @param {Object} twiml - TwiML response object
   * @param {Object} options - Options
   * @returns {string} TwiML XML
   */
  _generatePlayTwiML(twiml, options) {
    if (options.url) {
      // Create a gather element that contains the play
      const gather = twiml.gather({
        input: 'speech',
        action: '/webhook/speech',
        method: 'POST',
        timeout: 10,
        speechTimeout: 'auto'
      });
      
      // Play the AI response inside the gather
      gather.play(options.url);
      
      // Fallback if no speech is detected
      twiml.say({
        voice: 'Polly.Joanna'
      }, 'I didn\'t hear anything. Please try again or say goodbye to end the call.');
      
    } else {
      twiml.say({
        voice: 'Polly.Joanna'
      }, 'Sorry, there was an error with the audio.');
    }
    return twiml.toString();
  }

  /**
   * Generate play-audio TwiML
   * @private
   * @param {Object} twiml - TwiML response object
   * @param {Object} options - Options
   * @returns {string} TwiML XML
   */
  _generatePlayAudioTwiML(twiml, options) {
    if (options.isInitialCall) {
     
    }

    if (options.audioUrl) {
      twiml.play(options.audioUrl);
    }

    if (options.nextAction === 'gather') {
      const gather = twiml.gather({
        input: 'speech',
        timeout: options.timeout || SPEECH_CONSTANTS.DEFAULT_TIMEOUT,
        action: options.gatherUrl || '/webhook/speech',
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: true,
        profanityFilter: false,
        hints: options.hints || '',
        language: 'en-US',
        speechStartTimeout: 2,
        speechEndTimeout: 1
      });
    }

    if (options.nextAction === 'hangup') {
      if (options.message) {
        twiml.say({
          voice: 'Polly.Joanna'
        }, options.message);
      }
      twiml.hangup();
    }

    if (options.nextAction === 'redirect') {
      if (options.delay) {
        twiml.pause({ length: options.delay / 1000 }); // Convert ms to seconds
      }
      twiml.redirect(options.redirectUrl);
    }

    if (options.repeatUrl && options.nextAction === 'gather') {
      twiml.redirect(options.repeatUrl);
    }

    return twiml.toString();
  }

  /**
   * Generate speech-gather TwiML
   * @private
   * @param {Object} twiml - TwiML response object
   * @param {Object} options - Options
   * @returns {string} TwiML XML
   */
  _generateSpeechGatherTwiML(twiml, options) {
    if (options.message) {
      twiml.say({
        voice: 'Polly.Joanna'
      }, options.message);
    }

    const gather = twiml.gather({
      input: 'speech',
      timeout: options.timeout || SPEECH_CONSTANTS.DEFAULT_TIMEOUT,
      action: options.action || '/webhook/speech',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      enhanced: true,
      profanityFilter: false,
      hints: options.hints || '',
      language: 'en-US',
      partialResultCallback: options.partialCallback || null,
      speechStartTimeout: 2,
      speechEndTimeout: 1
    });

    if (options.repeatUrl) {
      twiml.redirect(options.repeatUrl);
    }

    return twiml.toString();
  }

  /**
   * Generate hangup TwiML
   * @private
   * @param {Object} twiml - TwiML response object
   * @param {Object} options - Options
   * @returns {string} TwiML XML
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
   * @private
   * @param {Object} twiml - TwiML response object
   * @param {Object} options - Options
   * @returns {string} TwiML XML
   */
  _generateRedirectTwiML(twiml, options) {
    twiml.redirect(options.url);
    return twiml.toString();
  }

  /**
   * Generate greeting TwiML
   * @private
   * @param {Object} twiml - TwiML response object
   * @param {Object} options - Options
   * @returns {string} TwiML XML
   */
  _generateGreetingTwiML(twiml, options) {
    twiml.say({
      voice: 'Polly.Joanna'
    }, options.message || 'Hello! Please wait while I connect you.');

    if (options.nextUrl) {
      twiml.redirect(options.nextUrl);
    } else {
      const gather = twiml.gather({
        input: 'speech',
        timeout: SPEECH_CONSTANTS.SHORT_TIMEOUT,
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        enhanced: true,
        action: options.gatherUrl || '/webhook/speech',
        method: 'POST',
        hints: 'hello, hi, appointment, schedule'
      });

      gather.say({
        voice: 'Polly.Joanna'
      }, "Please say something to continue.");
    }

    return twiml.toString();
  }

  /**
   * Generate default TwiML
   * @private
   * @param {Object} twiml - TwiML response object
   * @param {Object} options - Options
   * @returns {string} TwiML XML
   */
  _generateDefaultTwiML(twiml, options) {
    twiml.say({
      voice: 'Polly.Joanna'
    }, options.message || 'I apologize, but there seems to be a technical issue. Please call back later. Thank you.');
    twiml.hangup();
    return twiml.toString();
  }

  /**
   * Generate error TwiML
   * @private
   * @returns {string} Error TwiML XML
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
   * Update call with new TwiML
   * @param {string} callSid - Call SID
   * @param {string} twimlUrl - TwiML URL
   * @returns {Promise<Object>} Updated call object
   */
  async updateCall(callSid, twimlUrl) {
    try {
      const call = await this.client.calls(callSid).update({
        url: twimlUrl,
        method: 'POST'
      });

      logger.info('Call updated with new TwiML', { callSid, twimlUrl });
      return call;
    } catch (error) {
      logger.error('Error updating call', { error: error.message, callSid });
      throw new Error('Twilio', 'Failed to update call', {
        callSid,
        error: error.message
      });
    }
  }

  /**
   * Get call details
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Call details
   */
  async getCallDetails(callSid) {
    try {
      const call = await this.client.calls(callSid).fetch();
      return call;
    } catch (error) {
      logger.error('Error fetching call details', { error: error.message, callSid });
      throw new Error('Twilio', 'Failed to fetch call details', {
        callSid,
        error: error.message
      });
    }
  }

  /**
   * Send SMS message
   * @param {string} toNumber - Destination phone number
   * @param {string} message - SMS message
   * @returns {Promise<Object>} SMS sending result
   */
  async sendSMS(toNumber, message) {
    try {
      this._validatePhoneNumber(toNumber);
      this._validateSMSMessage(message);

      const sms = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: toNumber
      });

      logger.info('SMS sent successfully', {
        messageSid: sms.sid,
        toNumber: this._maskPhoneNumber(toNumber),
        messageLength: message.length
      });

      return {
        success: true,
        messageSid: sms.sid,
        status: sms.status
      };
    } catch (error) {
      logger.error('Error sending SMS', {
        error: error.message,
        toNumber: this._maskPhoneNumber(toNumber),
        code: error.code
      });

      throw new Error('Twilio', 'Failed to send SMS', {
        error: error.message,
        code: error.code
      });
    }
  }


  /**
   * Initiate appointment scheduling call
   * @param {string} customerPhone - Customer phone number
   * @param {string} customerName - Customer name (optional)
   * @param {string} service - Service name (optional)
   * @returns {Promise<Object>} Call initiation result
   */
  async initiateAppointmentCall(customerPhone, customerName = '', service = null) {
    try {
      const webhookUrl = `${config.get('server.ngrokUrl')}/webhook/call-start`;
      
      logger.info('Starting appointment scheduling call', {
        customerPhone: this._maskPhoneNumber(customerPhone),
        customerName,
        authMethod: this.authMethod
      });

      const callResult = await this.makeOutboundCall(customerPhone, webhookUrl);
      
      if (callResult.success) {
        // Store additional call data including service
        const callData = this.activeCallsCache.get(callResult.callSid);
        if (callData) {
          callData.customerName = customerName;
          callData.service = service; // IMPORTANT: Store the service name!
          callData.purpose = 'appointment_scheduling';
          callData.customerPhone = customerPhone;
          this.activeCallsCache.set(callResult.callSid, callData);
          
          logger.info('Call data stored with service info', {
            callSid: callResult.callSid,
            customerName: customerName?.substring(0, 10),
            service: service,
            hasService: !!service
          });
        }
      }

      return callResult;
    } catch (error) {
      logger.error('Error initiating appointment call', {
        error: error.message,
        customerPhone: this._maskPhoneNumber(customerPhone),
        customerName
      });
      throw new Error(`Failed to initiate appointment call: ${error.message}`);
    }
  }

  /**
   * Hang up a call
   * @param {string} callSid - Call SID
   * @returns {Promise<Object>} Hangup result
   */
  async hangupCall(callSid) {
    try {
      const call = await this.client.calls(callSid).update({
        status: 'completed'
      });

      this.activeCallsCache.delete(callSid);
      logger.info('Call hung up successfully', { callSid });
      return call;
    } catch (error) {
      logger.error('Error hanging up call', { error: error.message, callSid });
      throw new Error('Twilio', 'Failed to hang up call', {
        callSid,
        error: error.message
      });
    }
  }

  /**
   * Get call logs
   * @param {number} limit - Number of calls to retrieve
   * @param {Date} dateCreated - Filter by date created
   * @returns {Promise<Array>} Array of call logs
   */
  async getCallLogs(limit = 50, dateCreated = null) {
    try {
      const options = { limit };
      if (dateCreated) {
        options.dateCreated = dateCreated;
      }

      const calls = await this.client.calls.list(options);
      logger.info('Call logs retrieved', { count: calls.length, limit });
      return calls;
    } catch (error) {
      logger.error('Error fetching call logs', { error: error.message });
      throw new Error('Twilio', 'Failed to fetch call logs', {
        error: error.message
      });
    }
  }

  // Utility methods

  /**
   * Get active call data
   * @param {string} callSid - Call SID
   * @returns {Object|null} Call data or null
   */
  getActiveCall(callSid) {
    return this.activeCallsCache.get(callSid) || null;
  }

  /**
   * Update active call status
   * @param {string} callSid - Call SID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to store
   * @returns {Object|null} Updated call data or null
   */
  updateActiveCallStatus(callSid, status, additionalData = {}) {
    const callData = this.activeCallsCache.get(callSid);
    if (callData) {
      callData.status = status;
      callData.lastUpdate = new Date();
      Object.assign(callData, additionalData);
      this.activeCallsCache.set(callSid, callData);
      
      logger.debug('Call status updated', {
        callSid,
        status,
        hasAdditionalData: Object.keys(additionalData).length > 0
      });
    }
    return callData;
  }

  /**
   * Clean up call data
   * @param {string} callSid - Call SID
   */
  cleanupCall(callSid) {
    const wasDeleted = this.activeCallsCache.delete(callSid);
    if (wasDeleted) {
      logger.info('Call cleanup completed', { callSid });
    } else {
      logger.warn('Call cleanup attempted but call not found in cache', { callSid });
    }
  }

  /**
   * Get all active calls
   * @returns {Array} Array of active calls
   */
  getActiveCalls() {
    return Array.from(this.activeCallsCache.values());
  }

  /**
   * Handle machine detection result
   * @param {string} callSid - Call SID
   * @param {string} answeredBy - Who answered the call
   * @returns {boolean} True if machine detected
   */
  handleMachineDetection(callSid, answeredBy) {
    const callData = this.activeCallsCache.get(callSid);
    if (callData) {
      callData.answeredBy = answeredBy;
      callData.machineDetected = answeredBy !== 'human';
      this.activeCallsCache.set(callSid, callData);
      
      logger.info('Machine detection result', {
        callSid,
        answeredBy,
        isMachine: callData.machineDetected
      });
      
      return callData.machineDetected;
    }
    return false;
  }

  /**
   * Get call statistics
   * @returns {Object} Call statistics
   */
  getCallStatistics() {
    const activeCalls = this.getActiveCalls();
    const stats = {
      ...this.callStatistics,
      activeCalls: activeCalls.length,
      byStatus: {},
      byPurpose: {},
      averageDuration: 0
    };

    let totalDuration = 0;
    let callsWithDuration = 0;

    activeCalls.forEach(call => {
      // Count by status
      stats.byStatus[call.status] = (stats.byStatus[call.status] || 0) + 1;
      
      // Count by purpose
      stats.byPurpose[call.purpose || 'unknown'] = (stats.byPurpose[call.purpose || 'unknown'] || 0) + 1;
      
      // Calculate duration for active calls
      if (call.startTime) {
        const duration = (new Date() - call.startTime) / 1000; // in seconds
        totalDuration += duration;
        callsWithDuration++;
      }
    });

    if (callsWithDuration > 0) {
      stats.averageDuration = Math.round(totalDuration / callsWithDuration);
    }

    return stats;
  }

  // Private utility methods

  /**
   * Store call data in cache
   * @private
   * @param {string} callSid - Call SID
   * @param {Object} data - Call data
   */
  _storeCallData(callSid, data) {
    this.activeCallsCache.set(callSid, data);
  }

  /**
   * Validate phone number format
   * @private
   * @param {string} phoneNumber - Phone number to validate
   * @throws {Error} If phone number is invalid
   */
  _validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || !REGEX_PATTERNS.PHONE_NUMBER.test(phoneNumber.replace(/\s+/g, ''))) {
      throw new Error('Invalid phone number format');
    }
  }

  /**
   * Validate SMS message
   * @private
   * @param {string} message - Message to validate
   * @throws {Error} If message is invalid
   */
  _validateSMSMessage(message) {
    if (!message || !message.trim()) {
      throw new Error('SMS message cannot be empty');
    }
    
    if (message.length > 1600) {
      throw new Error('SMS message too long (max 1600 characters)');
    }
  }

  /**
   * Mask phone number for privacy
   * @private
   * @param {string} phoneNumber - Phone number to mask
   * @returns {string} Masked phone number
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
}

module.exports = new TwilioService();