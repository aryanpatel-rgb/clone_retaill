/**
 * Dynamic AI Service for Dynamic AI Calling Platform
 * Handles AI conversations with custom prompts from users
 */

const config = require('../config/config');
const logger = require('../utils/logger');
const databaseService = require('./databaseService');
const llmService = require('./llmService');
// AI function calling
const aiFunctionService = require('./retellAIStyleService'); // Advanced AI function caller

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
      const agent = await databaseService.getAgentById(agentId);
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

      // Add user message to conversation
      conversation.messages.push({ role: 'user', content: userInput });
      this.conversations.set(callId, conversation);

      // Store in database
      await databaseService.addConversationMessage(callId, 'user', userInput);

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

      // Generate response using LLM service
      const response = await llmService.generateResponse(messages, {
        provider: agent.provider || 'openai',
        model: agent.model || config.get('openai.model'),
        temperature: agent.temperature || config.get('openai.temperature'),
        maxTokens: agent.max_tokens || config.get('openai.maxTokens'),
        timeout: 10000
      });

      if (!response || response.trim().length === 0) {
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
- Remember the context of the conversation`;

    return systemPrompt;
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
      const isCalComReady = calComIntegrationService.isCalComReady();

      if (isCalComReady && agent.calcom_event_type_id) {
        try {
          const startDate = new Date().toISOString();
          const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Next 7 days
          
          const result = await calComIntegrationService.getAvailableSlots(
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
