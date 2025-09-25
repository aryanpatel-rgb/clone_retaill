// Cal.com API integration service (via backend proxy)
class CalComService {
  constructor() {
    this.baseURL = 'http://localhost:5000/api/calcom';
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Cal.com API Error:', error);
      throw error;
    }
  }

  // Check availability for a specific event type
  async checkAvailability(apiKey, eventTypeId, params = {}) {
    const { startDate, endDate, timezone = 'UTC' } = params;
    
    try {
      const response = await this.request('/availability', {
        method: 'POST',
        body: {
          apiKey,
          eventTypeId,
          startDate,
          endDate,
          timezone
        }
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        slots: []
      };
    }
  }

  // Book an appointment
  async bookAppointment(apiKey, eventTypeId, bookingData) {
    const { name, email, start, end, timezone = 'UTC', notes = '' } = bookingData;
    
    try {
      const response = await this.request('/bookings', {
        method: 'POST',
        body: {
          apiKey,
          eventTypeId,
          name,
          email,
          start,
          end,
          timezone,
          notes
        }
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        bookingId: null
      };
    }
  }

  // Get event type details
  async getEventType(apiKey, eventTypeId) {
    try {
      const response = await this.request(`/event-types/${eventTypeId}?apiKey=${apiKey}`);

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        eventType: null
      };
    }
  }

  // List available time slots for a date range
  async getAvailableSlots(apiKey, eventTypeId, params = {}) {
    const { startDate, endDate, timezone = 'UTC' } = params;
    
    try {
      const response = await this.request('/slots', {
        method: 'POST',
        body: {
          apiKey,
          eventTypeId,
          startDate,
          endDate,
          timezone
        }
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        slots: []
      };
    }
  }

  // Cancel a booking
  async cancelBooking(apiKey, bookingId, reason = '') {
    try {
      const response = await this.request(`/bookings/${bookingId}`, {
        method: 'DELETE',
        body: {
          apiKey,
          reason
        }
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Validate API key
  async validateApiKey(apiKey) {
    try {
      const response = await this.request('/validate-api-key', {
        method: 'POST',
        body: {
          apiKey
        }
      });

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        valid: false
      };
    }
  }
}

export default new CalComService();
