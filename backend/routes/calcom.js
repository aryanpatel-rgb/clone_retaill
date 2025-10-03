const express = require('express');
const axios = require('axios');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');

// Cal.com API base URL
const CALCOM_API_BASE = 'https://api.cal.com/v1';

// Validation error handler middleware
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

// Cal.com validation rules
const validateApiKey = [
  body('apiKey')
    .trim()
    .isLength({ min: 1 })
    .withMessage('API key is required'),
  handleValidationErrors
];

const validateBooking = [
  body('apiKey')
    .trim()
    .isLength({ min: 1 })
    .withMessage('API key is required'),
  body('eventTypeId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Event type ID is required'),
  body('start')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Start time is required'),
  body('responses')
    .optional()
    .isObject()
    .withMessage('Responses must be an object'),
  handleValidationErrors
];

const validateSlots = [
  body('apiKey')
    .trim()
    .isLength({ min: 1 })
    .withMessage('API key is required'),
  body('eventTypeId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Event type ID is required'),
  body('startDate')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Start date is required'),
  body('endDate')
    .trim()
    .isLength({ min: 1 })
    .withMessage('End date is required'),
  handleValidationErrors
];

const validateBookingId = [
  param('bookingId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Booking ID is required'),
  handleValidationErrors
];

// Helper function to make Cal.com API requests
const makeCalComRequest = async (endpoint, method = 'GET', data = null, apiKey = null) => {
  try {
    // Add apiKey as query parameter (Cal.com format)
    let url = `${CALCOM_API_BASE}${endpoint}`;
    if (apiKey) {
      // Handle existing query parameters
      const separator = endpoint.includes('?') ? '&' : '?';
      url = `${url}${separator}apiKey=${apiKey}`;
    }
    
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Cal.com API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Cal.com API request failed'
    };
  }
};

// Validate API Key - Test with event-types endpoint (as per Cal.com docs)
router.post('/validate-api-key', validateApiKey, async (req, res) => {
  try {
    const { apiKey } = req.body;

    // Use event-types endpoint to validate API key (as shown in Cal.com docs)
    const result = await makeCalComRequest('/event-types', 'GET', null, apiKey);
    
    if (result.success) {
      res.json({
        success: true,
        eventTypes: result.data,
        user: Array.isArray(result.data) && result.data.length > 0 ? { id: 'user', name: 'Cal.com User' } : null,
        valid: true
      });
    } else {
      res.json({
        success: false,
        error: result.error,
        valid: false
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to validate API key' 
    });
  }
});

// Get Event Type Details
router.get('/event-types/:eventTypeId', async (req, res) => {
  try {
    const { eventTypeId } = req.params;
    const { apiKey } = req.query;
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key is required as query parameter' 
      });
    }

    const result = await makeCalComRequest(`/event-types/${eventTypeId}`, 'GET', null, apiKey);
    
    if (result.success) {
      res.json({
        success: true,
        eventType: result.data
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch event type' 
    });
  }
});

// Create Booking
router.post('/bookings', validateBooking, async (req, res) => {
  try {
    const { 
      apiKey, 
      eventTypeId, 
      start, 
      responses = {},
      timeZone = 'UTC',
      language = 'en'
    } = req.body;

    const bookingData = {
      eventTypeId,
      start,
      responses,
      timeZone,
      language
    };

    const result = await makeCalComRequest('/bookings', 'POST', bookingData, apiKey);
    
    if (result.success) {
      res.json({
        success: true,
        booking: result.data,
        message: 'Booking created successfully'
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create booking' 
    });
  }
});

// Get Available Slots (date range)
router.post('/slots', validateSlots, async (req, res) => {
  try {
    const { 
      apiKey, 
      eventTypeId, 
      startDate, 
      endDate, 
      timezone = 'UTC' 
    } = req.body;

    const startTime = `${startDate}T00:00:00.000Z`;
    const endTime = `${endDate}T23:59:59.999Z`;
    const endpoint = `/slots?eventTypeId=${eventTypeId}&startTime=${startTime}&endTime=${endTime}&timeZone=${timezone}`;
    const result = await makeCalComRequest(endpoint, 'GET', null, apiKey);
    
    if (result.success) {
      res.json({
        success: true,
        slots: result.data.slots || [],
        timezone: timezone
      });
    } else {
      res.json({
        success: false,
        error: result.error,
        slots: []
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch slots' 
    });
  }
});

// Cancel Booking
router.delete('/bookings/:bookingId', validateBookingId, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key is required' 
      });
    }

    const result = await makeCalComRequest(`/bookings/${bookingId}`, 'DELETE', null, apiKey);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Booking cancelled successfully'
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel booking' 
    });
  }
});

// Get Booking Details
router.get('/bookings/:bookingId', validateBookingId, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { apiKey } = req.query;
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key is required as query parameter' 
      });
    }

    const result = await makeCalComRequest(`/bookings/${bookingId}`, 'GET', null, apiKey);
    
    if (result.success) {
      res.json({
        success: true,
        booking: result.data
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch booking' 
    });
  }
});

// Health check for Cal.com integration
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'calcom-integration',
    timestamp: new Date().toISOString(),
    endpoints: {
      'validate-api-key': 'POST /api/calcom/validate-api-key',
      'event-types': 'GET /api/calcom/event-types/:eventTypeId',
      'bookings': 'POST /api/calcom/bookings',
      'slots': 'POST /api/calcom/slots',
      'cancel-booking': 'DELETE /api/calcom/bookings/:bookingId',
      'get-booking': 'GET /api/calcom/bookings/:bookingId'
    }
  });
});

module.exports = router;
