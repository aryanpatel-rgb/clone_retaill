/**
 * AI Function Service
 * Advanced function calling system for AI agents
 */

const logger = require('../utils/logger');
const databaseService = require('./databaseService');
const customFunctionService = require('./customFunctionService');

class AIFunctionService {
  constructor() {
    this.functionRegistry = new Map();
    this.contextVariables = new Map();
    this.conversationStates = new Map();
    this._initializeBuiltInFunctions();
  }

  /**
   * Initialize built-in functions
   */
  _initializeBuiltInFunctions() {
    // Calendar functions
    this.registerFunction('check_availability', this.checkAvailability.bind(this));
    this.registerFunction('book_appointment', this.bookAppointment.bind(this));
    this.registerFunction('reschedule_appointment', this.rescheduleAppointment.bind(this));
    this.registerFunction('cancel_appointment', this.cancelAppointment.bind(this));
    
    // CRM functions
    this.registerFunction('create_lead', this.createLead.bind(this));
    this.registerFunction('update_customer', this.updateCustomer.bind(this));
    this.registerFunction('add_note', this.addNote.bind(this));
    this.registerFunction('send_email', this.sendEmail.bind(this));
    this.registerFunction('send_sms', this.sendSMS.bind(this));
    
    // Business functions
    this.registerFunction('get_product_info', this.getProductInfo.bind(this));
    this.registerFunction('check_inventory', this.checkInventory.bind(this));
    this.registerFunction('process_payment', this.processPayment.bind(this));
    this.registerFunction('generate_quote', this.generateQuote.bind(this));
    
    // Utility functions
    this.registerFunction('get_current_time', this.getCurrentTime.bind(this));
    this.registerFunction('format_date', this.formatDate.bind(this));
    this.registerFunction('calculate_distance', this.calculateDistance.bind(this));
    this.registerFunction('translate_text', this.translateText.bind(this));
    
    // Call control
    this.registerFunction('transfer_call', this.transferCall.bind(this));
    this.registerFunction('hold_call', this.holdCall.bind(this));
    this.registerFunction('end_call', this.endCall.bind(this));
    this.registerFunction('schedule_callback', this.scheduleCallback.bind(this));
    
    logger.info('AI function service initialized', { 
      functionCount: this.functionRegistry.size 
    });
  }

  /**
   * Register a function
   */
  registerFunction(name, implementation, options = {}) {
    this.functionRegistry.set(name, {
      implementation,
      options: {
        description: options.description || `Execute ${name}`,
        parameters: options.parameters || {},
        timeout: options.timeout || 10000,
        retries: options.retries || 3,
        ...options
      }
    });
    logger.info('Function registered', { name, options: options.description });
  }

  /**
   * Process AI response with function calling
   */
  async processAIResponse(response, context = {}) {
    try {
      // Enhanced function detection with multiple patterns
      const functionCalls = this.detectFunctionCalls(response);
      
      if (functionCalls.length === 0) {
        return response;
      }

      logger.info('Processing function calls', { 
        callId: context.callId,
        functionCount: functionCalls.length,
        functions: functionCalls.map(f => f.name)
      });

      let processedResponse = response;
      const executionResults = [];

      // Execute functions in sequence
      for (const call of functionCalls) {
        try {
          const result = await this.executeFunctionCall(call, context);
          executionResults.push({
            function: call.name,
            success: true,
            result
          });

          // Replace function call with result in response
          processedResponse = processedResponse.replace(call.originalText, result);
        } catch (error) {
          logger.error('Function execution failed', { 
            function: call.name, 
            error: error.message 
          });
          
          executionResults.push({
            function: call.name,
            success: false,
            error: error.message
          });

          // Replace with error message
          processedResponse = processedResponse.replace(
            call.originalText, 
            `[Function ${call.name} failed: ${error.message}]`
          );
        }
      }

      // Store execution results in conversation state
      if (context.callId) {
        this.updateConversationState(context.callId, {
          lastFunctionExecution: executionResults,
          timestamp: new Date().toISOString()
        });
      }

      return processedResponse;

    } catch (error) {
      logger.error('Error processing AI response', { 
        callId: context.callId,
        error: error.message 
      });
      return response;
    }
  }

  /**
   * Enhanced function call detection
   */
  detectFunctionCalls(text) {
    const calls = [];
    
    // Pattern 1: function_name(parameters)
    const standardPattern = /(\w+)\s*\(([^)]*)\)/g;
    
