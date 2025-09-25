/**
 * Function Registry Service
 * Maps function names to actual implementations (like Retell AI)
 */

const config = require('../config/config');
const logger = require('../utils/logger');
const calComIntegrationService = require('./externalCalendarService');
const calendarService = require('./calendarService');

class FunctionRegistry {
  constructor() {
    this.functions = new Map();
    this._registerDefaultFunctions();
  }

  /**
   * Register default functions
   */
  _registerDefaultFunctions() {
    // Calendar functions
    this.registerFunction('check_availability_cal', this.checkAvailabilityCal.bind(this));
    this.registerFunction('book_appointment_cal', this.bookAppointmentCal.bind(this));
    
    // Internal calendar functions (fallback)
    this.registerFunction('check_availability', this.checkAvailability.bind(this));
    this.registerFunction('book_appointment', this.bookAppointment.bind(this));
    
    // Utility functions
    this.registerFunction('get_current_time', this.getCurrentTime.bind(this));
    this.registerFunction('format_date', this.formatDate.bind(this));
  }

  /**
   * Register a function
   */
  registerFunction(name, implementation) {
    this.functions.set(name, implementation);
    logger.info('Function registered', { functionName: name });
  }

  /**
   * Get a function by name
   */
  getFunction(name) {
    return this.functions.get(name);
  }

  /**
   * Check if function exists
   */
  hasFunction(name) {
    return this.functions.has(name);
  }

  /**
   * Get all available functions
   */
  getAllFunctions() {
    return Array.from(this.functions.keys());
  }

  /**
   * Execute a function
   */
  async executeFunction(name, args = {}, context = {}) {
    const func = this.getFunction(name);
    if (!func) {
      throw new Error(`Function '${name}' not found`);
    }

    try {
      logger.info('Executing function', { functionName: name, args });
      const result = await func(args, context);
      logger.info('Function executed successfully', { functionName: name, result });
      return result;
    } catch (error) {
      logger.error('Function execution failed', { functionName: name, error: error.message });
      throw error;
    }
  }

  // =============================================================================
  // CALENDAR FUNCTIONS
  // =============================================================================

  /**
   * Check availability using Cal.com
   */
  async checkAvailabilityCal(args, context) {
    const { date, time, eventTypeId, agentId } = args;
    
    try {
      // Try Cal.com first
      if (calComIntegrationService.isCalComReady() && eventTypeId) {
        const startDate = new Date(`${date}T${time || '00:00:00'}`);
        const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // Next 24 hours
        
        const result = await calComIntegrationService.getAvailableSlots(
          eventTypeId,
          startDate.toISOString(),
          endDate.toISOString(),
          30
        );

        if (result.success && result.slots.length > 0) {
          return {
            success: true,
            available: true,
            slots: result.slots.slice(0, 5),
            provider: 'calcom'
          };
        }
      }

      // Fallback to internal calendar
      if (agentId) {
        const availability = await calendarService.getNextAvailableSlots(agentId, 5);
        return {
          success: true,
          available: availability.length > 0,
          slots: availability,
          provider: 'internal'
        };
      }

      return {
        success: false,
        available: false,
        error: 'No calendar configured'
      };
    } catch (error) {
      logger.error('Error checking availability', { error: error.message });
      return {
        success: false,
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Book appointment using Cal.com
   */
  async bookAppointmentCal(args, context) {
    const { 
      eventTypeId, 
      customerName, 
      customerEmail, 
      customerPhone, 
      startTime, 
      endTime, 
      title,
      agentId 
    } = args;

    try {
      // Try Cal.com first
      if (calComIntegrationService.isCalComReady() && eventTypeId) {
        const bookingData = {
          customerName,
          customerEmail,
          customerPhone,
          startTime,
          endTime,
          callId: context.callId
        };

        const result = await calComIntegrationService.createBooking(eventTypeId, bookingData);
        
        if (result.success) {
          return {
            success: true,
            bookingId: result.bookingId,
            provider: 'calcom',
            message: 'Appointment booked successfully in Cal.com'
          };
        }
      }

      // Fallback to internal calendar
      if (agentId && startTime) {
        const bookingData = {
          agentId,
          customerName,
          customerEmail,
          customerPhone,
          startTime: new Date(startTime),
          endTime: new Date(endTime || new Date(new Date(startTime).getTime() + 30 * 60 * 1000)),
          title: title || `Appointment with ${customerName}`
        };

        const result = await calendarService.bookSlot(bookingData);
        
        if (result.success) {
          return {
            success: true,
            bookingId: result.bookingId,
            provider: 'internal',
            message: 'Appointment booked successfully in internal calendar'
          };
        }
      }

      return {
        success: false,
        error: 'Unable to book appointment - no calendar configured'
      };
    } catch (error) {
      logger.error('Error booking appointment', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check availability using internal calendar
   */
  async checkAvailability(args, context) {
    const { agentId, date, time } = args;
    
    if (!agentId) {
      return {
        success: false,
        available: false,
        error: 'Agent ID required'
      };
    }

    try {
      const availability = await calendarService.getNextAvailableSlots(agentId, 5);
      return {
        success: true,
        available: availability.length > 0,
        slots: availability,
        provider: 'internal'
      };
    } catch (error) {
      logger.error('Error checking internal availability', { error: error.message });
      return {
        success: false,
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Book appointment using internal calendar
   */
  async bookAppointment(args, context) {
    const { agentId, customerName, customerEmail, customerPhone, startTime, endTime, title } = args;
    
    if (!agentId) {
      return {
        success: false,
        error: 'Agent ID required'
      };
    }

    try {
      const bookingData = {
        agentId,
        customerName,
        customerEmail,
        customerPhone,
        startTime: new Date(startTime),
        endTime: new Date(endTime || new Date(new Date(startTime).getTime() + 30 * 60 * 1000)),
        title: title || `Appointment with ${customerName}`
      };

      const result = await calendarService.bookSlot(bookingData);
      
      if (result.success) {
        return {
          success: true,
          bookingId: result.bookingId,
          provider: 'internal',
          message: 'Appointment booked successfully'
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to book appointment'
        };
      }
    } catch (error) {
      logger.error('Error booking internal appointment', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  /**
   * Get current time
   */
  async getCurrentTime(args, context) {
    const now = new Date();
    return {
      success: true,
      time: now.toISOString(),
      formatted: now.toLocaleString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Format date
   */
  async formatDate(args, context) {
    const { date, format = 'long' } = args;
    
    if (!date) {
      return {
        success: false,
        error: 'Date required'
      };
    }

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

      return {
        success: true,
        formatted,
        original: date
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid date format'
      };
    }
  }
}

module.exports = new FunctionRegistry();
