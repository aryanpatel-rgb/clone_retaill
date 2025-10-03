/**
 * Dynamic AI Service for Dynamic AI Calling Platform
 * Handles AI conversations with custom prompts from users
 */

const config = require('../config/config');
const logger = require('../utils/logger');
const databaseService = require('./postgresDatabaseService');
const { executeQuery } = require('../database/connection');
const llmService = require('./llmService');
// AI function calling
const aiFunctionService = require('./retellAIStyleService'); // Advanced AI function caller
const externalCalendarService = require('./externalCalendarService'); // Cal.com integration
const calendarService = require('./calendarService'); // Internal calendar

class DynamicAIService {
  constructor() {
    // Active conversations storage
    this.conversations = new Map();
    
    // Simple function calling initialized
    
    // Cleanup old conversations every hour
    setInterval(() => this.cleanupOldConversations(), 60 * 60 * 1000);
  }

  // Simple function calling system

  /**
   * Initialize conversation with custom agent
   */
  async initializeConversation(callId, agentId, customerPhone = null, customerName = null) {
    try {
      // Get agent configuration from database
      const agentResult = await executeQuery('SELECT * FROM agents WHERE agent_id = $1', [agentId]);
      const agent = agentResult.rows[0];
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Create conversation context
      const conversation = {
        callId,
        agentId,
        agent: agent,
        customerPhone,
        customerName,
        messages: [],
        startTime: new Date()
      };

      // Store conversation
      this.conversations.set(callId, conversation);

      // Generate initial greeting using the agent's custom prompt
      const greeting = await this.generateResponse(callId, null, 'greeting');

      // Debug: Log the actual greeting content
      logger.info('Generated greeting', { 
        callId, 
        greeting: greeting.substring(0, 100) + (greeting.length > 100 ? '...' : ''),
        fullLength: greeting.length
      });

      // Add greeting to conversation
      conversation.messages.push({ role: 'assistant', content: greeting });
      this.conversations.set(callId, conversation);

      // Store in database
      await databaseService.addConversationMessage(callId, 'assistant', greeting);

      logger.info('Conversation initialized', { 
        callId, 
        agentId, 
        agentName: agent.name,
        customerPhone: customerPhone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      });

      return {
        response: greeting,
        conversationComplete: false,
        agent: agent
      };

    } catch (error) {
      logger.error('Error initializing conversation', { 
        callId, 
        agentId, 
        error: error.message 
      });

      return {
        response: "Hello! I'm here to help you. How can I assist you today?",
        conversationComplete: false,
        error: error.message
      };
    }
  }

