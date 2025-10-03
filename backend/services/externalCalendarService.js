/**
 * External Calendar Service - Cal.com Integration
 * Handles integration with Cal.com API for appointment booking
 */

const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const { executeQuery } = require('../database/connection');

class CalComIntegrationService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://api.cal.com/v1';
    this.webhookSecret = null;
    this.isReady = false;
    this.userCredentials = null;
  }

  /**
   * Load user credentials from database
   */
  async loadUserCredentials() {
    try {
      const result = await executeQuery(`
        SELECT settings FROM platform_settings WHERE id = 1
      `);

      if (result.rows.length > 0) {
        const settings = result.rows[0].settings;
        const calcomConfig = settings.integrations?.calcom;
        
        if (calcomConfig && calcomConfig.enabled && calcomConfig.apiKey) {
          this.userCredentials = {
            apiKey: calcomConfig.apiKey,
            webhookUrl: calcomConfig.webhookUrl || '',
            enabled: calcomConfig.enabled
          };
          this.isReady = true;
          
          logger.info('Cal.com user credentials loaded', {
            enabled: this.userCredentials.enabled,
            hasApiKey: !!this.userCredentials.apiKey
          });
        } else {
          this.isReady = false;
          this.userCredentials = null;
        }
      } else {
        this.isReady = false;
        this.userCredentials = null;
      }
    } catch (error) {
      logger.error('Error loading Cal.com user credentials', { error: error.message });
      this.isReady = false;
      this.userCredentials = null;
    }
  }

  /**
   * Check if Cal.com is properly configured
   */
  async isCalComReady() {
    if (!this.userCredentials) {
      await this.loadUserCredentials();
    }
    return this.isReady && this.userCredentials && this.userCredentials.enabled;
  }

  /**
   * Get available time slots from Cal.com using the correct /slots endpoint
   */
  async getAvailableSlots(eventTypeId, startTime, endTime, duration = 30) {
    try {
      if (!(await this.isCalComReady())) {
        throw new Error('Cal.com API key not configured or integration not enabled');
      }

      logger.info('Fetching available slots from Cal.com', {
        eventTypeId,
        startTime,
        endTime,
        duration
      });

      // Use the correct /slots endpoint as per Cal.com API documentation
      const response = await axios.get(
        `${this.baseUrl}/slots`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            apiKey: this.userCredentials.apiKey,
            eventTypeId: eventTypeId,
            startTime: startTime,
            endTime: endTime,
            duration: duration
          }
        }
      );

      const slots = this._processAvailabilityResponse(response.data);
      
      logger.info('Cal.com slots fetched successfully', {
        eventTypeId,
        slotsCount: slots.length
      });

      return {
        success: true,
        slots,
        provider: 'calcom'
      };

    } catch (error) {
      logger.error('Error fetching Cal.com availability', {
        error: error.message,
        eventTypeId,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        slots: []
      };
    }
  }

  /**
   * Create a booking in Cal.com
   */
  async createBooking(eventTypeId, bookingData) {
    try {
      if (!(await this.isCalComReady())) {
        throw new Error('Cal.com API key not configured or integration not enabled');
      }

      const { customerName, customerEmail, customerPhone, startTime, endTime, callId } = bookingData;

      logger.info('Creating Cal.com booking', {
        eventTypeId,
        customerEmail,
        startTime,
        callId
      });

      const bookingPayload = {
        eventTypeId: parseInt(eventTypeId),
        start: startTime,
        end: endTime,
        responses: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          notes: callId ? `Booked via AI call: ${callId}` : 'Booked via AI assistant'
        },
        timeZone: 'UTC',
        language: 'en',
        metadata: {},
        attendees: [
          {
            email: customerEmail,
            name: customerName
          }
        ]
      };

      const response = await axios.post(
        `${this.baseUrl}/bookings`,
        bookingPayload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          params: {
            apiKey: this.userCredentials.apiKey
          }
        }
      );

      const booking = response.data;

      logger.info('Cal.com booking created successfully', {
        bookingId: booking.id,
        eventTypeId,
        customerEmail
      });

      return {
        success: true,
        bookingId: booking.id,
        booking: booking,
        provider: 'calcom'
      };

    } catch (error) {
      logger.error('Error creating Cal.com booking', {
        error: error.message,
        eventTypeId,
        customerEmail: bookingData.customerEmail,
        status: error.response?.status,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get all event types for the user
   */
  async getAllEventTypes() {
    try {
      if (!(await this.isCalComReady())) {
        throw new Error('Cal.com API key not configured or integration not enabled');
      }

      const response = await axios.get(
        `${this.baseUrl}/event-types?apiKey=${this.userCredentials.apiKey}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        eventTypes: response.data
      };

    } catch (error) {
      logger.error('Error fetching all Cal.com event types', {
        error: error.message,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get event type details
   */
  async getEventType(eventTypeId) {
    try {
      if (!(await this.isCalComReady())) {
        throw new Error('Cal.com API key not configured or integration not enabled');
      }

      const response = await axios.get(
        `${this.baseUrl}/event-types/${eventTypeId}?apiKey=${this.userCredentials.apiKey}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        eventType: response.data
      };

    } catch (error) {
      logger.error('Error fetching Cal.com event type', {
        error: error.message,
        eventTypeId,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all event types for the user
   */
  async getEventTypes() {
    try {
      if (!(await this.isCalComReady())) {
        throw new Error('Cal.com API key not configured or integration not enabled');
      }

      const response = await axios.get(
        `${this.baseUrl}/event-types?apiKey=${this.userCredentials.apiKey}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        eventTypes: response.data.event_types || []
      };

    } catch (error) {
      logger.error('Error fetching Cal.com event types', {
        error: error.message,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        eventTypes: []
      };
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId, reason = 'Cancelled by AI assistant') {
    try {
      if (!(await this.isCalComReady())) {
        throw new Error('Cal.com API key not configured or integration not enabled');
      }

      const response = await axios.delete(
        `${this.baseUrl}/bookings/${bookingId}?apiKey=${this.userCredentials.apiKey}`,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          data: {
            reason
          }
        }
      );

      logger.info('Cal.com booking cancelled successfully', {
        bookingId,
        reason
      });

      return {
        success: true,
        message: 'Booking cancelled successfully'
      };

    } catch (error) {
      logger.error('Error cancelling Cal.com booking', {
        error: error.message,
        bookingId,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process availability response from Cal.com
   */
  _processAvailabilityResponse(data) {
    try {
      if (!data || !data.slots) {
        return [];
      }

      // Cal.com returns slots as an object with dates as keys
      if (typeof data.slots === 'object' && !Array.isArray(data.slots)) {
        const slots = [];
        Object.keys(data.slots).forEach(date => {
          const daySlots = data.slots[date];
          if (Array.isArray(daySlots)) {
            daySlots.forEach(slot => {
              slots.push({
                time: slot.time,
                available: true,
                duration: 30,
                date: date
              });
            });
          }
        });
        return slots;
      }

      // Handle array format
      if (Array.isArray(data.slots)) {
        return data.slots.map(slot => ({
          time: slot.time,
          available: slot.available !== false,
          duration: slot.duration || 30,
          date: slot.date,
          utc: slot.utc
        }));
      }

      return [];

    } catch (error) {
      logger.error('Error processing Cal.com availability response', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Update user credentials (called when settings are updated)
   */
  async updateCredentials(apiKey, webhookUrl = '', enabled = true) {
    try {
      this.userCredentials = {
        apiKey,
        webhookUrl,
        enabled
      };
      this.isReady = enabled && !!apiKey;
      
      logger.info('Cal.com credentials updated', {
        enabled: this.isReady,
        hasApiKey: !!apiKey
      });
      
      return this.isReady;
    } catch (error) {
      logger.error('Error updating Cal.com credentials', { error: error.message });
      return false;
    }
  }

  /**
   * Validate Cal.com configuration
   */
  async validateConfiguration() {
    try {
      if (!(await this.isCalComReady())) {
        return {
          valid: false,
          error: 'Cal.com API key not configured or integration not enabled'
        };
      }

      // Test API connection by fetching event types
      const result = await this.getEventTypes();
      
      if (result.success) {
        return {
          valid: true,
          eventTypesCount: result.eventTypes.length
        };
      } else {
        return {
          valid: false,
          error: result.error
        };
      }

    } catch (error) {
      logger.error('Error validating Cal.com configuration', {
        error: error.message
      });

      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = new CalComIntegrationService();
