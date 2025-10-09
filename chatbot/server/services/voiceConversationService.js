const logger = require('./logger');
const { getUserProfile, getEventTypeDetails, checkAvailability, bookAppointment } = require('./calcomService');

/**
 * Voice Conversation Service
 * Handles AI conversation flow for voice calls
 */
class VoiceConversationService {
  constructor() {
    this.conversations = new Map();
    this.openai = null;
  }

  /**
   * Initialize with OpenAI
   */
  initialize(openai) {
    this.openai = openai;
  }

  /**
   * Start a new voice conversation
   */
  async startConversation(callId, agentPrompt, customerName, phoneNumber, calComApiKey = null, calComEventId = null) {
    const conversation = {
      callId,
      agentPrompt,
      customerName: customerName || 'Customer',
      phoneNumber,
      calComApiKey,
      calComEventId,
      messages: [],
      context: {
        hasName: false,
        hasEmail: false,
        hasPreferredTime: false,
        isBooking: false,
        currentStep: 'greeting'
      },
      startTime: new Date()
    };

    this.conversations.set(callId, conversation);
    logger.info('Voice conversation started', { callId, customerName });

    // Generate initial greeting
    return await this.generateResponse(callId, null, 'greeting');
  }

  /**
   * Process voice input and generate response
   */
  async processVoiceInput(callId, speechResult) {
    const conversation = this.conversations.get(callId);
    if (!conversation) {
      logger.error('Conversation not found', { callId });
      return this.generateErrorResponse();
    }

    // Add user message
    conversation.messages.push({
      role: 'user',
      content: speechResult,
      timestamp: new Date()
    });

    // Generate AI response
    return await this.generateResponse(callId, speechResult);
  }

  /**
   * Generate AI response
   */
  async generateResponse(callId, userInput = null, step = null) {
    const conversation = this.conversations.get(callId);
    if (!conversation) {
      return this.generateErrorResponse();
    }

    try {
      // Build conversation context
      const systemPrompt = this.buildSystemPrompt(conversation);
      const messages = this.buildMessages(conversation, userInput, step);

      // Get AI response
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const response = completion.choices[0].message.content;

      // Add assistant message
      conversation.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      // Update conversation context
      this.updateConversationContext(conversation, userInput, response);

      logger.info('Voice response generated', { callId, responseLength: response.length });

      return {
        success: true,
        response,
        context: conversation.context
      };

    } catch (error) {
      logger.error('Error generating voice response:', error);
      return this.generateErrorResponse();
    }
  }

  /**
   * Build system prompt for voice conversation
   */
  buildSystemPrompt(conversation) {
    const basePrompt = conversation.agentPrompt || `You are Anna, a friendly assistant from Textdrip. Help customers book appointments.`;

    const contextInfo = `
CONVERSATION CONTEXT:
- Customer Name: ${conversation.customerName}
- Phone: ${conversation.phoneNumber}
- Has provided name: ${conversation.context.hasName}
- Has provided email: ${conversation.context.hasEmail}
- Has preferred time: ${conversation.context.hasPreferredTime}
- Current step: ${conversation.context.currentStep}

VOICE CONVERSATION GUIDELINES:
- Keep responses concise and natural for voice
- Ask one question at a time
- Be friendly and professional
- Guide the conversation toward booking an appointment
- If customer provides specific time, use check_availability_cal function
- If customer confirms booking, use book_appointment_cal function

AVAILABLE FUNCTIONS:
- check_availability_cal(date, time) - Check if time slot is available
- book_appointment_cal(name, email, date, time, title) - Book appointment

${basePrompt}
`;

    return contextInfo;
  }

  /**
   * Build messages for OpenAI
   */
  buildMessages(conversation, userInput = null, step = null) {
    const messages = [];

    if (step === 'greeting') {
      messages.push({
        role: 'user',
        content: 'Start the conversation with a greeting'
      });
    } else if (userInput) {
      messages.push({
        role: 'user',
        content: userInput
      });
    }

    return messages;
  }

  /**
   * Update conversation context
   */
  updateConversationContext(conversation, userInput, response) {
    if (!userInput) return;

    const input = userInput.toLowerCase();

    // Detect if customer provided name
    if (!conversation.context.hasName && this.containsName(input)) {
      conversation.context.hasName = true;
    }

    // Detect if customer provided email
    if (!conversation.context.hasEmail && this.containsEmail(input)) {
      conversation.context.hasEmail = true;
    }

    // Detect if customer provided preferred time
    if (!conversation.context.hasPreferredTime && this.containsTime(input)) {
      conversation.context.hasPreferredTime = true;
      conversation.context.currentStep = 'availability_check';
    }

    // Detect booking confirmation
    if (this.isBookingConfirmation(input)) {
      conversation.context.isBooking = true;
      conversation.context.currentStep = 'booking';
    }
  }

