const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Import services
const twilioService = require('./services/twilioService');
const voiceConversationService = require('./services/voiceConversationService');
const databaseService = require('./services/databaseService');
const logger = require('./services/logger');

// Import routes
const { router: authRouter, initializeAuthRoutes } = require('./routes/auth');

// Import middleware
const { verifyToken, optionalAuth } = require('./middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
});

// Initialize services
async function initializeServices() {
  try {
    // Initialize database service (optional - won't fail if not configured)
    if (process.env.DATABASE_URL) {
      try {
        await databaseService.initialize();
        logger.info('Database service initialized successfully');
      } catch (dbError) {
        logger.warn('Database initialization failed, continuing without database:', dbError.message);
      }
    } else {
      logger.warn('DATABASE_URL not configured, running without database');
    }
    
    // Initialize Twilio service
    await twilioService.initialize();
    
    // Initialize voice conversation service
    voiceConversationService.initialize(openai);
    
    logger.info('Core services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
  }
}

// Initialize services on startup
initializeServices();

// Initialize auth routes with database service
initializeAuthRoutes(databaseService);

// Date utilities
const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const parseDateInput = (dateInput) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const input = dateInput.toLowerCase().trim();
  if (input.includes('tomorrow')) return tomorrow.toISOString().split('T')[0];
  if (input.includes('today')) return today.toISOString().split('T')[0];

  try {
    const parsed = new Date(dateInput);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  } catch {}
  return tomorrow.toISOString().split('T')[0];
};

// Dynamic working hours validation - will be replaced by Cal.com API calls
const isTimeWithinWorkingHours = async (apiKey, time24) => {
  try {
    const schedulesResult = await getUserSchedules(apiKey);
    if (!schedulesResult.success || !schedulesResult.schedules.length) {
      return true; // If we can't get schedules, allow the booking attempt
    }
    
    // Check against actual working hours from Cal.com
    const schedule = schedulesResult.schedules[0];
    // This is a simplified check - in production, you'd want more sophisticated logic
    return true; // Let Cal.com handle the validation
  } catch (error) {
    return true; // If error, allow the booking attempt
  }
};

// ------------------ Dynamic Cal.com Integration ------------------ //

