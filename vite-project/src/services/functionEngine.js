// Function execution engine for AI agents
import calComService from './calcom';

class FunctionEngine {
  constructor() {
    this.functions = new Map();
    this.registerDefaultFunctions();
  }

  // Register default functions
  registerDefaultFunctions() {
    this.functions.set('end_call', {
      name: 'end_call',
      description: 'End the current call when user wants to end the conversation',
      execute: this.endCall.bind(this)
    });

    this.functions.set('check_availability', {
      name: 'check_availability',
      description: 'Check calendar availability for booking appointments',
      execute: this.checkAvailability.bind(this)
    });

    this.functions.set('book_appointment', {
      name: 'book_appointment',
      description: 'Book an appointment on the calendar',
      execute: this.bookAppointment.bind(this)
    });

    this.functions.set('send_sms', {
      name: 'send_sms',
      description: 'Send SMS message to user',
      execute: this.sendSMS.bind(this)
    });
  }

  // Execute a function by name
  async executeFunction(functionName, config = {}, params = {}) {
    const func = this.functions.get(functionName);
    
    if (!func) {
      throw new Error(`Function '${functionName}' not found`);
    }

    try {
      const result = await func.execute(config, params);
      return {
        success: true,
        functionName,
        result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        functionName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Parse function calls from AI prompt response
  parseFunctionCalls(text) {
    const functionCallRegex = /(\w+)\(([^)]*)\)/g;
    const calls = [];
    let match;

    while ((match = functionCallRegex.exec(text)) !== null) {
      const functionName = match[1];
      const paramsString = match[2].trim();
      
      let params = {};
      if (paramsString) {
        try {
          // Try to parse as JSON first
          params = JSON.parse(paramsString);
        } catch {
          // If not JSON, treat as simple string parameter
          params = { value: paramsString };
        }
      }

      calls.push({
        functionName,
        params,
        originalMatch: match[0]
      });
    }

    return calls;
  }

  // Default function implementations
  async endCall(config, params) {
    return {
      action: 'end_call',
      message: 'Call ended successfully',
      data: {
        reason: params.reason || 'User requested to end call',
        timestamp: new Date().toISOString()
      }
    };
  }

  async checkAvailability(config, params) {
    const { api_key, event_type_id, timezone } = config;
    
    if (!api_key || !event_type_id) {
      throw new Error('Missing required configuration: api_key and event_type_id');
    }

    const startDate = params.startDate || new Date().toISOString().split('T')[0];
    const endDate = params.endDate || startDate;
    
    const result = await calComService.checkAvailability(api_key, event_type_id, {
      startDate,
      endDate,
      timezone: timezone || 'UTC'
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to check availability');
    }

    return {
      action: 'check_availability',
      message: 'Availability checked successfully',
      data: {
        startDate,
        endDate,
        timezone,
        availableSlots: result.slots,
        totalSlots: Array.isArray(result.slots) ? result.slots.length : Object.keys(result.slots).length
      }
    };
  }

  async bookAppointment(config, params) {
    const { api_key, event_type_id, timezone } = config;
    
    if (!api_key || !event_type_id) {
      throw new Error('Missing required configuration: api_key and event_type_id');
    }

    const { name, email, start, end, notes } = params;
    
    if (!name || !email || !start || !end) {
      throw new Error('Missing required parameters: name, email, start, end');
    }

    const result = await calComService.bookAppointment(api_key, event_type_id, {
      name,
      email,
      start,
      end,
      timezone: timezone || 'UTC',
      notes: notes || ''
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to book appointment');
    }

    return {
      action: 'book_appointment',
      message: 'Appointment booked successfully',
      data: {
        bookingId: result.bookingId,
        bookingUid: result.bookingUid,
        name,
        email,
        start,
        end,
        timezone
      }
    };
  }

  async sendSMS(config, params) {
    const { api_key, from_number, message_template } = config;
    
    if (!api_key || !from_number) {
      throw new Error('Missing required configuration: api_key and from_number');
    }

    const { phone_number, message, variables = {} } = params;
    
    if (!phone_number || !message) {
      throw new Error('Missing required parameters: phone_number and message');
    }

    // Replace template variables
    let finalMessage = message_template || message;
    Object.entries(variables).forEach(([key, value]) => {
      finalMessage = finalMessage.replace(`{${key}}`, value);
    });

    // Here you would integrate with your SMS service (Twilio, etc.)
    // For now, return mock success
    return {
      action: 'send_sms',
      message: 'SMS sent successfully',
      data: {
        to: phone_number,
        from: from_number,
        message: finalMessage,
        messageId: `sms_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  // Execute custom function via HTTP
  async executeCustomFunction(config, params) {
    const { endpoint, method = 'POST', headers = {}, timeout = 120000 } = config;
    
    if (!endpoint) {
      throw new Error('Missing required configuration: endpoint');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(params),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      return {
        action: 'custom_function',
        message: 'Custom function executed successfully',
        data: result
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw new Error(`Custom function execution failed: ${error.message}`);
    }
  }

  // Get available functions
  getAvailableFunctions() {
    return Array.from(this.functions.values()).map(func => ({
      name: func.name,
      description: func.description
    }));
  }

  // Register a custom function
  registerFunction(name, description, executeFunction) {
    this.functions.set(name, {
      name,
      description,
      execute: executeFunction
    });
  }
}

export default new FunctionEngine();