  /**
   * Check if input contains name-like information
   */
  containsName(input) {
    const namePatterns = [
      /my name is (\w+)/i,
      /i'm (\w+)/i,
      /this is (\w+)/i,
      /call me (\w+)/i
    ];
    return namePatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check if input contains email
   */
  containsEmail(input) {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    return emailPattern.test(input);
  }

  /**
   * Check if input contains time information
   */
  containsTime(input) {
    const timePatterns = [
      /tomorrow/i,
      /today/i,
      /\d{1,2}:\d{2}/,
      /\d{1,2}\s*(am|pm)/i,
      /morning/i,
      /afternoon/i,
      /evening/i
    ];
    return timePatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check if input is booking confirmation
   */
  isBookingConfirmation(input) {
    const confirmationPatterns = [
      /yes/i,
      /book it/i,
      /confirm/i,
      /proceed/i,
      /go ahead/i,
      /that works/i
    ];
    return confirmationPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Execute Cal.com function for voice calls
   */
  async executeCalComFunction(functionName, args, apiKey, eventId) {
    try {
      switch (functionName) {
        case 'check_availability_cal':
          return await this.checkAvailability(args, apiKey, eventId);
        
        case 'book_appointment_cal':
          return await this.bookAppointment(args, apiKey, eventId);
        
        default:
          return { success: false, message: `Unknown function: ${functionName}` };
      }
    } catch (error) {
      logger.error('Error executing Cal.com function:', error);
      return { success: false, message: 'Error executing function' };
    }
  }

  /**
   * Check availability for voice calls
   */
  async checkAvailability(args, apiKey, eventId) {
    try {
      const { date, time } = args;
      
      // Get user profile
      const userProfile = await getUserProfile(apiKey);
      if (!userProfile.success) {
        return { success: false, message: 'Unable to get user profile' };
      }

      // Check availability
      const availabilityResult = await checkAvailability(apiKey, eventId, userProfile.user.username, date);
      
      if (availabilityResult.success) {
        return {
          success: true,
          message: `Great! ${date} at ${time || 'your preferred time'} is available. Would you like me to book this appointment for you?`
        };
      } else {
        return {
          success: false,
          message: `I'm sorry, but ${date} at ${time || 'that time'} is not available. Would you like to try a different time?`
        };
      }
    } catch (error) {
      logger.error('Error checking availability:', error);
      return { success: false, message: 'Error checking availability' };
    }
  }

  /**
   * Book appointment for voice calls
   */
  async bookAppointment(args, apiKey, eventId) {
    try {
      const bookingResult = await bookAppointment(apiKey, eventId, args);
      
      if (bookingResult.success) {
        return {
          success: true,
          message: `Perfect! Your appointment has been booked for ${args.date} at ${args.time}. Confirmation ID: ${bookingResult.confirmationId}. You will receive an email confirmation shortly.`
        };
      } else {
        return {
          success: false,
          message: `I apologize, but there was an issue booking your appointment: ${bookingResult.error}. Please try a different time.`
        };
      }
    } catch (error) {
      logger.error('Error booking appointment:', error);
      return { success: false, message: 'Error booking appointment' };
    }
  }

  /**
   * End conversation
   */
  endConversation(callId) {
    const conversation = this.conversations.get(callId);
    if (conversation) {
      conversation.endTime = new Date();
      conversation.duration = conversation.endTime - conversation.startTime;
      
      logger.info('Voice conversation ended', {
        callId,
        duration: conversation.duration,
        messagesCount: conversation.messages.length
      });
      
      this.conversations.delete(callId);
    }
  }

  /**
   * Generate error response
   */
  generateErrorResponse() {
    return {
      success: false,
      response: 'I apologize, but I\'m having trouble processing your request right now. Please try again or call back later.',
      context: null
    };
  }

  /**
   * Get conversation data
   */
  getConversation(callId) {
    return this.conversations.get(callId);
  }

  /**
   * Get all active conversations
   */
  getActiveConversations() {
    return Array.from(this.conversations.values());
  }
}

module.exports = new VoiceConversationService();
