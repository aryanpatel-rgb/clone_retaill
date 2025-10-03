/**
 * Internal Calendar Service
 * Handles internal calendar functionality for appointment management
 */

const { executeQuery } = require('../database/connection');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class CalendarService {
  constructor() {
    this.initializeTables();
  }

  /**
   * Initialize calendar tables if they don't exist
   */
  async initializeTables() {
    try {
      // Create calendar_slots table
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS calendar_slots (
          id VARCHAR(255) PRIMARY KEY,
          agent_id VARCHAR(255) NOT NULL,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          duration INTEGER DEFAULT 30,
          is_available BOOLEAN DEFAULT true,
          customer_name VARCHAR(255),
          customer_email VARCHAR(255),
          customer_phone VARCHAR(20),
          title VARCHAR(255),
          notes TEXT,
          status VARCHAR(50) DEFAULT 'available',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
        )
      `);

      // Create calendar_settings table
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS calendar_settings (
          id VARCHAR(255) PRIMARY KEY,
          agent_id VARCHAR(255) NOT NULL,
          working_hours JSONB DEFAULT '{"monday": {"start": "09:00", "end": "17:00", "enabled": true}, "tuesday": {"start": "09:00", "end": "17:00", "enabled": true}, "wednesday": {"start": "09:00", "end": "17:00", "enabled": true}, "thursday": {"start": "09:00", "end": "17:00", "enabled": true}, "friday": {"start": "09:00", "end": "17:00", "enabled": true}, "saturday": {"start": "10:00", "end": "14:00", "enabled": false}, "sunday": {"start": "10:00", "end": "14:00", "enabled": false}}',
          slot_duration INTEGER DEFAULT 30,
          advance_booking_days INTEGER DEFAULT 30,
          buffer_time INTEGER DEFAULT 15,
          timezone VARCHAR(50) DEFAULT 'UTC',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agent_id) REFERENCES agents(agent_id),
          UNIQUE(agent_id)
        )
      `);

      // Create indexes
      await executeQuery('CREATE INDEX IF NOT EXISTS idx_calendar_slots_agent_id ON calendar_slots(agent_id)');
      await executeQuery('CREATE INDEX IF NOT EXISTS idx_calendar_slots_start_time ON calendar_slots(start_time)');
      await executeQuery('CREATE INDEX IF NOT EXISTS idx_calendar_slots_status ON calendar_slots(status)');
      await executeQuery('CREATE INDEX IF NOT EXISTS idx_calendar_settings_agent_id ON calendar_settings(agent_id)');

      logger.info('Calendar tables initialized successfully');

    } catch (error) {
      logger.error('Error initializing calendar tables', { error: error.message });
    }
  }

  /**
   * Get next available slots for an agent
   */
  async getNextAvailableSlots(agentId, limit = 5) {
    try {
      const query = `
        SELECT 
          id,
          start_time,
          end_time,
          duration,
          title
        FROM calendar_slots 
        WHERE agent_id = $1 
          AND status = 'available' 
          AND start_time > NOW()
        ORDER BY start_time ASC
        LIMIT $2
      `;

      const result = await executeQuery(query, [agentId, limit]);
      
      const slots = result.rows.map(row => ({
        id: row.id,
        time: row.start_time,
        endTime: row.end_time,
        duration: row.duration,
        title: row.title,
        available: true
      }));

      logger.info('Retrieved available slots', {
        agentId,
        slotsCount: slots.length
      });

      return slots;

    } catch (error) {
      logger.error('Error getting available slots', {
        error: error.message,
        agentId
      });
      return [];
    }
  }

  /**
   * Book a slot
   */
  async bookSlot(bookingData) {
    try {
      const {
        agentId,
        customerName,
        customerEmail,
        customerPhone,
        startTime,
        endTime,
        title,
        notes
      } = bookingData;

      const slotId = uuidv4();

      // Check if slot is available
      const existingSlot = await executeQuery(`
        SELECT id FROM calendar_slots 
        WHERE agent_id = $1 
          AND start_time = $2 
          AND status = 'available'
      `, [agentId, startTime]);

      if (existingSlot.rows.length === 0) {
        return {
          success: false,
          error: 'Time slot not available'
        };
      }

      // Update the slot to booked status
      await executeQuery(`
        UPDATE calendar_slots 
        SET 
          status = 'booked',
          customer_name = $1,
          customer_email = $2,
          customer_phone = $3,
          title = $4,
          notes = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [customerName, customerEmail, customerPhone, title, notes, existingSlot.rows[0].id]);

      logger.info('Slot booked successfully', {
        slotId: existingSlot.rows[0].id,
        agentId,
        customerEmail,
        startTime
      });

      return {
        success: true,
        bookingId: existingSlot.rows[0].id,
        message: 'Appointment booked successfully'
      };

    } catch (error) {
      logger.error('Error booking slot', {
        error: error.message,
        agentId: bookingData.agentId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create available slots for an agent
   */
  async createAvailableSlots(agentId, date, duration = 30) {
    try {
      const startDate = new Date(date);
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

      // Get agent's working hours
      const settings = await this.getAgentSettings(agentId);
      const workingHours = settings.working_hours || {};

      const slots = [];
      const current = new Date(startDate);

      while (current < endDate) {
        const dayOfWeek = current.toLocaleDateString('en-US', { weekday: 'lowercase' });
        const daySettings = workingHours[dayOfWeek];

        if (daySettings && daySettings.enabled) {
          const [startHour, startMinute] = daySettings.start.split(':').map(Number);
          const [endHour, endMinute] = daySettings.end.split(':').map(Number);

          const workStart = new Date(current);
          workStart.setHours(startHour, startMinute, 0, 0);

          const workEnd = new Date(current);
          workEnd.setHours(endHour, endMinute, 0, 0);

          const slotStart = new Date(workStart);
          while (slotStart < workEnd) {
            const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
            
            if (slotEnd <= workEnd) {
              slots.push({
                id: uuidv4(),
                agent_id: agentId,
                start_time: slotStart.toISOString(),
                end_time: slotEnd.toISOString(),
                duration: duration,
                is_available: true,
                status: 'available'
              });
            }

            slotStart.setTime(slotStart.getTime() + duration * 60 * 1000);
          }
        }

        current.setDate(current.getDate() + 1);
      }

      // Insert slots into database
      for (const slot of slots) {
        await executeQuery(`
          INSERT INTO calendar_slots (
            id, agent_id, start_time, end_time, duration, 
            is_available, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO NOTHING
        `, [slot.id, slot.agent_id, slot.start_time, slot.end_time, slot.duration, slot.is_available, slot.status]);
      }

      logger.info('Created available slots', {
        agentId,
        date,
        slotsCount: slots.length
      });

      return {
        success: true,
        slotsCreated: slots.length
      };

    } catch (error) {
      logger.error('Error creating available slots', {
        error: error.message,
        agentId,
        date
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get agent calendar settings
   */
  async getAgentSettings(agentId) {
    try {
      const result = await executeQuery(`
        SELECT * FROM calendar_settings WHERE agent_id = $1
      `, [agentId]);

      if (result.rows.length === 0) {
        // Create default settings
        const defaultSettings = {
          id: uuidv4(),
          agent_id: agentId,
          working_hours: {
            monday: { start: '09:00', end: '17:00', enabled: true },
            tuesday: { start: '09:00', end: '17:00', enabled: true },
            wednesday: { start: '09:00', end: '17:00', enabled: true },
            thursday: { start: '09:00', end: '17:00', enabled: true },
            friday: { start: '09:00', end: '17:00', enabled: true },
            saturday: { start: '10:00', end: '14:00', enabled: false },
            sunday: { start: '10:00', end: '14:00', enabled: false }
          },
          slot_duration: 30,
          advance_booking_days: 30,
          buffer_time: 15,
          timezone: 'UTC'
        };

        await executeQuery(`
          INSERT INTO calendar_settings (
            id, agent_id, working_hours, slot_duration, 
            advance_booking_days, buffer_time, timezone
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          defaultSettings.id,
          defaultSettings.agent_id,
          JSON.stringify(defaultSettings.working_hours),
          defaultSettings.slot_duration,
          defaultSettings.advance_booking_days,
          defaultSettings.buffer_time,
          defaultSettings.timezone
        ]);

        return defaultSettings;
      }

      const settings = result.rows[0];
      settings.working_hours = JSON.parse(settings.working_hours);
      
      return settings;

    } catch (error) {
      logger.error('Error getting agent settings', {
        error: error.message,
        agentId
      });

      return null;
    }
  }

  /**
   * Update agent calendar settings
   */
  async updateAgentSettings(agentId, settings) {
    try {
      const result = await executeQuery(`
        UPDATE calendar_settings 
        SET 
          working_hours = $1,
          slot_duration = $2,
          advance_booking_days = $3,
          buffer_time = $4,
          timezone = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = $6
        RETURNING *
      `, [
        JSON.stringify(settings.working_hours),
        settings.slot_duration,
        settings.advance_booking_days,
        settings.buffer_time,
        settings.timezone,
        agentId
      ]);

      logger.info('Updated agent calendar settings', {
        agentId,
        settings
      });

      return {
        success: true,
        settings: result.rows[0]
      };

    } catch (error) {
      logger.error('Error updating agent settings', {
        error: error.message,
        agentId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get agent's bookings
   */
  async getAgentBookings(agentId, startDate, endDate) {
    try {
      const query = `
        SELECT 
          id,
          start_time,
          end_time,
          duration,
          customer_name,
          customer_email,
          customer_phone,
          title,
          notes,
          status,
          created_at
        FROM calendar_slots 
        WHERE agent_id = $1 
          AND start_time >= $2 
          AND start_time <= $3
          AND status = 'booked'
        ORDER BY start_time ASC
      `;

      const result = await executeQuery(query, [agentId, startDate, endDate]);
      
      return result.rows;

    } catch (error) {
      logger.error('Error getting agent bookings', {
        error: error.message,
        agentId
      });

      return [];
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId, reason = 'Cancelled by customer') {
    try {
      await executeQuery(`
        UPDATE calendar_slots 
        SET 
          status = 'cancelled',
          notes = COALESCE(notes, '') || $1,
          updated_at = CURRENT_TIMESTAMP
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
        error: error.message
      };
    }
  }
}

module.exports = new CalendarService();
