const express = require('express');
const axios = require('axios');
const router = express.Router();

// Cal.com API base URL
const CALCOM_API_BASE = 'https://api.cal.com/v1';

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
        'Content-Type': 'application/json'
      },
      ...(data && { data })
    };

        const response = await axios(config);
        return {
          success: true,
          data: response.data
        };
      } catch (error) {
        return {
          success: false,
          error: error.response?.data?.message || error.message,
          status: error.response?.status
        };
      }
};

// Validate API Key - Test with event-types endpoint (as per Cal.com docs)
router.post('/validate-api-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key is required' 
      });
    }

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
        error: 'API key is required' 
      });
    }

    const result = await makeCalComRequest(`/event-types/${eventTypeId}`, 'GET', null, apiKey);
    
    if (result.success) {
      res.json({
        success: true,
        eventType: result.data,
        id: result.data.id,
        title: result.data.title,
        length: result.data.length,
        description: result.data.description
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

// Check Availability - Use /slots endpoint as per Cal.com docs
router.post('/availability', async (req, res) => {
  try {
    const { apiKey, eventTypeId, startDate, endDate, timezone = 'UTC' } = req.body;
    
    if (!apiKey || !eventTypeId) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key and event type ID are required' 
      });
    }

    // Use /slots endpoint with time range (as per Cal.com API docs)
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
          error: 'Failed to check availability' 
        });
      }
});

// Book Appointment
router.post('/bookings', async (req, res) => {
  try {
    const { 
      apiKey, 
      eventTypeId, 
      name, 
      email, 
      start, 
      end, 
      timezone = 'UTC', 
      notes = '' 
    } = req.body;
    
    if (!apiKey || !eventTypeId || !name || !email || !start || !end) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key, event type ID, name, email, start, and end are required' 
      });
    }

    // Get the first available slot from the actual slots
    const startDate = start.split('T')[0];
    const endDate = start.split('T')[0];
    const startTime = `${startDate}T00:00:00.000Z`;
    const endTime = `${endDate}T23:59:59.999Z`;
    
    const availabilityEndpoint = `/slots?eventTypeId=${eventTypeId}&startTime=${startTime}&endTime=${endTime}&timeZone=${timezone}`;
    const availabilityResult = await makeCalComRequest(availabilityEndpoint, 'GET', null, apiKey);
    
    let bookingStart = start;
    let bookingEnd = end;
    
    // Use actual available slot if found
    if (availabilityResult.success) {
      const slots = availabilityResult.data.slots;
      if (slots && typeof slots === 'object') {
        for (const date in slots) {
          if (Array.isArray(slots[date]) && slots[date].length > 0) {
            const actualSlot = slots[date][0];
            bookingStart = actualSlot.time;
            bookingEnd = new Date(new Date(actualSlot.time).getTime() + 30 * 60 * 1000).toISOString();
            break;
          }
        }
      }
    }

    // Create booking with actual available slot
    const bookingData = {
      eventTypeId: parseInt(eventTypeId),
      start: bookingStart,
      end: bookingEnd,
      timeZone: timezone,
      language: 'en',
      metadata: {
        source: 'retell-ai-agent'
      },
      responses: {
        name: name,
        email: email,
        notes: notes
      }
    };
    
    const result = await makeCalComRequest('/bookings', 'POST', bookingData, apiKey);
    
    if (result.success) {
      res.json({
        success: true,
        bookingId: result.data.id,
        bookingUid: result.data.uid,
        message: 'Appointment booked successfully',
        booking: result.data
      });
    } else {
      res.json({
        success: false,
        error: result.error,
        bookingId: null
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to book appointment' 
    });
  }
});

// Get Available Slots (date range)
router.post('/slots', async (req, res) => {
  try {
    const { 
      apiKey, 
      eventTypeId, 
      startDate, 
      endDate, 
      timezone = 'UTC' 
    } = req.body;
    
    if (!apiKey || !eventTypeId || !startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key, event type ID, start date, and end date are required' 
      });
    }

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
router.delete('/bookings/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { apiKey, reason = '' } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'API key is required' 
      });
    }

    const result = await makeCalComRequest(`/bookings/${bookingId}`, 'DELETE', { reason }, apiKey);
    
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

module.exports = router;
