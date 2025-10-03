/**
 * Cal.com Booking Service
 * Handles appointment booking and management with Cal.com integration
 */

const { executeQuery } = require('../database/connection');
const externalCalendarService = require('./externalCalendarService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class CalComBookingService {
  constructor() {
    this.calComService = externalCalendarService;
  }

  /**
   * Create a new appointment booking
   */
  async createBooking(bookingData) {
    try {
      const {
        agentId,
        customerName,
        customerEmail,
        customerPhone,
        startTime,
        endTime,
        eventTypeId,
        callId,
        notes
      } = bookingData;

      logger.info('Creating appointment booking', {
        agentId,
        customerName,
        customerEmail,
        startTime,
        eventTypeId
      });

      // Create booking record in our database first
      const bookingId = uuidv4();
      const internalBooking = await executeQuery(`
        INSERT INTO appointment_bookings (
          id, agent_id, customer_name, customer_email, customer_phone,
          start_time, end_time, provider, event_type_id, notes, call_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        bookingId,
        agentId,
        customerName,
        customerEmail || null,
        customerPhone || null,
        startTime,
        endTime,
        'calcom',
        eventTypeId || null,
        notes || null,
        callId || null
      ]);

      // Try to create booking in Cal.com
      if (await this.calComService.isCalComReady() && eventTypeId) {
        try {
          const calComBookingData = {
            customerName,
            customerEmail: customerEmail || `${customerPhone}@example.com`,
            customerPhone: customerPhone || '',
            startTime,
            endTime,
            callId: bookingId
          };

          const calComResult = await this.calComService.createBooking(eventTypeId, calComBookingData);

          if (calComResult.success) {
            // Update our booking with Cal.com booking ID
            await executeQuery(`
              UPDATE appointment_bookings 
              SET booking_id = $1, status = 'confirmed'
              WHERE id = $2
            `, [calComResult.bookingId, bookingId]);

            logger.info('Cal.com booking created successfully', {
              bookingId,
              calComBookingId: calComResult.bookingId,
              customerEmail
            });

            return {
              success: true,
              bookingId: bookingId,
              calComBookingId: calComResult.bookingId,
              provider: 'calcom',
              message: 'Appointment booked successfully in Cal.com',
              booking: internalBooking.rows[0]
            };
          } else {
            // Cal.com booking failed, but we have internal record
            await executeQuery(`
              UPDATE appointment_bookings 
              SET status = 'pending', notes = COALESCE(notes, '') || $1
              WHERE id = $2
            `, [`\nCal.com booking failed: ${calComResult.error}`, bookingId]);

            logger.warn('Cal.com booking failed, keeping internal record', {
              bookingId,
              error: calComResult.error
            });

            return {
              success: true,
              bookingId: bookingId,
              provider: 'internal',
              message: 'Appointment saved internally (Cal.com booking failed)',
              warning: calComResult.error,
              booking: internalBooking.rows[0]
            };
          }
        } catch (calComError) {
          logger.error('Cal.com booking error', {
            bookingId,
            error: calComError.message
          });

          // Update status to indicate Cal.com error
          await executeQuery(`
            UPDATE appointment_bookings 
            SET status = 'error', notes = COALESCE(notes, '') || $1
            WHERE id = $2
          `, [`\nCal.com error: ${calComError.message}`, bookingId]);

          return {
            success: true,
            bookingId: bookingId,
            provider: 'internal',
            message: 'Appointment saved internally (Cal.com unavailable)',
            warning: calComError.message,
            booking: internalBooking.rows[0]
          };
        }
      } else {
        // No Cal.com integration, just internal booking
        logger.info('Cal.com not configured, creating internal booking only', {
          bookingId,
          agentId
        });

        return {
          success: true,
          bookingId: bookingId,
          provider: 'internal',
          message: 'Appointment saved internally (Cal.com not configured)',
          booking: internalBooking.rows[0]
        };
      }
    } catch (error) {
      logger.error('Error creating appointment booking', {
        error: error.message,
        bookingData
      });

      return {
        success: false,
        error: `Failed to create booking: ${error.message}`
      };
    }
  }

  /**
   * Get available time slots
   */
  async getAvailableSlots(agentId, eventTypeId, date, duration = 30) {
    try {
      logger.info('Getting available slots', {
        agentId,
        eventTypeId,
        date,
        duration
      });

      // Check cache first
      const cachedSlots = await this.getCachedSlots(agentId, eventTypeId, date);
      if (cachedSlots) {
        logger.info('Returning cached slots', {
          agentId,
          date,
          slotsCount: cachedSlots.length
        });
        return {
          success: true,
          slots: cachedSlots,
          cached: true
        };
      }

      // Get fresh slots from Cal.com
      if (await this.calComService.isCalComReady() && eventTypeId) {
        const startDate = new Date(date);
        const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

        const slotsResult = await this.calComService.getAvailableSlots(
          eventTypeId,
          startDate.toISOString(),
          endDate.toISOString(),
          duration
        );

        if (slotsResult.success) {
          const slots = slotsResult.slots || [];
          
          // Cache the results
          await this.cacheSlots(agentId, eventTypeId, date, slots);

          logger.info('Retrieved slots from Cal.com', {
            agentId,
            date,
            slotsCount: slots.length
          });

          return {
            success: true,
            slots: slots,
            provider: 'calcom',
            cached: false
          };
        } else {
          logger.warn('Cal.com slots retrieval failed', {
            error: slotsResult.error,
            eventTypeId,
            date
          });
        }
      }

      // Fallback to internal calendar
      const calendarService = require('./calendarService');
      const internalSlots = await calendarService.getNextAvailableSlots(agentId, 20);

      return {
        success: true,
        slots: internalSlots,
        provider: 'internal',
        cached: false
      };

    } catch (error) {
      logger.error('Error getting available slots', {
        error: error.message,
        agentId,
        eventTypeId,
        date
      });

      return {
        success: false,
        error: `Failed to get slots: ${error.message}`,
        slots: []
      };
    }
  }

  /**
   * Get booking by ID
   */
  async getBooking(bookingId) {
    try {
      const result = await executeQuery(`
        SELECT * FROM appointment_bookings WHERE id = $1
      `, [bookingId]);

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Booking not found'
        };
      }

      return {
        success: true,
        booking: result.rows[0]
      };
    } catch (error) {
      logger.error('Error getting booking', {
        error: error.message,
        bookingId
      });

      return {
        success: false,
        error: `Failed to get booking: ${error.message}`
      };
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId, reason = 'Cancelled by customer') {
    try {
      const booking = await this.getBooking(bookingId);
      if (!booking.success) {
        return booking;
      }

      const bookingData = booking.booking;

      // Cancel in Cal.com if it exists
      if (bookingData.booking_id && await this.calComService.isCalComReady()) {
        try {
          const calComResult = await this.calComService.cancelBooking(
            bookingData.booking_id,
            reason
          );

          if (calComResult.success) {
            logger.info('Cal.com booking cancelled successfully', {
              bookingId,
              calComBookingId: bookingData.booking_id
            });
          } else {
            logger.warn('Cal.com booking cancellation failed', {
              bookingId,
              calComBookingId: bookingData.booking_id,
              error: calComResult.error
            });
          }
        } catch (calComError) {
          logger.error('Cal.com cancellation error', {
            bookingId,
            error: calComError.message
          });
        }
      }

      // Update our database record
      await executeQuery(`
        UPDATE appointment_bookings 
        SET status = 'cancelled', notes = COALESCE(notes, '') || $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [`\nCancelled: ${reason}`, bookingId]);

      logger.info('Booking cancelled successfully', {
        bookingId,
        reason
      });

      return {
        success: true,
        message: 'Booking cancelled successfully'
      };
    } catch (error) {
      logger.error('Error cancelling booking', {
        error: error.message,
        bookingId
      });

      return {
        success: false,
        error: `Failed to cancel booking: ${error.message}`
      };
    }
  }

  /**
   * Get bookings for an agent
   */
  async getAgentBookings(agentId, startDate, endDate) {
    try {
      const result = await executeQuery(`
        SELECT * FROM appointment_bookings 
        WHERE agent_id = $1 
          AND start_time >= $2 
          AND start_time <= $3
        ORDER BY start_time ASC
      `, [agentId, startDate, endDate]);

      return {
        success: true,
        bookings: result.rows
      };
    } catch (error) {
      logger.error('Error getting agent bookings', {
        error: error.message,
        agentId
      });

      return {
        success: false,
        error: `Failed to get bookings: ${error.message}`,
        bookings: []
      };
    }
  }

  /**
   * Cache available slots for performance
   */
  async cacheSlots(agentId, eventTypeId, date, slots) {
    try {
      const cacheId = uuidv4();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await executeQuery(`
        INSERT INTO availability_cache (
          id, agent_id, event_type_id, date, cached_slots, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (agent_id, event_type_id, date) 
        DO UPDATE SET 
          cached_slots = $5,
          expires_at = $6,
          created_at = CURRENT_TIMESTAMP
      `, [cacheId, agentId, eventTypeId, date, JSON.stringify(slots), expiresAt]);

      logger.debug('Cached availability slots', {
        agentId,
        eventTypeId,
        date,
        slotsCount: slots.length,
        expiresAt
      });
    } catch (error) {
      logger.error('Error caching slots', {
        error: error.message,
        agentId,
        eventTypeId,
        date
      });
    }
  }

  /**
   * Get cached slots
   */
  async getCachedSlots(agentId, eventTypeId, date) {
    try {
      const result = await executeQuery(`
        SELECT cached_slots FROM availability_cache 
        WHERE agent_id = $1 
          AND event_type_id = $2 
          AND date = $3 
          AND expires_at > NOW()
        ORDER BY created_at DESC 
        LIMIT 1
      `, [agentId, eventTypeId, date]);

      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].cached_slots);
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached slots', {
        error: error.message,
        agentId,
        eventTypeId,
        date
      });
      return null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredCache() {
    try {
      const result = await executeQuery(`
        DELETE FROM availability_cache WHERE expires_at < NOW()
      `);

      logger.info('Cleaned up expired cache entries', {
        deletedCount: result.rowCount
      });

      return {
        success: true,
        deletedCount: result.rowCount
      };
    } catch (error) {
      logger.error('Error cleaning up cache', {
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new CalComBookingService();