  /**
   * Process user input with custom agent
   */
  async processUserInput(callId, userInput, customerPhone = null) {
    try {
      const conversation = this.conversations.get(callId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const { agent } = conversation;

      // Normalize user input for better processing
      const normalizedInput = this.normalizeUserInput(userInput);
      
      // Log the normalized input for debugging
      logger.info('Processing user input', {
        callId,
        originalInput: userInput,
        normalizedInput: normalizedInput,
        inputLength: userInput?.length || 0
      });

      // Add user message to conversation
      conversation.messages.push({ role: 'user', content: normalizedInput });
      this.conversations.set(callId, conversation);

      // Store in database
      await databaseService.addConversationMessage(callId, 'user', normalizedInput);

      // Generate AI response using custom prompt
      const aiResponse = await this.generateResponse(callId, userInput, 'conversation');

      // Add AI response to conversation
      conversation.messages.push({ role: 'assistant', content: aiResponse });
      this.conversations.set(callId, conversation);

      // Store in database
      await databaseService.addConversationMessage(callId, 'assistant', aiResponse);

      // Check if conversation is complete
      const conversationComplete = this.isConversationComplete(aiResponse);

      logger.info('User input processed', {
        callId,
        agentId: agent.id,
        agentName: agent.name,
        inputLength: userInput.length,
        responseLength: aiResponse.length,
        complete: conversationComplete
      });

      return {
        response: aiResponse,
        conversationComplete: conversationComplete,
        agent: agent
      };

    } catch (error) {
      logger.error('Error processing user input', { 
        callId, 
        error: error.message 
      });

      return {
        response: "I'm sorry, I'm having trouble understanding. Could you please repeat that?",
        conversationComplete: false,
        error: error.message
      };
    }
  }

  /**
   * Generate AI response using custom prompt
   */
  async generateResponse(callId, userInput, context = 'conversation') {
    try {
      const conversation = this.conversations.get(callId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const { agent, customerName, customerPhone } = conversation;

      // Build the system prompt with custom user prompt
      let systemPrompt = this.buildSystemPrompt(agent, customerName, customerPhone);

      // Add context-specific instructions
      if (context === 'greeting') {
        systemPrompt += '\n\nIMPORTANT: This is the first message of the conversation. Provide a warm, friendly greeting that introduces yourself and asks how you can help.';
      } else if (context === 'conversation') {
        systemPrompt += '\n\nIMPORTANT: Respond naturally to the user\'s input. Be helpful, engaging, and follow the personality and instructions defined in your prompt.';
      }

      // Prepare messages for OpenAI
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversation.messages.slice(-10) // Keep last 10 messages for context
      ];

      // Define available functions for the AI
      const functions = [
        {
          name: 'check_availability',
          description: 'Check if a specific date and time is available in the Cal.com calendar',
          parameters: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'The date to check (e.g., "2025-10-06")'
              },
              time: {
                type: 'string',
                description: 'The time to check (e.g., "14:00" for 2 PM)'
              }
            },
            required: ['date', 'time']
          }
        },
        {
          name: 'book_appointment',
          description: 'Book an appointment in the Cal.com calendar',
          parameters: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'The date for the appointment (e.g., "2025-10-06")'
              },
              time: {
                type: 'string',
                description: 'The time for the appointment (e.g., "14:00" for 2 PM)'
              },
              customerName: {
                type: 'string',
                description: 'The customer\'s name'
              },
              customerEmail: {
                type: 'string',
                description: 'The customer\'s email address'
              },
              customerPhone: {
                type: 'string',
                description: 'The customer\'s phone number'
              }
            },
            required: ['date', 'time', 'customerName', 'customerEmail', 'customerPhone']
          }
        },
        {
          name: 'get_current_time',
          description: 'Get the current date and time',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ];

      // Generate response using LLM service with function calling
      const response = await llmService.generateResponse(messages, {
        provider: agent.provider || 'openai',
        model: agent.model || config.get('openai.model'),
        temperature: agent.temperature || config.get('openai.temperature'),
        maxTokens: agent.max_tokens || config.get('openai.maxTokens'),
        timeout: 10000,
        functions: functions,
        functionCall: 'auto'
      });

      // Handle function calling response
      if (response && typeof response === 'object' && response.function_call) {
        return await this.handleFunctionCall(callId, response.function_call, conversation);
      }

      if (!response || (typeof response === 'string' && response.trim().length === 0)) {
        throw new Error('Empty response from AI');
      }

      // Process function calls in AI response
      const functionContext = {
        callId,
        customerName: conversation.customerName,
        customerPhone: conversation.customerPhone,
        customerEmail: conversation.customerEmail || 'customer@example.com',
        agentId: conversation.agentId,
        agent: conversation.agent
      };
      
      const processedResponse = await aiFunctionService.processAIResponse(response.trim(), functionContext);
      
      // Log if response was processed
      if (processedResponse !== response.trim()) {
        logger.info('Function calls executed', { callId });
      }
      
      return processedResponse;

    } catch (error) {
      logger.error('Error generating AI response', { 
        callId, 
        error: error.message 
      });

      // Fallback response
      return "I'm sorry, I'm having trouble processing that right now. Could you please try again?";
    }
  }

  /**
   * Normalize user input for better processing
   */
  normalizeUserInput(userInput) {
    if (!userInput) return '';
    
    let normalized = userInput.toLowerCase().trim();
    
    // Handle common speech recognition issues
    const replacements = {
      'already': 'already',
      'all ready': 'already',
      'all right': 'already',
      'alright': 'already',
      'yes': 'yes',
      'yeah': 'yes',
      'yep': 'yes',
      'no': 'no',
      'nope': 'no',
      'book': 'book',
      'schedule': 'schedule',
      'appointment': 'appointment',
      'available': 'available',
      'time': 'time',
      'date': 'date'
    };
    
    // Apply replacements
    Object.entries(replacements).forEach(([wrong, correct]) => {
      normalized = normalized.replace(new RegExp(wrong, 'gi'), correct);
    });
    
    return normalized;
  }

  /**
   * Build system prompt from agent configuration
   */
  buildSystemPrompt(agent, customerName = null, customerPhone = null) {
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();

    // Start with the user's custom prompt
    let systemPrompt = agent.prompt;

    // Add context information
    systemPrompt += `\n\nCONTEXT INFORMATION:
- Current date: ${currentDate}
- Current time: ${currentTime}
- Agent name: ${agent.name}
- Agent description: ${agent.description || 'No description provided'}`;

    if (customerName) {
      systemPrompt += `\n- Customer name: ${customerName}`;
    }

    if (customerPhone) {
      systemPrompt += `\n- Customer phone: ${customerPhone}`;
    }

    // Add conversation guidelines
    systemPrompt += `\n\nCONVERSATION GUIDELINES:
- Be natural and conversational
- Follow the personality and instructions defined in your prompt
- Keep responses concise but helpful
- If you don't understand something, ask for clarification
- Be polite and professional
- Remember the context of the conversation
- IMPORTANT: If the user says "already" or interrupts you, they likely mean they already have an appointment or want to book one
- Pay attention to user interruptions - they may have important information to share
- Handle user input immediately when they speak, even if you're in the middle of explaining something`;

    // Add function calling information
    systemPrompt += `\n\nAVAILABLE FUNCTIONS:
You have access to the following functions to help with appointments:

1. check_availability(date, time) - Check if a specific date and time is available in the Cal.com calendar
   Example: "Let me check if October 6th at 2 PM is available"

2. book_appointment(date, time, customerName, customerEmail, customerPhone) - Book an appointment in the Cal.com calendar
   Example: "I'll book your appointment for October 6th at 2 PM"

3. get_current_time() - Get the current date and time
   Example: "Let me check what time it is now"

4. format_date(date) - Format a date in a readable format
   Example: "That would be Monday, October 6th"

IMPORTANT: When users ask to book appointments, use these functions in the following order:
1. First, use check_availability() to verify the time slot is available
2. If available, use book_appointment() to book the appointment
3. If not available, suggest alternative times and check availability again
4. Always confirm the booking details with the user`;

    return systemPrompt;
  }

  /**
   * Handle function calls from the AI
   */
  async handleFunctionCall(callId, functionCall, conversation) {
    try {
      const { name, arguments: args } = functionCall;
      const argsObj = typeof args === 'string' ? JSON.parse(args) : args;

      logger.info('Handling function call', { 
        callId, 
        functionName: name, 
        arguments: argsObj 
      });

      let functionResult;
      
      // Try to use user's custom functions first
      const customFunctionService = require('./customFunctionService');
      
      // Ensure functions are loaded before lookup
      await customFunctionService.loadFunctionsFromDatabase();
      
      const customFunction = customFunctionService.getFunction(name);
      
      logger.info('Function lookup result', { 
        functionName: name, 
        customFunctionFound: !!customFunction,
        availableFunctions: customFunctionService.getAllFunctionNames()
      });
      
      if (customFunction) {
        // Use user's custom function with their API key and configuration
        logger.info('Using custom function', { functionName: name });
        functionResult = await customFunctionService.executeFunction(name, argsObj, {
          callId: callId,
          agentId: conversation.agentId,
          customerName: conversation.customerName,
          customerPhone: conversation.customerPhone
        });
      } else {
        // Fallback to built-in functions
        logger.info('Using built-in function', { functionName: name });
        const registry = require('./functionRegistry');

        switch (name) {
          case 'check_availability':
            // Try Cal.com first, then fallback to internal calendar
            functionResult = await registry.checkAvailabilityCal(
              {
                date: argsObj.date,
                time: argsObj.time,
                eventTypeId: argsObj.eventTypeId || '3053103', // Default to 30 Min Meeting
                agentId: conversation.agentId,
                duration: argsObj.duration || 30
              },
              { callId: callId }
            );
            break;

          case 'book_appointment':
            // Use Cal.com for booking with proper time handling
            const formattedTime = argsObj.time ? (argsObj.time.includes(':') ? argsObj.time + ':00' : argsObj.time + ':00:00') : '00:00:00';
            const startTime = new Date(`${argsObj.date}T${formattedTime}`);
            const duration = argsObj.duration || 30;
            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
            
            functionResult = await registry.bookAppointmentCal(
              {
                eventTypeId: argsObj.eventTypeId || '3053103', // Default to 30 Min Meeting
                customerName: conversation.customerName || 'Unknown Customer',
                customerEmail: argsObj.customerEmail || 'customer@example.com',
                customerPhone: argsObj.customerPhone || conversation.customerPhone || '+1234567890',
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                title: `Appointment with ${conversation.customerName || 'Customer'}`,
                agentId: conversation.agentId,
                date: argsObj.date,
                time: argsObj.time,
                duration: duration
              },
              { callId: callId } // Pass context with callId
            );
            break;

          case 'get_current_time':
            functionResult = await registry.getCurrentTime();
            break;

          default:
            functionResult = {
              success: false,
              error: `Unknown function: ${name}`
            };
            break;
        }
      }

      // Add function call and result to conversation
      conversation.messages.push({ 
        role: 'assistant', 
        content: `Calling function: ${name}`,
        function_call: functionCall
      });
      conversation.messages.push({ 
        role: 'function', 
        name: name,
        content: JSON.stringify(functionResult)
      });

      // Generate a natural language response about the function result
      const responseMessage = this.generateFunctionResponse(name, argsObj, functionResult, conversation);
      
      conversation.messages.push({ role: 'assistant', content: responseMessage });
      this.conversations.set(callId, conversation);

      // Store in database
      await databaseService.addConversationMessage(callId, 'assistant', responseMessage);

      return responseMessage;

    } catch (error) {
      logger.error('Error handling function call', { 
        callId, 
        functionName: functionCall.name, 
        error: error.message 
      });

      return `I apologize, but I encountered an error while trying to ${functionCall.name}. Let me try a different approach.`;
    }
  }

  /**
   * Generate natural language response for function results
   */
  generateFunctionResponse(functionName, args, result, conversation) {
    switch (functionName) {
      case 'check_availability':
        if (result.success && result.available) {
          return `Great news! ${args.date} at ${args.time} is available for booking. Would you like me to book this appointment for you?`;
        } else if (result.success && !result.available) {
          return `I'm sorry, but ${args.date} at ${args.time} is not available. Let me suggest some alternative times. What other times work for you?`;
        } else {
          return `I'm having trouble checking availability for ${args.date} at ${args.time}. Could you please provide a different date and time?`;
        }

      case 'book_appointment':
        if (result.success) {
          return `Perfect! I've successfully booked your appointment for ${args.date} at ${args.time}. Your booking ID is ${result.bookingId}. Is there anything else I can help you with today?`;
        } else {
          return `I apologize, but I wasn't able to book the appointment for ${args.date} at ${args.time}. ${result.error || 'Please try a different time.'}`;
        }

      case 'get_current_time':
        return `The current time is ${result.currentTime}. How can I help you with your appointment scheduling?`;

      default:
        return `I've processed your request. How else can I assist you today?`;
    }
  }

  /**
   * Check if conversation is complete
   */
  isConversationComplete(response) {
    const completionPhrases = [
      'goodbye',
      'thank you',
      'have a great day',
      'talk to you later',
      'see you later',
      'bye',
      'farewell',
      'appointment confirmed',
      'booking confirmed',
      'call completed'
    ];
    
    const lowerResponse = response.toLowerCase();
    return completionPhrases.some(phrase => lowerResponse.includes(phrase));
  }

  /**
   * Get conversation history
   */
  getConversationHistory(callId) {
    return this.conversations.get(callId) || null;
  }

  /**
   * Cleanup conversation
   */
  cleanupConversation(callId) {
    const conversation = this.conversations.get(callId);
    if (conversation) {
      logger.info('Conversation cleaned up', { 
        callId, 
        agentId: conversation.agentId,
        duration: Date.now() - conversation.startTime.getTime()
      });
      this.conversations.delete(callId);
    }
  }

  /**
   * Cleanup old conversations
   */
  cleanupOldConversations() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    let cleaned = 0;
    
    for (const [callId, conversation] of this.conversations.entries()) {
      if (conversation.startTime.getTime() < cutoff) {
        this.conversations.delete(callId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info('Cleaned up old conversations', { count: cleaned });
    }
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(callId) {
    const conversation = this.conversations.get(callId);
    if (!conversation) {
      return null;
    }

    return {
      callId,
      agentId: conversation.agentId,
      agentName: conversation.agent.name,
      customerName: conversation.customerName,
      customerPhone: conversation.customerPhone,
      messageCount: conversation.messages.length,
      startTime: conversation.startTime,
      duration: Date.now() - conversation.startTime.getTime()
    };
  }

  /**
   * Get active conversations count
   */
  getActiveConversationsCount() {
    return this.conversations.size;
  }

  /**
   * Get all active conversations
   */
  getAllActiveConversations() {
    const conversations = [];
    for (const [callId, conversation] of this.conversations.entries()) {
      conversations.push({
        callId,
        agentId: conversation.agentId,
        agentName: conversation.agent.name,
        customerName: conversation.customerName,
        customerPhone: conversation.customerPhone,
        messageCount: conversation.messages.length,
        startTime: conversation.startTime,
        duration: Date.now() - conversation.startTime.getTime()
      });
    }
    return conversations;
  }

  /**
   * Detect if user input contains booking intent
   */
  detectBookingIntent(userInput) {
    const input = userInput.toLowerCase();
    
    // Booking-related keywords
    const bookingKeywords = [
      'book', 'schedule', 'appointment', 'meeting', 'consultation', 'demo',
      'available', 'availability', 'time slot', 'when can', 'what time',
      'tomorrow', 'next week', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ];

    const hasBookingKeywords = bookingKeywords.some(keyword => input.includes(keyword));
    
    if (hasBookingKeywords) {
      // Determine booking type
      if (input.includes('consultation') || input.includes('demo')) {
        return { type: 'consultation', intent: 'book_consultation' };
      } else if (input.includes('support') || input.includes('help')) {
        return { type: 'support', intent: 'book_support' };
      } else if (input.includes('appointment') || input.includes('meeting')) {
        return { type: 'appointment', intent: 'book_appointment' };
      } else {
        return { type: 'general', intent: 'check_availability' };
      }
    }

    return null;
  }

  /**
   * Handle booking-related requests
   */
  async handleBookingRequest(callId, userInput, bookingIntent, agent, conversation) {
    try {
      logger.info('Handling booking request', {
        callId,
        agentId: agent.id,
        bookingIntent: bookingIntent.type,
        userInput: userInput.substring(0, 100)
      });

      // Try Cal.com first, fallback to internal calendar
      let availability = [];
      let calendarProvider = 'internal';

      // Check if Cal.com is configured and agent has event type
      const isCalComReady = await externalCalendarService.isCalComReady();

      if (isCalComReady && agent.calcom_event_type_id) {
        try {
          const startDate = new Date().toISOString();
          const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Next 7 days
          
          const result = await externalCalendarService.getAvailableSlots(
            agent.calcom_event_type_id,
            startDate,
            endDate,
            30
          );

          if (result.success && result.slots.length > 0) {
            availability = result.slots.slice(0, 5);
            calendarProvider = 'calcom';
          }
        } catch (error) {
          logger.warn('Cal.com failed, falling back to internal calendar', {
            eventTypeId: agent.calcom_event_type_id,
            error: error.message
          });
        }
      }

      // Fallback to internal calendar
      if (availability.length === 0) {
        availability = await calendarService.getNextAvailableSlots(agent.id, 5);
        calendarProvider = 'internal';
      }
      
      if (availability.length === 0) {
        return "I'm sorry, but I don't have any available slots at the moment. Let me check with my team and get back to you. Could you please provide your phone number so I can call you back with available times?";
      }

      // Format available slots for response
      const slotsText = availability.slice(0, 3).map(slot => {
        if (calendarProvider === 'internal') {
          const date = new Date(slot.date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          const time = slot.start_time;
          return `${dayName} ${date.toLocaleDateString()} at ${time}`;
        } else {
          // Cal.com format
          const start = new Date(slot.start);
          const dayName = start.toLocaleDateString('en-US', { weekday: 'long' });
          const time = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          return `${dayName} ${start.toLocaleDateString()} at ${time}`;
        }
      }).join(', ');

      // Store calendar provider in conversation for later use
      conversation.calendarProvider = calendarProvider;
      conversation.availableSlots = availability;

      return `Great! I'd be happy to help you schedule a ${bookingIntent.type}. I have several available slots: ${slotsText}. Which date and time works best for you? Please let me know your preferred option and I'll book it for you right away.`;

    } catch (error) {
      logger.error('Error handling booking request', {
        callId,
        agentId: agent.id,
        error: error.message
      });

      return "I'm having trouble checking my availability right now. Let me take your information and I'll call you back to schedule your appointment. Could you please provide your name and phone number?";
    }
  }

  /**
   * Process booking confirmation
   */
  async processBookingConfirmation(callId, userInput, agent, conversation) {
    try {
      // Extract date and time from user input
      const dateTimeMatch = userInput.match(/(\w+day|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}).*?(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))/i);
      
      if (!dateTimeMatch) {
        return "I didn't catch the date and time clearly. Could you please tell me again which date and time you'd prefer? For example, you could say 'Monday at 2 PM' or 'tomorrow at 10 AM'.";
      }

      // Find matching slot
      const availability = await calendarService.getNextAvailableSlots(agent.id, 10);
      const selectedSlot = availability.find(slot => {
        const slotDate = new Date(slot.date);
        const slotTime = slot.start_time;
        // Simple matching logic - can be enhanced
        return userInput.toLowerCase().includes(slotDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()) ||
               userInput.includes(slot.date) ||
               userInput.includes(slotTime);
      });

      if (!selectedSlot) {
        return "I couldn't find that exact time slot. Let me give you the available options again: [list available slots]. Which one would you prefer?";
      }

      // Book the slot
      const bookingResult = await calendarService.bookSlot(agent.id, selectedSlot.id, {
        callId,
        customerName: conversation.customerName || 'Customer',
        customerPhone: conversation.customerPhone,
        serviceType: 'consultation'
      });

      if (bookingResult.success) {
        return `Perfect! I've booked your appointment for ${selectedSlot.date} at ${selectedSlot.start_time}. You'll receive a confirmation shortly. Is there anything else I can help you with today?`;
      } else {
        return "I'm sorry, that slot was just taken by someone else. Let me show you the current available times: [list available slots]. Which one works for you?";
      }

    } catch (error) {
      logger.error('Error processing booking confirmation', {
        callId,
        agentId: agent.id,
        error: error.message
      });

      return "I'm having trouble processing your booking right now. Let me take your information and I'll call you back to confirm your appointment. Could you please provide your name and phone number?";
    }
  }
}

// Create singleton instance
const dynamicAIService = new DynamicAIService();

module.exports = dynamicAIService;
