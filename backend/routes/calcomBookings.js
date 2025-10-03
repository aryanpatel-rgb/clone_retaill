/**
 * Cal.com Bookings Routes
 * API endpoints for managing Cal.com appointments
 */

const express = require('express');
const router = express.Router();
const calComBookingService = require('../services/calcomBookingService');
const externalCalendarService = require('../services/externalCalendarService');
const logger = require('../utils/logger');
const { body, param, query, validationResult } = require('express-validator');

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
 * Create a new booking
 * POST /api/calcom-bookings
 */
router.post('/', [
  body('agentId').trim().isLength({ min: 1 }).withMessage('Agent ID is required'),
  body('customerName').trim().isLength({ min: 1 }).withMessage('Customer name is required'),
  body('customerEmail').optional().isEmail().withMessage('Valid email is required'),
  body('customerPhone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
  body('eventTypeId').optional().trim().isLength({ min: 1 }),
  handleValidationErrors
], async (req, res) => {
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
    } = req.body;

    const bookingData = {
      agentId,
      customerName,
      customerEmail,
      customerPhone,
      startTime,
      endTime,
      eventTypeId,
      callId,
      notes
    };

    const result = await calComBookingService.createBooking(bookingData);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        booking: result.booking,
        bookingId: result.bookingId,
        provider: result.provider
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error creating booking', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create booking'
    });
  }
});

/**
 * Get available slots
 * GET /api/calcom-bookings/availability
 */
router.get('/availability', [
  query('agentId').trim().isLength({ min: 1 }).withMessage('Agent ID is required'),
  query('date').isISO8601().withMessage('Valid date is required'),
  query('eventTypeId').optional().trim().isLength({ min: 1 }),
  query('duration').optional().isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId, date, eventTypeId, duration = 30 } = req.query;

    const result = await calComBookingService.getAvailableSlots(
      agentId,
      eventTypeId,
      date,
      parseInt(duration)
    );

    if (result.success) {
      res.json({
        success: true,
        slots: result.slots,
        provider: result.provider,
        cached: result.cached || false
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error getting available slots', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get available slots'
    });
  }
});

/**
 * Get booking by ID
 * GET /api/calcom-bookings/:id
 */
router.get('/:id', [
  param('id').trim().isLength({ min: 1 }).withMessage('Booking ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    const result = await calComBookingService.getBooking(id);

    if (result.success) {
      res.json({
        success: true,
        booking: result.booking
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error getting booking', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get booking'
    });
  }
});

/**
 * Cancel a booking
 * DELETE /api/calcom-bookings/:id
 */
router.delete('/:id', [
  param('id').trim().isLength({ min: 1 }).withMessage('Booking ID is required'),
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason must be less than 500 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await calComBookingService.cancelBooking(id, reason);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error cancelling booking', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel booking'
    });
  }
});

/**
 * Get agent bookings
 * GET /api/calcom-bookings/agent/:agentId
 */
router.get('/agent/:agentId', [
  param('agentId').trim().isLength({ min: 1 }).withMessage('Agent ID is required'),
  query('startDate').optional().isISO8601().withMessage('Valid start date is required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;

    // Default to current month if no dates provided
    const defaultStartDate = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const defaultEndDate = endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();

    const result = await calComBookingService.getAgentBookings(
      agentId,
      defaultStartDate,
      defaultEndDate
    );

    if (result.success) {
      res.json({
        success: true,
        bookings: result.bookings
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error getting agent bookings', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get agent bookings'
    });
  }
});

/**
 * Get Cal.com event types
 * GET /api/calcom-bookings/event-types
 */
router.get('/event-types', async (req, res) => {
  try {
    const result = await externalCalendarService.getEventTypes();

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
    logger.error('Error getting event types', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get event types'
    });
  }
});

/**
 * Test Cal.com connection
 * GET /api/calcom-bookings/test-connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    const result = await externalCalendarService.validateConfiguration();

    if (result.valid) {
      res.json({
        success: true,
        message: 'Cal.com connection successful',
        eventTypesCount: result.eventTypesCount
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error testing Cal.com connection', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to test Cal.com connection'
    });
  }
});

/**
 * Clean up expired cache
 * POST /api/calcom-bookings/cleanup-cache
 */
router.post('/cleanup-cache', async (req, res) => {
  try {
    const result = await calComBookingService.cleanupExpiredCache();

    res.json({
      success: true,
      message: 'Cache cleanup completed',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('Error cleaning up cache', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to clean up cache'
    });
  }
});

module.exports = router;