// Get user profile and timezone dynamically
const getUserProfile = async (apiKey) => {
  try {
    console.log('🌐 Calling Cal.com /me API...');
    const response = await axios.get(`https://api.cal.com/v1/me?apiKey=${apiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Cal.com user profile response:', {
      username: response.data.user.username,
      timezone: response.data.user.timeZone,
      email: response.data.user.email
    });
    return { success: true, user: response.data.user };
  } catch (error) {
    console.error('❌ Cal.com user profile error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Get event type details (duration, settings, etc.) dynamically
const getEventTypeDetails = async (apiKey, eventId) => {
  try {
    console.log(`🌐 Calling Cal.com /event-types/${eventId} API...`);
    const response = await axios.get(`https://api.cal.com/v1/event-types/${eventId}?apiKey=${apiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Cal.com event type response:', {
      title: response.data.event_type.title,
      duration: response.data.event_type.length,
      timezone: response.data.event_type.timeZone
    });
    return { success: true, eventType: response.data.event_type };
  } catch (error) {
    console.error('❌ Cal.com event type error:', error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Get user's schedules (working hours) dynamically
const getUserSchedules = async (apiKey) => {
  try {
    console.log('🌐 Calling Cal.com /schedules API...');
    const response = await axios.get(`https://api.cal.com/v1/schedules?apiKey=${apiKey}`, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Cal.com schedules response:', {
      schedulesCount: response.data.schedules.length,
      firstSchedule: response.data.schedules[0] ? {
        name: response.data.schedules[0].name,
        timezone: response.data.schedules[0].timeZone,
        availabilityCount: response.data.schedules[0].availability?.length || 0
      } : null
    });
    return { success: true, schedules: response.data.schedules };
  } catch (error) {
    console.error('❌ Cal.com schedules error:', error.response?.data || error.message);
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
    console.error('Cal.com slots error:', error.response?.data || error.message);
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
    console.error('Cal.com availability error:', error.response?.data || error.message);
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
    console.log('📅 Starting dynamic booking process...');
    
    // Get user profile for timezone
    console.log('👤 Getting user profile for booking...');
    const userProfile = await getUserProfile(apiKey);
    if (!userProfile.success) {
      console.log('❌ Failed to get user profile for booking');
      return { success: false, error: 'Failed to get user profile' };
    }

    // Get event type details for duration
    console.log('📋 Getting event type details for booking...');
    const eventDetails = await getEventTypeDetails(apiKey, eventId);
    if (!eventDetails.success) {
      console.log('❌ Failed to get event type details for booking');
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
    console.log(`🌍 User timezone: ${userTimezone}`);
    
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
        console.log(`⚠️ Unknown timezone: ${userTimezone}, using default calculation`);
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
    
    console.log(`🕐 Time conversion: ${bookingData.date} ${bookingData.time} (${userProfile.user.timeZone}) → ${startUTC} to ${endUTC}`);

    console.log(`📅 Dynamic booking attempt - Start: ${startUTC}, End: ${endUTC}, Duration: ${duration}min`);

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

    console.log('🌐 Calling Cal.com /bookings API with payload:', bookingPayload);

    const response = await axios.post(
      `https://api.cal.com/v1/bookings?apiKey=${apiKey}`,
      bookingPayload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log('✅ Cal.com booking successful:', {
      bookingId: response.data.id,
      status: response.data.status
    });
    
    return { success: true, booking: response.data, confirmationId: response.data.id };
  } catch (error) {
    console.error('❌ Cal.com booking error:', {
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

// ------------------ Function execution handler ------------------ //

const executeFunction = async (functionName, args, agentConfig) => {
  console.log(`\n🔧 EXECUTING FUNCTION: ${functionName}`);
  console.log('📋 Arguments:', JSON.stringify(args, null, 2));
  console.log('⚙️  Agent Config:', {
    hasCalComKey: !!agentConfig.calComApiKey,
    calComEventId: agentConfig.calComEventId
  });

  switch (functionName) {
    case 'check_availability_cal':
      if (!agentConfig.calComApiKey || !agentConfig.calComEventId) {
        return { success: false, message: 'Cal.com not configured properly.' };
      }
      
      // Get user profile to get username dynamically
      console.log('👤 Getting user profile...');
      const userProfile = await getUserProfile(agentConfig.calComApiKey);
      if (!userProfile.success) {
        console.log('❌ Failed to get user profile:', userProfile.error);
        return { success: false, message: 'Unable to get user profile from Cal.com.' };
      }
      console.log('✅ User profile retrieved:', {
        username: userProfile.user.username,
        timezone: userProfile.user.timeZone
      });
      
      const parsedDate = parseDateInput(args.date);
      console.log('📅 Parsed date:', parsedDate);
      
      // If a specific time is provided, check for that exact time
      if (args.time) {
        console.log('⏰ Checking specific time availability:', args.time);
        
        // Convert time to 24-hour format for checking
        let time24 = args.time;
        if (args.time.includes('PM') || args.time.includes('AM')) {
          const [time, period] = args.time.split(' ');
          const [hours, minutes] = time.split(':');
          let hour24 = parseInt(hours);
          if (period === 'PM' && hour24 !== 12) hour24 += 12;
          if (period === 'AM' && hour24 === 12) hour24 = 0;
          time24 = `${hour24.toString().padStart(2, '0')}:${minutes || '00'}`;
        } else if (args.time.includes('pm') || args.time.includes('am')) {
          const [time, period] = args.time.split(' ');
          const [hours, minutes] = time.split(':');
          let hour24 = parseInt(hours);
          if (period === 'pm' && hour24 !== 12) hour24 += 12;
          if (period === 'am' && hour24 === 12) hour24 = 0;
          time24 = `${hour24.toString().padStart(2, '0')}:${minutes || '00'}`;
        } else if (args.time.includes(' ')) {
          const parts = args.time.split(' ');
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
        
        console.log('🕐 Converted time to 24-hour format:', time24);
        
        // Check if the specific time is available using Cal.com availability API
        console.log('🔍 Checking specific time slot availability...');
        
        // Get timezone offset for the user
        let timezoneOffsetHours = 0;
        if (userProfile.user.timeZone === 'Asia/Calcutta' || userProfile.user.timeZone === 'Asia/Kolkata') {
          timezoneOffsetHours = 5.5; // UTC+5:30
        }
        
        // Calculate UTC time for the specific slot
        const utcHours = parseInt(time24.split(':')[0]) - timezoneOffsetHours;
        const utcHoursInt = Math.floor(utcHours);
        const utcMinutes = parseInt(time24.split(':')[1]) + ((utcHours - utcHoursInt) * 60);
        
        // Calculate end time properly (handle hour overflow)
        let endHours = utcHoursInt;
        let endMinutes = utcMinutes + 30;
        if (endMinutes >= 60) {
          endHours += 1;
          endMinutes -= 60;
        }
        
        const startUTC = `${parsedDate}T${utcHoursInt.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}:00.000Z`;
        const endUTC = `${parsedDate}T${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00.000Z`;
        
        console.log(`🕐 Checking availability for: ${startUTC} to ${endUTC}`);
        
        // Use Cal.com v1 availability API to check specific time
        try {
          const availabilityResponse = await axios.get(
            `https://api.cal.com/v1/availability?apiKey=${agentConfig.calComApiKey}&eventTypeId=${agentConfig.calComEventId}&dateFrom=${parsedDate}&dateTo=${parsedDate}&username=${userProfile.user.username}&timeZone=${userProfile.user.timeZone}`,
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (availabilityResponse.data && availabilityResponse.data.busy) {
            // Check if our specific time slot conflicts with busy times
            const busyTimes = availabilityResponse.data.busy;
            const isTimeBusy = busyTimes.some(busy => {
              const busyStart = new Date(busy.start);
              const busyEnd = new Date(busy.end);
              const slotStart = new Date(startUTC);
              const slotEnd = new Date(endUTC);
              
              // Check if the requested time overlaps with busy times
              return (slotStart < busyEnd && slotEnd > busyStart);
            });
            
            if (isTimeBusy) {
              console.log('❌ Time slot conflicts with busy times');
              return { 
                success: false, 
                message: `I'm sorry, but ${parsedDate} at ${args.time} is not available. Would you like to try a different time?` 
              };
            }
          }
          
          console.log('✅ Time slot appears to be available');
          const finalMessage = `Great! ${parsedDate} at ${args.time} is available. Would you like me to book this appointment for you?`;
          console.log('✅ Specific time availability message:', finalMessage);
          return { 
            success: true, 
            message: finalMessage,
            availableTime: `${parsedDate} at ${args.time}`
          };
          
        } catch (error) {
          console.log('⚠️ Availability API error, falling back to general check:', error.message);
          // Fallback to general availability check
          const generalAvailabilityResult = await checkAvailability(agentConfig.calComApiKey, agentConfig.calComEventId, userProfile.user.username, parsedDate);
          
          if (generalAvailabilityResult.success) {
            const finalMessage = `Great! ${parsedDate} at ${args.time} is available. Would you like me to book this appointment for you?`;
            console.log('✅ General availability check passed:', finalMessage);
            return { 
              success: true, 
              message: finalMessage,
              availableTime: `${parsedDate} at ${args.time}`
            };
          } else {
            return { 
              success: false, 
              message: `I'm sorry, but ${parsedDate} at ${args.time} is not available. Would you like to try a different time?` 
            };
          }
        }
      } else {
        // General availability check for the date
        console.log('🔍 Checking general availability...');
      const availabilityResult = await checkAvailability(agentConfig.calComApiKey, agentConfig.calComEventId, userProfile.user.username, parsedDate);
      
      if (availabilityResult.success) {
        console.log('✅ Availability check successful');
        // Get working hours dynamically from schedules
        console.log('📅 Getting schedules...');
        const schedulesResult = await getUserSchedules(agentConfig.calComApiKey);
        let workingHoursMessage = '';
        
         if (schedulesResult.success && schedulesResult.schedules.length > 0) {
           const schedule = schedulesResult.schedules[0];
           console.log('✅ Schedule retrieved:', {
             name: schedule.name,
             timezone: schedule.timeZone,
             availabilityCount: schedule.availability?.length || 0
           });
           
           if (schedule.availability && schedule.availability.length > 0) {
             const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
             workingHoursMessage = `Our available hours are ${schedule.availability.map(av => 
               `${av.days.map(day => dayNames[day]).join(', ')}: ${av.startTime} - ${av.endTime}`
             ).join(', ')} (${schedule.timeZone}).`;
             console.log('⏰ Working hours message:', workingHoursMessage);
           } else {
             workingHoursMessage = 'Please check our available hours.';
           }
         } else {
           console.log('❌ No schedules found');
           workingHoursMessage = 'Please check our available hours.';
         }
        
        const finalMessage = `Great! I checked availability for ${parsedDate}. ${workingHoursMessage} Please choose a time within these hours.`;
        console.log('✅ Final availability message:', finalMessage);
        return { 
          success: true, 
          message: finalMessage
        };
      } else {
        console.log('❌ Availability check failed:', availabilityResult.error);
        return { 
          success: false, 
          message: `I'm having trouble checking the calendar right now, but I can still help you book ${parsedDate}.` 
        };
        }
      }

    case 'get_slots_cal':
      if (!agentConfig.calComApiKey || !agentConfig.calComEventId) {
        return { success: false, message: 'Cal.com not configured properly.' };
      }
      
      const slotsResult = await getAvailableSlots(agentConfig.calComApiKey, agentConfig.calComEventId, args.startTime, args.endTime);
      
      if (slotsResult.success) {
        return { 
          success: true, 
          message: `I found available slots between ${args.startTime} and ${args.endTime}.` 
        };
      } else {
        return { 
          success: false, 
          message: `I couldn't retrieve available slots at the moment, but I can still help you book.` 
        };
      }

    case 'book_appointment_cal':
      if (!agentConfig.calComApiKey || !agentConfig.calComEventId) {
        console.log('❌ Cal.com not configured properly');
        return { success: false, message: 'Cal.com not configured properly.' };
      }
      
      console.log('📅 Booking appointment with data:', {
        name: args.name,
        email: args.email,
        date: args.date,
        time: args.time,
        title: args.title
      });
      
      const bookingResult = await bookAppointment(agentConfig.calComApiKey, agentConfig.calComEventId, args);
      
      if (bookingResult.success) {
        console.log('✅ Booking successful:', {
          confirmationId: bookingResult.confirmationId,
          booking: bookingResult.booking
        });
        const successMessage = `Perfect! Your appointment has been booked for ${args.date} at ${args.time}. Confirmation ID: ${bookingResult.confirmationId}. You will receive an email confirmation shortly.`;
        console.log('✅ Booking success message:', successMessage);
        return { 
          success: true, 
          message: successMessage
        };
      } else {
        console.log('❌ Booking failed:', {
          error: bookingResult.error,
          status: bookingResult.status
        });
        
        // Use Cal.com's actual error messages
        let errorMessage = '';
        
        if (bookingResult.error) {
          if (bookingResult.error.includes('no_available_users_found_error')) {
            errorMessage = `I'm sorry, but ${args.date} at ${args.time} is already booked. Would you like me to suggest some alternative times?`;
          } else if (bookingResult.error.includes('minimum_booking_notice')) {
            errorMessage = `This time slot requires more advance notice. Please choose a time at least 24 hours in advance.`; 
          } else if (bookingResult.error.includes('Invalid event length')) {
            errorMessage = `The appointment duration doesn't match our system configuration. Please try a different time.`;
          } else {
            errorMessage = `I apologize for the inconvenience. There was an issue booking your appointment: ${bookingResult.error}. Please try a different time.`;
          }
        } else {
          errorMessage += `We are unable to book your appointment at the moment. `;
        }
        
        errorMessage += `I recommend trying a different time or contacting our support team directly.`;
        
        console.log('❌ Booking error message:', errorMessage);
        
        return { 
          success: false, 
          message: errorMessage,
          error: bookingResult.error
        };
      }

    case 'initiate_voice_call':
      if (!twilioService.isTwilioConfigured()) {
        return { success: false, message: 'Voice calling is not configured. Please set up Twilio credentials.' };
      }
      
      try {
        const callId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Start voice conversation with Cal.com credentials
        await voiceConversationService.startConversation(
          callId,
          agentConfig.prompt,
          args.customerName || 'Customer',
          args.phoneNumber,
          agentConfig.calComApiKey,
          agentConfig.calComEventId
        );
        
        const callResult = await twilioService.initiateCall({
          to: args.phoneNumber,
          agentPrompt: agentConfig.prompt,
          customerName: args.customerName || 'Customer',
          callId
        });

        if (callResult.success) {
          return {
            success: true,
            message: `Great! I'm calling ${args.customerName || 'the customer'} at ${args.phoneNumber}${args.reason ? ` to ${args.reason}` : ''}. The call should connect shortly.`,
            callId: callId,
            callSid: callResult.callSid
          };
        } else {
          return {
            success: false,
            message: `I apologize, but I couldn't initiate the call. ${callResult.error || 'Please try again later.'}`
          };
        }
      } catch (error) {
        console.error('Error initiating voice call:', error);
        return {
          success: false,
          message: 'I apologize, but there was an error initiating the call. Please try again later.'
        };
      }

    default:
      return { success: false, message: `Unknown function: ${functionName}` };
  }
};

// ------------------ Chat endpoint ------------------ //

app.post('/api/chat', optionalAuth, async (req, res) => {
  try {
    const { message, messages, agentConfig } = req.body;
    const userId = req.user ? req.user.id : null;

    // Log incoming conversation
    console.log('\n' + '='.repeat(80));
    console.log('🗣️  NEW CONVERSATION REQUEST');
    console.log('='.repeat(80));
    console.log('📝 User Message:', message);
    console.log('💬 Conversation History:', JSON.stringify(messages, null, 2));
    console.log('⚙️  Agent Config:', {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasCalComKey: !!agentConfig.calComApiKey,
      calComEventId: agentConfig.calComEventId,
      functionsCount: agentConfig.functions?.length || 0
    });

    // Get user credentials if authenticated
    let userCalComApiKey = agentConfig.calComApiKey;
    let userCalComEventId = agentConfig.calComEventId;
    
    if (userId && databaseService.isDatabaseConnected()) {
      try {
        const user = await databaseService.getUserById(userId);
        if (user) {
          // Use user's stored credentials if available, otherwise fall back to request
          userCalComApiKey = user.calcom_api_key || userCalComApiKey;
          userCalComEventId = user.calcom_event_id || userCalComEventId;
        }
      } catch (error) {
        logger.warn('Failed to get user credentials:', error);
      }
    }

    // Use OpenAI API key from environment variables (backend)
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ ERROR: OpenAI API key not configured in environment');
      return res.status(400).json({ error: 'OpenAI API key not configured on server' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const currentDate = getTodayDate();
    const tomorrowDate = getTomorrowDate();
    
    console.log('📅 Date Context:', { currentDate, tomorrowDate });

    const openaiMessages = [
      { role: 'system', content: `${agentConfig.prompt}\n\nCURRENT DATE CONTEXT:\nToday: ${currentDate}\nTomorrow: ${tomorrowDate}` }
    ];
    
    // Convert messages with proper function call handling
    for (const msg of messages) {
      const message = { role: msg.type === 'user' ? 'user' : 'assistant', content: msg.content };
      
      // Include function call information if it exists
      if (msg.functionCall) {
        message.function_call = {
          name: msg.functionCall.name,
          arguments: JSON.stringify(msg.functionCall.arguments)
        };
      }
      
      openaiMessages.push(message);
      
      // Add function result as a separate message if it exists
      if (msg.functionCall && msg.functionCall.result) {
        const functionResult = {
          role: 'function',
          name: msg.functionCall.name,
          content: JSON.stringify(msg.functionCall.result)
        };
        openaiMessages.push(functionResult);
      }
    }

    console.log('🤖 OpenAI Messages:', JSON.stringify(openaiMessages, null, 2));

    // Build functions dynamically based on agent configuration
    const functions = [];
    
    // Add Cal.com functions if credentials are provided (from user or request)
    if (userCalComApiKey && userCalComEventId) {
      functions.push(
        {
          name: 'check_availability_cal',
          description: 'Use this to check if a specific date/time is available. Use this FIRST when user provides a specific time (like "tomorrow 3 pm") to verify availability before booking.',
          parameters: {
            type: 'object',
            properties: { 
              date: { type: 'string' },
              time: { type: 'string' }
            },
            required: ['date']
          }
        },
        {
          name: 'get_slots_cal',
          description: 'Get available slots between start and end time - rarely used',
          parameters: {
            type: 'object',
            properties: { startTime: { type: 'string' }, endTime: { type: 'string' } },
            required: ['startTime', 'endTime']
          }
        },
        {
          name: 'book_appointment_cal',
          description: 'MANDATORY: Use this to book an appointment when user confirms booking. Use when user says "yes", "book it", "confirm", "proceed", etc. after availability check. This is the final booking step.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              date: { type: 'string' },
              time: { type: 'string' },
              title: { type: 'string' }
            },
            required: ['name', 'email', 'date', 'time']
          }
        }
      );
    }
    
    // Add voice calling function if Twilio is configured
    if (twilioService.isTwilioConfigured()) {
      functions.push({
        name: 'initiate_voice_call',
        description: 'Use this to make a voice call to a customer. Use when customer requests a phone call or when you need to follow up with a voice conversation.',
        parameters: {
          type: 'object',
          properties: {
            phoneNumber: { type: 'string', description: 'Phone number with country code (e.g., +1234567890)' },
            customerName: { type: 'string', description: 'Customer name for the call' },
            reason: { type: 'string', description: 'Reason for the call (e.g., "follow up on appointment booking")' }
          },
          required: ['phoneNumber']
        }
      });
    }
    
    // Add custom functions from agent configuration
    if (agentConfig.functions && agentConfig.functions.length > 0) {
      functions.push(...agentConfig.functions);
    }

    console.log('🔧 Available Functions:', functions.map(f => f.name));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: openaiMessages,
      functions,
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 1000
    });

    const response = completion.choices[0].message;
    
    console.log('🤖 OpenAI Response:', {
      hasFunctionCall: !!response.function_call,
      functionName: response.function_call?.name,
      functionArgs: response.function_call?.arguments,
      content: response.content
    });
     if (response.function_call) {
       const fn = response.function_call.name;
       const args = JSON.parse(response.function_call.arguments);
       
       console.log('🔧 EXECUTING FUNCTION:', {
         functionName: fn,
         arguments: args
       });
       
       const result = await executeFunction(fn, args, {
         ...agentConfig,
         calComApiKey: userCalComApiKey,
         calComEventId: userCalComEventId
       });
       
       console.log('✅ FUNCTION RESULT:', {
         functionName: fn,
         success: result.success,
         message: result.message,
         error: result.error
       });
       
       // Return the message from the result, or the result itself if it's a string
       const message = result.message || result;
       
       console.log('📤 SENDING RESPONSE:', {
         message: message,
         hasFunctionCall: true,
         functionName: fn
       });
       
       console.log('='.repeat(80));
       console.log('✅ CONVERSATION COMPLETED SUCCESSFULLY');
       console.log('='.repeat(80));
       
       return res.json({ 
         message: message,
         functionCall: {
           name: fn,
           arguments: args,
           result: result
         }
       });
     }

    // Store chat session and message if user is authenticated and database is connected
    if (userId && databaseService.isDatabaseConnected()) {
      try {
        // Create or update chat session
        const sessionId = `chat_${userId}_${Date.now()}`;
        await databaseService.createOrUpdateChatSession(sessionId, {
          agentPrompt: agentConfig.prompt,
          calcomApiKey: userCalComApiKey,
          calcomEventId: userCalComEventId,
          userId: userId,
          messageCount: messages.length + 1
        });

        // Store the user message
        await databaseService.storeChatMessage(sessionId, 'user', message);

        // Store the assistant response
        await databaseService.storeChatMessage(sessionId, 'assistant', response.content);
      } catch (error) {
        logger.warn('Failed to store chat session:', error);
      }
    }

    console.log('📤 SENDING RESPONSE:', {
      message: response.content,
      hasFunctionCall: false
    });

    console.log('='.repeat(80));
    console.log('✅ CONVERSATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));

    return res.json({ message: response.content });
  } catch (error) {
    console.error('❌ CHAT ERROR:', error);
    console.log('='.repeat(80));
    console.log('💥 CONVERSATION ENDED WITH ERROR');
    console.log('='.repeat(80));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------ Voice Calling Endpoints ------------------ //

/**
 * Initiate a voice call
 * POST /api/voice/initiate-call
 */
app.post('/api/voice/initiate-call', async (req, res) => {
  try {
    const { phoneNumber, customerName, agentPrompt, calComApiKey, calComEventId } = req.body;

    // Validate required fields
    if (!phoneNumber || !agentPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and agent prompt are required'
      });
    }

    // Generate unique call ID
    const callId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start voice conversation with Cal.com credentials
    await voiceConversationService.startConversation(
      callId,
      agentPrompt,
      customerName || 'Customer',
      phoneNumber,
      calComApiKey,
      calComEventId
    );

    // Initiate Twilio call
    const callResult = await twilioService.initiateCall({
      to: phoneNumber,
      agentPrompt,
      customerName: customerName || 'Customer',
      callId
    });

    if (callResult.success) {
      // Save call data to database (if available)
      if (databaseService.isDatabaseConnected()) {
        try {
          await databaseService.saveVoiceCall({
            callId,
            callSid: callResult.callSid,
            phoneNumber,
            customerName: customerName || 'Customer',
            agentPrompt,
            calComApiKey,
            calComEventId,
            status: 'initiated',
            twilioStatus: callResult.status
          });

          await databaseService.logCallAnalytics(callId, 'call_initiated', {
            phoneNumber: twilioService._maskPhoneNumber(phoneNumber),
            customerName,
            hasCalComCredentials: !!(calComApiKey && calComEventId)
          });
        } catch (dbError) {
          logger.warn('Failed to save call data to database:', dbError.message);
        }
      }

      logger.info('Voice call initiated successfully', {
        callId,
        phoneNumber: twilioService._maskPhoneNumber(phoneNumber),
        customerName
      });

      res.json({
        success: true,
        callId,
        callSid: callResult.callSid,
        message: 'Voice call initiated successfully'
      });
    } else {
      throw new Error(callResult.error || 'Failed to initiate call');
    }

  } catch (error) {
    logger.error('Error initiating voice call:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate voice call'
    });
  }
});

/**
 * Handle Twilio voice webhook
 * POST /api/voice-webhook
 */
app.post('/api/voice-webhook', async (req, res) => {
  try {
    const { CallSid, SpeechResult, CallStatus, From, To } = req.body;
    const callId = req.query.callId;

    logger.info('Voice webhook received', {
      callSid: CallSid,
      speechResult: SpeechResult,
      callStatus: CallStatus,
      callId
    });

    // Handle different call statuses
    if (CallStatus === 'completed' || CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'failed') {
      // End conversation
      if (callId) {
        voiceConversationService.endConversation(callId);
      }
      
      // Return hangup TwiML
      const twiml = twilioService.generateTwiML('hangup', {
        message: 'Thank you for calling. Have a great day!'
      });
      
      res.type('text/xml');
      return res.send(twiml);
    }

    // Handle speech input
    if (SpeechResult && callId) {
      // Save user speech to database (if available)
      if (databaseService.isDatabaseConnected()) {
        try {
          await databaseService.saveVoiceConversation(callId, 'user', SpeechResult);
        } catch (dbError) {
          logger.warn('Failed to save user speech to database:', dbError.message);
        }
      }
      
      // Process voice input
      const response = await voiceConversationService.processVoiceInput(callId, SpeechResult);
      
      if (response.success) {
        // Check if we need to execute Cal.com functions
        const conversation = voiceConversationService.getConversation(callId);
        if (conversation && conversation.context.currentStep === 'availability_check' && conversation.calComApiKey && conversation.calComEventId) {
          // Execute availability check using user-provided credentials
          const availabilityResult = await voiceConversationService.executeCalComFunction(
            'check_availability_cal',
            { date: new Date().toISOString().split('T')[0], time: 'preferred' },
            conversation.calComApiKey,
            conversation.calComEventId
          );
          
          if (availabilityResult.success) {
            response.response = availabilityResult.message;
            
            // Log Cal.com function execution (if database available)
            if (databaseService.isDatabaseConnected()) {
              try {
                await databaseService.logCallAnalytics(callId, 'calcom_function_executed', {
                  functionName: 'check_availability_cal',
                  success: true,
                  result: availabilityResult
                });
              } catch (dbError) {
                logger.warn('Failed to log function execution:', dbError.message);
              }
            }
          }
        }
        
        // Save AI response to database (if available)
        if (databaseService.isDatabaseConnected()) {
          try {
            await databaseService.saveVoiceConversation(callId, 'assistant', response.response, null, null, response.context);
          } catch (dbError) {
            logger.warn('Failed to save AI response to database:', dbError.message);
          }
        }
        
        // Generate TwiML response
        const twiml = twilioService.generateTwiML('speech-gather', {
          message: response.response,
          action: `/api/voice-webhook?callId=${callId}`
        });
        
        res.type('text/xml');
        return res.send(twiml);
      }
    }

    // Default greeting for new calls
    if (!SpeechResult && callId) {
      const conversation = voiceConversationService.getConversation(callId);
      if (conversation) {
        const twiml = twilioService.generateTwiML('greeting', {
          message: conversation.messages[0]?.content || 'Hello! I\'m Anna from Textdrip. How can I help you today?'
        });
        
        res.type('text/xml');
        return res.send(twiml);
      }
    }

    // Fallback response
    const twiml = twilioService.generateTwiML('speech-gather', {
      message: 'I didn\'t hear anything. Please try again.',
      action: `/api/voice-webhook?callId=${callId}`
    });
    
    res.type('text/xml');
    res.send(twiml);

  } catch (error) {
    logger.error('Error handling voice webhook:', error);
    
    // Return error TwiML
    const twiml = twilioService.generateTwiML('hangup', {
      message: 'I apologize, but I\'m having technical difficulties. Please call back later.'
    });
    
    res.type('text/xml');
    res.send(twiml);
  }
});

/**
 * Handle call status updates
 * POST /api/call-status
 */
app.post('/api/call-status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration, From, To } = req.body;
    
    logger.info('Call status update received', {
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration,
      from: From,
      to: To
    });

    // Update call status in Twilio service
    if (CallStatus === 'completed' || CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'failed') {
      twilioService.updateCallStatus(CallSid, CallStatus, {
        duration: CallDuration,
        endTime: new Date()
      });
      
      // Update database with call status (if available)
      if (databaseService.isDatabaseConnected()) {
        try {
          await databaseService.updateVoiceCallStatus(CallSid, CallStatus, {
            duration: CallDuration,
            endTime: new Date(),
            twilioStatus: CallStatus
          });
          
          await databaseService.logCallAnalytics(CallSid, 'call_completed', {
            status: CallStatus,
            duration: CallDuration,
            from: From,
            to: To
          });
        } catch (dbError) {
          logger.warn('Failed to update call status in database:', dbError.message);
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error handling call status:', error);
    res.status(500).send('Error');
  }
});

/**
 * Get voice call status
 * GET /api/voice/call-status/:callId
 */
app.get('/api/voice/call-status/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const conversation = voiceConversationService.getConversation(callId);
    
    if (conversation) {
      res.json({
        success: true,
        callId,
        status: 'active',
        conversation: {
          messagesCount: conversation.messages.length,
          context: conversation.context,
          startTime: conversation.startTime
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Conversation not found'
      });
    }
  } catch (error) {
    logger.error('Error getting call status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test Twilio connection
 * GET /api/voice/test-connection
 */
app.get('/api/voice/test-connection', async (req, res) => {
  try {
    const result = await twilioService.testConnection();
    res.json(result);
  } catch (error) {
    logger.error('Error testing Twilio connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get recent voice calls
 * GET /api/voice/calls
 */
app.get('/api/voice/calls', async (req, res) => {
  try {
    if (!databaseService.isDatabaseConnected()) {
      return res.json({
        success: true,
        message: 'Database not configured',
        calls: [],
        count: 0
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const calls = await databaseService.getRecentVoiceCalls(limit);
    res.json({
      success: true,
      calls,
      count: calls.length
    });
  } catch (error) {
    logger.error('Error getting recent voice calls:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get call analytics
 * GET /api/voice/analytics
 */
app.get('/api/voice/analytics', async (req, res) => {
  try {
    if (!databaseService.isDatabaseConnected()) {
      return res.json({
        success: true,
        message: 'Database not configured',
        timeframe: req.query.timeframe || '24h',
        analytics: []
      });
    }

    const timeframe = req.query.timeframe || '24h';
    const analytics = await databaseService.getCallAnalytics(timeframe);
    res.json({
      success: true,
      timeframe,
      analytics
    });
  } catch (error) {
    logger.error('Error getting call analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get specific call with conversations
 * GET /api/voice/call/:callId
 */
app.get('/api/voice/call/:callId', async (req, res) => {
  try {
    if (!databaseService.isDatabaseConnected()) {
      return res.json({
        success: false,
        message: 'Database not configured'
      });
    }

    const { callId } = req.params;
    const callData = await databaseService.getVoiceCallWithConversations(callId);
    
    if (callData) {
      res.json({
        success: true,
        call: callData.call,
        conversations: callData.conversations
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }
  } catch (error) {
    logger.error('Error getting call details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Authentication routes
app.use('/api/auth', authRouter);

// Health
app.get('/api/health', (req, res) => res.json({ 
  status: 'OK', 
  timestamp: new Date().toISOString(),
  services: {
    database: databaseService.isDatabaseConnected(),
    twilio: twilioService.isTwilioConfigured(),
    voice: true
  }
}));

app.listen(PORT, () => {
  console.log(`🚀 Chatbot server running on port ${PORT}`);
  console.log(`📞 Voice calling: ${twilioService.isTwilioConfigured() ? 'Enabled' : 'Disabled'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});