    // Pattern 2: call function_name with parameters
    const callPattern = /call\s+(\w+)\s+(?:with\s+)?(.*?)(?=\n|$|call\s+\w+)/gi;
    
    // Pattern 3: execute function_name(parameters)
    const executePattern = /execute\s+(\w+)\s*\(([^)]*)\)/gi;
    
    // Pattern 4: use function_name to do something
    const usePattern = /use\s+(\w+)\s+to\s+(.*?)(?=\n|$|use\s+\w+)/gi;

    // Check all patterns
    this.extractFromPattern(text, standardPattern, (match, name, params) => {
      calls.push({ name, parameters: params, originalText: match[0] });
    });

    this.extractFromPattern(text, callPattern, (match, name, params) => {
      calls.push({ name, parameters: params, originalText: match[0] });
    });

    this.extractFromPattern(text, executePattern, (match, name, params) => {
      calls.push({ name, parameters: params, originalText: match[0] });
    });

    this.extractFromPattern(text, usePattern, (match, name, params) => {
      calls.push({ name, parameters: params, originalText: match[0] });
    });

    // Remove duplicates and filter out common words
    const uniqueCalls = calls.filter((call, index, self) => 
      index === self.findIndex(c => c.name === call.name && c.originalText === call.originalText) &&
      !this.isCommonWord(call.name)
    );

    return uniqueCalls;
  }

  /**
   * Extract matches from regex pattern
   */
  extractFromPattern(text, pattern, callback) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      callback(match, match[1], match[2]);
    }
  }

  /**
   * Check if word is common (not a function)
   */
  isCommonWord(word) {
    const commonWords = [
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'among', 'under', 'over',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
      'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
      'his', 'her', 'its', 'our', 'their', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
      'a', 'an', 'the', 'call', 'execute', 'use', 'get', 'set', 'make',
      'take', 'give', 'go', 'come', 'see', 'know', 'think', 'say', 'tell'
    ];
    return commonWords.includes(word.toLowerCase());
  }

  /**
   * Execute function call with retry logic
   */
  async executeFunctionCall(call, context) {
    const { name, parameters } = call;
    const functionData = this.functionRegistry.get(name);
    
    if (!functionData) {
      throw new Error(`Function '${name}' not found`);
    }

    // Parse parameters
    const parsedParams = this.parseParameters(parameters, context);
    
    // Execute with timeout and retries
    const { implementation, options } = functionData;
    
    for (let attempt = 1; attempt <= options.retries; attempt++) {
      try {
        logger.info('Executing function', { 
          function: name, 
          attempt, 
          parameters: parsedParams,
          callId: context.callId
        });

        const result = await Promise.race([
          implementation(parsedParams, context),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Function timeout')), options.timeout)
          )
        ]);

        logger.info('Function executed successfully', { 
          function: name, 
          attempt,
          callId: context.callId
        });

        return result;

      } catch (error) {
        logger.warn('Function execution attempt failed', { 
          function: name, 
          attempt, 
          error: error.message,
          callId: context.callId
        });

        if (attempt === options.retries) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Parse function parameters with context variable replacement
   */
  parseParameters(parametersString, context) {
    const params = {};
    
    if (!parametersString || !parametersString.trim()) {
      return params;
    }

    // Replace context variables
    let processedString = parametersString;
    
    // Replace {{variable}} patterns
    processedString = processedString.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return context[variable] || match;
    });

    // Parse key=value pairs
    const keyValuePairs = processedString.split(',').map(pair => pair.trim());
    
    for (const pair of keyValuePairs) {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (key && value) {
        // Remove quotes if present
        params[key] = value.replace(/^["']|["']$/g, '');
      }
    }

    return params;
  }

  /**
   * Update conversation state
   */
  updateConversationState(callId, state) {
    const currentState = this.conversationStates.get(callId) || {};
    this.conversationStates.set(callId, {
      ...currentState,
      ...state,
      lastUpdate: new Date().toISOString()
    });
  }

  /**
   * Get conversation state
   */
  getConversationState(callId) {
    return this.conversationStates.get(callId) || {};
  }

  // =============================================================================
  // BUILT-IN FUNCTIONS
  // =============================================================================

  /**
   * Check availability
   */
  async checkAvailability(params, context) {
    const { date, time, duration = 30, service_type = 'consultation' } = params;
    
    // Mock implementation - replace with actual calendar integration
    const availableSlots = [
      { time: '09:00', available: true },
      { time: '10:00', available: true },
      { time: '14:00', available: false },
      { time: '15:00', available: true },
      { time: '16:00', available: true }
    ];

    const available = availableSlots.filter(slot => slot.available);
    
    if (available.length === 0) {
      return `I'm sorry, but I don't have any available slots for ${date} ${time}. Let me check other dates for you.`;
    }

    const timeSlots = available.map(slot => slot.time).join(', ');
    return `I have several available slots for ${date}: ${timeSlots}. Which time works best for you?`;
  }

  /**
   * Book appointment
   */
  async bookAppointment(params, context) {
    const { customer_name, date, time, service_type = 'consultation', duration = 30 } = params;
    
    // Mock booking - replace with actual booking logic
    const bookingId = `booking-${Date.now()}`;
    
    logger.info('Appointment booked', { 
      bookingId, 
      customer_name, 
      date, 
      time,
      callId: context.callId
    });

    return `Perfect! I've booked your ${service_type} for ${date} at ${time}. Your booking ID is ${bookingId}. You'll receive a confirmation email shortly.`;
  }

  /**
   * Reschedule appointment
   */
  async rescheduleAppointment(params, context) {
    const { booking_id, new_date, new_time } = params;
    
    // Mock rescheduling
    logger.info('Appointment rescheduled', { 
      booking_id, 
      new_date, 
      new_time,
      callId: context.callId
    });

    return `I've successfully rescheduled your appointment to ${new_date} at ${new_time}. You'll receive an updated confirmation email.`;
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(params, context) {
    const { booking_id } = params;
    
    // Mock cancellation
    logger.info('Appointment cancelled', { 
      booking_id,
      callId: context.callId
    });

    return `Your appointment ${booking_id} has been cancelled. You'll receive a cancellation confirmation email shortly.`;
  }

  /**
   * Create lead
   */
  async createLead(params, context) {
    const { name, email, phone, company, source = 'phone_call' } = params;
    
    // Mock lead creation
    const leadId = `lead-${Date.now()}`;
    
    logger.info('Lead created', { 
      leadId, 
      name, 
      email, 
      phone,
      callId: context.callId
    });

    return `I've created a lead for ${name} from ${company || 'unknown company'}. Lead ID: ${leadId}. Our sales team will follow up within 24 hours.`;
  }

  /**
   * Update customer
   */
  async updateCustomer(params, context) {
    const { customer_id, field, value } = params;
    
    // Mock customer update
    logger.info('Customer updated', { 
      customer_id, 
      field, 
      value,
      callId: context.callId
    });

    return `I've updated ${field} for customer ${customer_id} to ${value}. The changes have been saved.`;
  }

  /**
   * Add note
   */
  async addNote(params, context) {
    const { note, category = 'general' } = params;
    
    // Mock note addition
    logger.info('Note added', { 
      note: note.substring(0, 100), 
      category,
      callId: context.callId
    });

    return `I've added your note to the customer record. Category: ${category}.`;
  }

  /**
   * Send email
   */
  async sendEmail(params, context) {
    const { to, subject, template = 'default' } = params;
    
    // Mock email sending
    logger.info('Email sent', { 
      to, 
      subject, 
      template,
      callId: context.callId
    });

    return `I've sent an email to ${to} with subject "${subject}". The email has been queued for delivery.`;
  }

  /**
   * Send SMS
   */
  async sendSMS(params, context) {
    const { to, message } = params;
    
    // Mock SMS sending
    logger.info('SMS sent', { 
      to, 
      message: message.substring(0, 50),
      callId: context.callId
    });

    return `I've sent an SMS to ${to} with your message. The SMS has been delivered.`;
  }

  /**
   * Get product info
   */
  async getProductInfo(params, context) {
    const { product_name } = params;
    
    // Mock product info
    const products = {
      'consultation': { price: '$150', duration: '1 hour', description: 'One-on-one consultation session' },
      'demo': { price: '$200', duration: '2 hours', description: 'Product demonstration and Q&A' },
      'support': { price: '$100', duration: '30 minutes', description: 'Technical support session' }
    };

    const product = products[product_name.toLowerCase()] || { 
      price: '$99', 
      duration: '1 hour', 
      description: 'Custom service' 
    };

    return `Our ${product_name} service is ${product.price} for ${product.duration}. ${product.description}. Would you like to book this service?`;
  }

  /**
   * Check inventory
   */
  async checkInventory(params, context) {
    const { product_name } = params;
    
    // Mock inventory check
    const stock = Math.floor(Math.random() * 50) + 1;
    
    return `We have ${stock} units of ${product_name} in stock. Would you like me to check availability for delivery?`;
  }

  /**
   * Process payment
   */
  async processPayment(params, context) {
    const { amount, payment_method = 'credit_card' } = params;
    
    // Mock payment processing
    const transactionId = `txn-${Date.now()}`;
    
    logger.info('Payment processed', { 
      transactionId, 
      amount, 
      payment_method,
      callId: context.callId
    });

    return `Payment of ${amount} has been processed successfully using ${payment_method}. Transaction ID: ${transactionId}.`;
  }

  /**
   * Generate quote
   */
  async generateQuote(params, context) {
    const { service_type, quantity = 1 } = params;
    
    // Mock quote generation
    const quoteId = `quote-${Date.now()}`;
    const price = quantity * 150; // $150 per unit
    
    return `I've generated a quote for ${quantity} ${service_type} service(s). Total: $${price}. Quote ID: ${quoteId}. This quote is valid for 30 days.`;
  }

  /**
   * Get current time
   */
  async getCurrentTime(params, context) {
    const now = new Date();
    const timeString = now.toLocaleString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return `The current time is ${timeString} (${timezone}).`;
  }

  /**
   * Format date
   */
  async formatDate(params, context) {
    const { date, format = 'long' } = params;
    
    try {
      const dateObj = new Date(date);
      let formatted;
      
      switch (format) {
        case 'short':
          formatted = dateObj.toLocaleDateString();
          break;
        case 'long':
          formatted = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          break;
        case 'time':
          formatted = dateObj.toLocaleTimeString();
          break;
        default:
          formatted = dateObj.toLocaleString();
      }

      return `The date ${date} formatted as ${format} is: ${formatted}`;
    } catch (error) {
      return `I couldn't format the date ${date}. Please provide a valid date format.`;
    }
  }

  /**
   * Calculate distance
   */
  async calculateDistance(params, context) {
    const { from, to, unit = 'miles' } = params;
    
    // Mock distance calculation
    const distance = Math.floor(Math.random() * 100) + 1;
    
    return `The distance from ${from} to ${to} is approximately ${distance} ${unit}.`;
  }

  /**
   * Translate text
   */
  async translateText(params, context) {
    const { text, to_language = 'spanish' } = params;
    
    // Mock translation
    const translations = {
      'spanish': 'Hola, ¿cómo puedo ayudarte hoy?',
      'french': 'Bonjour, comment puis-je vous aider aujourd\'hui?',
      'german': 'Hallo, wie kann ich Ihnen heute helfen?'
    };
    
    const translation = translations[to_language.toLowerCase()] || `[Translated to ${to_language}]: ${text}`;
    
    return `Translation of "${text}" to ${to_language}: ${translation}`;
  }

  /**
   * Transfer call
   */
  async transferCall(params, context) {
    const { department = 'sales', reason = 'specialized assistance' } = params;
    
    logger.info('Call transfer initiated', { 
      department, 
      reason,
      callId: context.callId
    });

    return `I'm transferring you to our ${department} department for ${reason}. Please hold while I connect you.`;
  }

  /**
   * Hold call
   */
  async holdCall(params, context) {
    const { duration = 30 } = params;
    
    logger.info('Call placed on hold', { 
      duration,
      callId: context.callId
    });

    return `I'm placing you on hold for about ${duration} seconds while I gather that information for you.`;
  }

  /**
   * End call
   */
  async endCall(params, context) {
    logger.info('Call ended', { 
      callId: context.callId
    });

    return `Thank you for calling. Have a great day!`;
  }

  /**
   * Schedule callback
   */
  async scheduleCallback(params, context) {
    const { date, time, reason = 'follow-up' } = params;
    
    const callbackId = `callback-${Date.now()}`;
    
    logger.info('Callback scheduled', { 
      callbackId, 
      date, 
      time, 
      reason,
      callId: context.callId
    });

    return `I've scheduled a callback for ${date} at ${time} for ${reason}. Callback ID: ${callbackId}. We'll call you back at that time.`;
  }

  /**
   * Get available functions
   */
  getAvailableFunctions() {
    const functions = [];
    
    for (const [name, data] of this.functionRegistry.entries()) {
      functions.push({
        name,
        description: data.options.description,
        parameters: data.options.parameters,
        timeout: data.options.timeout,
        retries: data.options.retries
      });
    }
    
    return functions;
  }

  /**
   * Cleanup conversation state
   */
  cleanupConversation(callId) {
    this.conversationStates.delete(callId);
    logger.info('Conversation state cleaned up', { callId });
  }
}

module.exports = new AIFunctionService();
