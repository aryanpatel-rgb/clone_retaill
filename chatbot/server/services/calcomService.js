const axios = require('axios');
const logger = require('./logger');

/**
 * Cal.com Service for Chatbot
 * Handles all Cal.com API interactions
 */

// Get user profile and timezone dynamically
const getUserProfile = async (apiKey) => {
  try {
    logger.info('🌐 Calling Cal.com /me API...');
    const response = await axios.get(`https://api.cal.com/v1/me?apiKey=${apiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    logger.info('✅ Cal.com user profile response:', {
      username: response.data.user.username,
      timezone: response.data.user.timeZone,
      email: response.data.user.email
    });
    return { success: true, user: response.data.user };
  } catch (error) {
    logger.error('❌ Cal.com user profile error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Get event type details (duration, settings, etc.) dynamically
const getEventTypeDetails = async (apiKey, eventId) => {
  try {
    logger.info(`🌐 Calling Cal.com /event-types/${eventId} API...`);
    const response = await axios.get(`https://api.cal.com/v1/event-types/${eventId}?apiKey=${apiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    logger.info('✅ Cal.com event type response:', {
      title: response.data.event_type.title,
      duration: response.data.event_type.length,
      timezone: response.data.event_type.timeZone
    });
    return { success: true, eventType: response.data.event_type };
  } catch (error) {
    logger.error('❌ Cal.com event type error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Get user's schedules (working hours) dynamically
const getUserSchedules = async (apiKey) => {
  try {
    logger.info('🌐 Calling Cal.com /schedules API...');
    const response = await axios.get(`https://api.cal.com/v1/schedules?apiKey=${apiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    logger.info('✅ Cal.com schedules response:', {
      schedulesCount: response.data.schedules.length,
      firstSchedule: response.data.schedules[0] ? {
        name: response.data.schedules[0].name,
        timezone: response.data.schedules[0].timeZone,
        availabilityCount: response.data.schedules[0].availability?.length || 0
      } : null
    });
    return { success: true, schedules: response.data.schedules };
  } catch (error) {
    logger.error('❌ Cal.com schedules error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Get available slots using Cal.com's slots API
const getAvailableSlots = async (apiKey, eventId, startTime, endTime) => {
  try {
    const response = await axios.get(`https://api.cal.com/v1/slots`, {
      params: {
        eventTypeId: parseInt(eventId),
        startTime,
        endTime,
        apiKey
      },
      headers: { 'Content-Type': 'application/json' }
    });
    return { success: true, slots: response.data };
  } catch (error) {
    logger.error('Cal.com slots error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Check availability using Cal.com's availability API
const checkAvailability = async (apiKey, eventId, username, date) => {
  try {
    const response = await axios.get(`https://api.cal.com/v1/availability`, {
      params: {
        eventTypeId: parseInt(eventId),
        dateFrom: `${date}T00:00:00.000Z`,
        dateTo: `${date}T23:59:59.999Z`,
        username: username,
        apiKey
      },
      headers: { 'Content-Type': 'application/json' }
    });

    return { success: true, data: response.data };
  } catch (error) {
    logger.error('Cal.com availability error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
};

// Dynamic booking function that gets all details from Cal.com APIs
const bookAppointment = async (apiKey, eventId, bookingData) => {
  try {
    logger.info('📅 Starting dynamic booking process...');
    
    // Get user profile for timezone
    logger.info('👤 Getting user profile for booking...');
    const userProfile = await getUserProfile(apiKey);
    if (!userProfile.success) {
      logger.error('❌ Failed to get user profile for booking');
      return { success: false, error: 'Failed to get user profile' };
    }

    // Get event type details for duration
    logger.info('📋 Getting event type details for booking...');
    const eventDetails = await getEventTypeDetails(apiKey, eventId);
    if (!eventDetails.success) {
      logger.error('❌ Failed to get event type details for booking');
      return { success: false, error: 'Failed to get event type details' };
    }

    // Convert time to proper format (handle both 14:00 and 2:00 PM formats)
    let time24 = bookingData.time;
    if (bookingData.time.includes('PM') || bookingData.time.includes('AM')) {
      const [time, period] = bookingData.time.split(' ');
      const [hours, minutes] = time.split(':');
      let hour24 = parseInt(hours);
      if (period === 'PM' && hour24 !== 12) hour24 += 12;
      if (period === 'AM' && hour24 === 12) hour24 = 0;
      time24 = `${hour24.toString().padStart(2, '0')}:${minutes || '00'}`;
    } else if (bookingData.time.includes('pm') || bookingData.time.includes('am')) {
      // Handle lowercase pm/am
      const [time, period] = bookingData.time.split(' ');
      const [hours, minutes] = time.split(':');
      let hour24 = parseInt(hours);
      if (period === 'pm' && hour24 !== 12) hour24 += 12;
      if (period === 'am' && hour24 === 12) hour24 = 0;
      time24 = `${hour24.toString().padStart(2, '0')}:${minutes || '00'}`;
    } else if (bookingData.time.includes(' ')) {
      // Handle cases like "3 pm" without colon
      const parts = bookingData.time.split(' ');
      const timePart = parts[0];
      const periodPart = parts[1];
      let hour24 = parseInt(timePart);
      if (periodPart && (periodPart.toLowerCase() === 'pm' || periodPart.toLowerCase() === 'p.m.')) {
        if (hour24 !== 12) hour24 += 12;
      } else if (periodPart && (periodPart.toLowerCase() === 'am' || periodPart.toLowerCase() === 'a.m.')) {
        if (hour24 === 12) hour24 = 0;
      }
      time24 = `${hour24.toString().padStart(2, '0')}:00`;
    }
    
    // Use dynamic duration from event type (default to 30 minutes if not available)
    const duration = eventDetails.eventType.length || 30;
    
    // Create the datetime string in the user's timezone
    const localDateTime = `${bookingData.date}T${time24}:00`;
    
    // Parse the time components
    const [year, month, day] = bookingData.date.split('-').map(Number);
    const [hours, minutes] = time24.split(':').map(Number);
    
    // Get timezone offset dynamically from user profile
    const userTimezone = userProfile.user.timeZone;
    logger.info(`🌍 User timezone: ${userTimezone}`);
    
    // Create UTC date directly from the local time components
    // For Asia/Calcutta (UTC+5:30), we need to subtract 5.5 hours to get UTC
    let timezoneOffsetHours = 0;
    
    // Handle common timezones
    if (userTimezone === 'Asia/Calcutta' || userTimezone === 'Asia/Kolkata') {
        timezoneOffsetHours = 5.5; // UTC+5:30
    } else if (userTimezone === 'America/New_York') {
        timezoneOffsetHours = -5; // UTC-5:00 (EST)
    } else if (userTimezone === 'America/Los_Angeles') {
        timezoneOffsetHours = -8; // UTC-8:00 (PST)
    } else if (userTimezone === 'Europe/London') {
        timezoneOffsetHours = 0; // UTC+0:00 (GMT)
    } else if (userTimezone === 'Europe/Paris') {
        timezoneOffsetHours = 1; // UTC+1:00 (CET)
    } else {
        logger.warn(`⚠️ Unknown timezone: ${userTimezone}, using default calculation`);
        timezoneOffsetHours = 0;
    }
    
    // Calculate UTC time by subtracting the timezone offset
    const utcHours = hours - timezoneOffsetHours;
    
    // Handle fractional hours (like 9.5 for 9:30)
    const utcHoursInt = Math.floor(utcHours);
    const utcMinutes = minutes + ((utcHours - utcHoursInt) * 60);
    
    // Create UTC date
    const utcStartDate = new Date(Date.UTC(year, month - 1, day, utcHoursInt, utcMinutes, 0));
    const utcEndDate = new Date(utcStartDate.getTime() + duration * 60 * 1000);
    
    const startUTC = utcStartDate.toISOString();
    const endUTC = utcEndDate.toISOString();
    
    logger.info(`🕐 Time conversion: ${bookingData.date} ${bookingData.time} (${userProfile.user.timeZone}) → ${startUTC} to ${endUTC}`);

    logger.info(`📅 Dynamic booking attempt - Start: ${startUTC}, End: ${endUTC}, Duration: ${duration}min`);

    const bookingPayload = {
      eventTypeId: parseInt(eventId),
      start: startUTC,
      end: endUTC,
      timeZone: userProfile.user.timeZone,
      language: userProfile.user.locale || 'en',
      metadata: {},
      responses: {
        name: bookingData.name,
        email: bookingData.email
      },
      title: bookingData.title || eventDetails.eventType.title || 'Appointment'
    };

    logger.info('🌐 Calling Cal.com /bookings API with payload:', bookingPayload);

    const response = await axios.post(
      `https://api.cal.com/v1/bookings?apiKey=${apiKey}`,
      bookingPayload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    logger.info('✅ Cal.com booking successful:', {
      bookingId: response.data.id,
      status: response.data.status
    });
    
    return { success: true, booking: response.data, confirmationId: response.data.id };
  } catch (error) {
    logger.error('❌ Cal.com booking error:', {
      error: error.response?.data || error.message,
      status: error.response?.status
    });
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      status: error.response?.status
    };
  }
};

module.exports = {
  getUserProfile,
  getEventTypeDetails,
  getUserSchedules,
  getAvailableSlots,
  checkAvailability,
  bookAppointment
};
