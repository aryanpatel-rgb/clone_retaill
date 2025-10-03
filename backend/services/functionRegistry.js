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
    const { date, time, eventTypeId, agentId, duration = 30 } = args;
    
    try {
      logger.info('Checking availability', { date, time, eventTypeId, agentId });
      
      // Try Cal.com first if configured
      if (await calComIntegrationService.isCalComReady() && eventTypeId) {
        // Parse the date and time
        const targetDate = new Date(date);
        const startTime = time ? new Date(`${date}T${time}`) : targetDate;
        const endTime = new Date(startTime.getTime() + (duration * 60 * 1000));
        
        // Get available slots from Cal.com for the specific date range
        const slotsResult = await calComIntegrationService.getAvailableSlots(
          eventTypeId,
          startTime.toISOString(),
          endTime.toISOString(),
          duration
        );
        
        if (slotsResult.success) {
          const availableSlots = slotsResult.slots || [];
          const isAvailable = availableSlots.length > 0;
          
          logger.info('Cal.com availability check result', {
            eventTypeId,
            date,
            time,
            availableSlots: availableSlots.length,
            isAvailable
          });
          
          return {
            success: true,
            available: isAvailable,
            date: date,
            time: time,
            slots: availableSlots,
            provider: 'calcom',
            message: isAvailable ? 
              `Found ${availableSlots.length} available slots` : 
              'No available slots found for this time'
          };
        } else {
          logger.warn('Cal.com availability check failed', { error: slotsResult.error });
        }
      }

      // Fallback to internal calendar if Cal.com fails or not configured
      if (agentId) {
        logger.info('Falling back to internal calendar', { agentId });
        const availability = await calendarService.getNextAvailableSlots(agentId, 10);
        
        return {
          success: true,
          available: availability.length > 0,
          slots: availability,
          provider: 'internal',
          message: availability.length > 0 ? 
            `Found ${availability.length} available slots` : 
            'No available slots found'
        };
      }

      return {
        success: false,
        available: false,
        error: 'No calendar configured. Please set up Cal.com integration or internal calendar.'
      };
    } catch (error) {
      logger.error('Error checking availability', { 
        error: error.message, 
        date, 
        time, 
        eventTypeId, 
        agentId 
      });
      return {
        success: false,
        available: false,
        error: `Availability check failed: ${error.message}`
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
      agentId,
      date,
      time,
      duration = 30
    } = args;

    try {
      logger.info('Booking appointment', { 
        eventTypeId, 
        customerName, 
        customerEmail, 
        startTime, 
        agentId 
      });

      // Try Cal.com first if configured
      if (await calComIntegrationService.isCalComReady() && eventTypeId) {
        // Prepare booking data for Cal.com
        const bookingData = {
          customerName: customerName || 'Customer',
          customerEmail: customerEmail || `${customerPhone}@example.com`,
          customerPhone: customerPhone || '',
          startTime: startTime || (date && time ? new Date(`${date}T${time}`).toISOString() : null),
          endTime: endTime || (startTime ? new Date(new Date(startTime).getTime() + duration * 60 * 1000).toISOString() : null),
          callId: context.callId || 'unknown'
        };

        logger.info('Creating Cal.com booking', { bookingData });

        const result = await calComIntegrationService.createBooking(eventTypeId, bookingData);
        
        if (result.success) {
          logger.info('Cal.com booking successful', { 
            bookingId: result.bookingId,
            eventTypeId,
            customerEmail: bookingData.customerEmail
          });

          return {
            success: true,
            bookingId: result.bookingId,
            provider: 'calcom',
            message: 'Appointment booked successfully in Cal.com calendar',
            booking: result.booking,
            confirmationDetails: {
              bookingId: result.bookingId,
              startTime: bookingData.startTime,
              customerName: bookingData.customerName,
              customerEmail: bookingData.customerEmail
            }
          };
        } else {
          logger.error('Cal.com booking failed', { error: result.error });
          // Fall through to internal calendar
        }
      }

      // Fallback to internal calendar
      if (agentId && (startTime || (date && time))) {
        logger.info('Falling back to internal calendar booking', { agentId });
        
        const bookingStartTime = startTime || new Date(`${date}T${time}`);
        const bookingEndTime = endTime || new Date(new Date(bookingStartTime).getTime() + duration * 60 * 1000);
        
        const bookingData = {
          agentId,
          customerName: customerName || 'Customer',
          customerEmail: customerEmail || `${customerPhone}@example.com`,
          customerPhone: customerPhone || '',
          startTime: new Date(bookingStartTime),
          endTime: new Date(bookingEndTime),
          title: title || `Appointment with ${customerName || 'Customer'}`,
          notes: `Booked via AI call: ${context.callId || 'unknown'}`
        };

        const result = await calendarService.bookSlot(bookingData);
        
        if (result.success) {
          logger.info('Internal calendar booking successful', { 
            bookingId: result.bookingId,
            agentId,
            customerEmail: bookingData.customerEmail
          });

          return {
            success: true,
            bookingId: result.bookingId,
            provider: 'internal',
            message: 'Appointment booked successfully in internal calendar',
            confirmationDetails: {
              bookingId: result.bookingId,
              startTime: bookingData.startTime.toISOString(),
              customerName: bookingData.customerName,
              customerEmail: bookingData.customerEmail
            }
          };
        } else {
          logger.error('Internal calendar booking failed', { error: result.error });
        }
      }

      return {
        success: false,
        error: 'Unable to book appointment - no calendar configured or booking failed'
      };
    } catch (error) {
      logger.error('Error booking appointment', { 
        error: error.message, 
        eventTypeId, 
        customerName, 
        agentId 
      });
      return {
        success: false,
        error: `Booking failed: ${error.message}`
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
