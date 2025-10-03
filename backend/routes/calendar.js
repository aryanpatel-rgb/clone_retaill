/**
 * Calendar Management Routes
 * Handles calendar integration, settings, and booking management
 */

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { executeQuery } = require('../database/connection');
const calComIntegrationService = require('../services/externalCalendarService');
const calendarService = require('../services/calendarService');
const logger = require('../utils/logger');
const config = require('../config/config');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Get Cal.com configuration status
 * GET /api/calendar/calcom/status
 */
router.get('/calcom/status', async (req, res) => {
  try {
    const validation = await calComIntegrationService.validateConfiguration();
    
    res.json({
      success: true,
      configured: await calComIntegrationService.isCalComReady(),
      valid: validation.valid,
      error: validation.error,
      eventTypesCount: validation.eventTypesCount
    });

  } catch (error) {
    logger.error('Error checking Cal.com status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to check Cal.com status'
    });
  }
});

/**
 * Get Cal.com event types
 * GET /api/calendar/calcom/event-types
 */
router.get('/calcom/event-types', async (req, res) => {
  try {
    const result = await calComIntegrationService.getEventTypes();
    
    if (result.success) {
      res.json({
        success: true,
        eventTypes: result.eventTypes
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error fetching Cal.com event types', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event types'
    });
  }
});

/**
 * Get available slots from Cal.com
 * GET /api/calendar/calcom/availability/:eventTypeId
 */
router.get('/calcom/availability/:eventTypeId', [
  param('eventTypeId').isInt().withMessage('Event Type ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const { eventTypeId } = req.params;
    const { startTime, endTime, duration = 30 } = req.query;

    // Default to next 7 days if no dates provided
    const defaultStartTime = new Date();
    const defaultEndTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await calComIntegrationService.getAvailableSlots(
      eventTypeId,
      startTime || defaultStartTime.toISOString(),
      endTime || defaultEndTime.toISOString(),
      duration
    );

    if (result.success) {
      res.json({
        success: true,
        slots: result.slots,
        provider: 'calcom'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error fetching Cal.com availability', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availability'
    });
  }
});

/**
 * Book appointment via Cal.com
 * POST /api/calendar/calcom/book
 */
router.post('/calcom/book', [
  body('eventTypeId').isInt().withMessage('Event Type ID is required and must be an integer'),
  body('customerName').notEmpty().withMessage('Customer name is required'),
  body('customerEmail').isEmail().withMessage('Valid customer email is required'),
  body('customerPhone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
  body('callId').optional().isString().withMessage('Call ID must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const bookingData = req.body;
    
    const result = await calComIntegrationService.createBooking(
      bookingData.eventTypeId,
      bookingData
    );

    if (result.success) {
      res.json({
        success: true,
        bookingId: result.bookingId,
        booking: result.booking,
        provider: 'calcom',
        message: 'Appointment booked successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error booking Cal.com appointment', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to book appointment'
    });
  }
});

/**
 * Cancel Cal.com booking
 * DELETE /api/calendar/calcom/booking/:bookingId
 */
router.delete('/calcom/booking/:bookingId', [
  param('bookingId').isInt().withMessage('Booking ID must be an integer'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const result = await calComIntegrationService.cancelBooking(bookingId, reason);

    if (result.success) {
      res.json({
        success: true,
        message: 'Booking cancelled successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error cancelling Cal.com booking', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

/**
 * Get internal calendar settings for agent
 * GET /api/calendar/internal/settings/:agentId
 */
router.get('/internal/settings/:agentId', [
  param('agentId').notEmpty().withMessage('Agent ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const settings = await calendarService.getAgentSettings(agentId);
    
    if (settings) {
      res.json({
        success: true,
        settings
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Agent settings not found'
      });
    }

  } catch (error) {
    logger.error('Error fetching internal calendar settings', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar settings'
    });
  }
});

/**
 * Update internal calendar settings for agent
 * PUT /api/calendar/internal/settings/:agentId
 */
router.put('/internal/settings/:agentId', [
  param('agentId').notEmpty().withMessage('Agent ID is required'),
  body('working_hours').optional().isObject().withMessage('Working hours must be an object'),
  body('slot_duration').optional().isInt({ min: 15, max: 480 }).withMessage('Slot duration must be between 15 and 480 minutes'),
  body('advance_booking_days').optional().isInt({ min: 1, max: 365 }).withMessage('Advance booking days must be between 1 and 365'),
  body('buffer_time').optional().isInt({ min: 0, max: 120 }).withMessage('Buffer time must be between 0 and 120 minutes'),
  body('timezone').optional().isString().withMessage('Timezone must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const { agentId } = req.params;
    const settings = req.body;
    
    const result = await calendarService.updateAgentSettings(agentId, settings);

    if (result.success) {
      res.json({
        success: true,
        settings: result.settings,
        message: 'Calendar settings updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error updating internal calendar settings', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update calendar settings'
    });
  }
});

/**
 * Get available slots from internal calendar
 * GET /api/calendar/internal/availability/:agentId
 */
router.get('/internal/availability/:agentId', [
  param('agentId').notEmpty().withMessage('Agent ID is required'),
  body('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], handleValidationErrors, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { limit = 5 } = req.body;
    
    const slots = await calendarService.getNextAvailableSlots(agentId, limit);

    res.json({
      success: true,
      slots,
      provider: 'internal'
    });

  } catch (error) {
    logger.error('Error fetching internal availability', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availability'
    });
  }
});

/**
 * Book appointment via internal calendar
 * POST /api/calendar/internal/book
 */
router.post('/internal/book', [
  body('agentId').notEmpty().withMessage('Agent ID is required'),
  body('customerName').notEmpty().withMessage('Customer name is required'),
  body('customerEmail').optional().isEmail().withMessage('Valid customer email is required'),
  body('customerPhone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').optional().isISO8601().withMessage('Valid end time is required'),
  body('title').optional().isString().withMessage('Title must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const bookingData = req.body;
    
    const result = await calendarService.bookSlot(bookingData);

    if (result.success) {
      res.json({
        success: true,
        bookingId: result.bookingId,
        provider: 'internal',
        message: 'Appointment booked successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Error booking internal appointment', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to book appointment'
    });
  }
});

/**
 * Get agent's bookings
 * GET /api/calendar/internal/bookings/:agentId
 */
router.get('/internal/bookings/:agentId', [
  param('agentId').notEmpty().withMessage('Agent ID is required'),
  body('startDate').optional().isISO8601().withMessage('Start date must be valid ISO 8601 date'),
  body('endDate').optional().isISO8601().withMessage('End date must be valid ISO 8601 date')
], handleValidationErrors, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.body;

    // Default to current month if no dates provided
    const defaultStartDate = new Date();
    defaultStartDate.setDate(1);
    const defaultEndDate = new Date();
    defaultEndDate.setMonth(defaultEndDate.getMonth() + 1);

    const bookings = await calendarService.getAgentBookings(
      agentId,
      startDate || defaultStartDate.toISOString(),
      endDate || defaultEndDate.toISOString()
    );

    res.json({
      success: true,
      bookings,
      provider: 'internal'
    });

  } catch (error) {
    logger.error('Error fetching agent bookings', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings'
    });
  }
});

module.exports = router;
