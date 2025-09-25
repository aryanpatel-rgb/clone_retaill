// Cal.com Integration Test with Real API Key and Event ID
import calComService from '../services/calcom';
import functionEngine from '../services/functionEngine';

// Test configuration
const TEST_CONFIG = {
  api_key: 'cal_live_ab4d1bf553fdebc1ff2be9325500a150',
  event_type_id: '3053103',
  timezone: 'UTC'
};

const TEST_USER = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '+1234567890'
};

const TEST_DATES = [
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
];

// Test 1: Validate API Key
export const testApiKeyValidation = async () => {
  try {
    const result = await calComService.validateApiKey(TEST_CONFIG.api_key);
    return result.success;
  } catch (error) {
    return false;
  }
};

// Test 2: Get Event Type Details
export const testGetEventType = async () => {
  try {
    const result = await calComService.getEventType(TEST_CONFIG.api_key, TEST_CONFIG.event_type_id);
    return result.success ? result : false;
  } catch (error) {
    return false;
  }
};

// Test 3: Check Availability
export const testCheckAvailability = async () => {
  const availabilityResults = [];
  
  for (const date of TEST_DATES) {
    try {
      const result = await calComService.checkAvailability(
        TEST_CONFIG.api_key,
        TEST_CONFIG.event_type_id,
        {
          startDate: date,
          endDate: date,
          timezone: TEST_CONFIG.timezone
        }
      );
      
      if (result.success) {
        const slots = result.slots || {};
        let slotCount = 0;
        if (Array.isArray(slots)) {
          slotCount = slots.length;
        } else if (typeof slots === 'object' && slots !== null) {
          slotCount = Object.values(slots).reduce((total, daySlots) => {
            return total + (Array.isArray(daySlots) ? daySlots.length : 0);
          }, 0);
        }
        
        availabilityResults.push({
          date: date,
          success: true,
          slots: result.slots,
          slotCount: slotCount
        });
      } else {
        availabilityResults.push({
          date: date,
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      availabilityResults.push({
        date: date,
        success: false,
        error: error.message
      });
    }
  }
  
  return availabilityResults;
};

// Test 4: Book Appointment
export const testBookAppointment = async (availableSlots) => {
  if (!availableSlots || availableSlots.length === 0) {
    return false;
  }
  
  const firstSlot = availableSlots[0];
  const bookingDate = firstSlot.date || TEST_DATES[0];
  
  try {
    const startDateTime = `${bookingDate}T10:00:00.000Z`;
    const endDateTime = new Date(new Date(startDateTime).getTime() + 30 * 60 * 1000).toISOString();
    
    const result = await calComService.bookAppointment(
      TEST_CONFIG.api_key,
      TEST_CONFIG.event_type_id,
      {
        name: TEST_USER.name,
        email: TEST_USER.email,
        start: startDateTime,
        end: endDateTime,
        timezone: TEST_CONFIG.timezone,
        notes: 'Test booking from Retell AI platform'
      }
    );
    
    return result.success ? result : false;
  } catch (error) {
    return false;
  }
};

// Test 5: Function Engine Integration
export const testFunctionEngine = async () => {
  try {
    const result = await functionEngine.executeFunction(
      'check_availability',
      TEST_CONFIG,
      { startDate: TEST_DATES[0], endDate: TEST_DATES[0] }
    );
    
    return result.success ? result.result : false;
  } catch (error) {
    return false;
  }
};

// Complete End-to-End Test
export const runCompleteTest = async () => {
  const results = {
    apiKeyValidation: false,
    eventTypeDetails: false,
    availabilityCheck: [],
    booking: false,
    functionEngine: false
  };

  // Test API Key
  results.apiKeyValidation = await testApiKeyValidation();
  
  // Test Event Type
  results.eventTypeDetails = await testGetEventType();
  
  // Test Availability
  results.availabilityCheck = await testCheckAvailability();
  
  // Test Booking (if slots available)
  const availableSlots = results.availabilityCheck.filter(r => r.success && r.slotCount > 0);
  if (availableSlots.length > 0) {
    results.booking = await testBookAppointment(availableSlots);
  }
  
  // Test Function Engine
  results.functionEngine = await testFunctionEngine();
  
  return results;
};

// Run all tests with logging
export const runAllTests = async (log) => {
  const logMessage = (message, type = 'info') => {
    if (log) log({ message, type });
  };

  logMessage('🚀 Starting Cal.com Integration Tests...');
  
  const results = await runCompleteTest();
  
  // Log results
  logMessage(`API Key Validation: ${results.apiKeyValidation ? '✅' : '❌'}`);
  logMessage(`Event Type Details: ${results.eventTypeDetails ? '✅' : '❌'}`);
  
  results.availabilityCheck.forEach(result => {
    if (result.success) {
      logMessage(`Availability ${result.date}: ✅ (${result.slotCount} slots)`);
    } else {
      logMessage(`Availability ${result.date}: ❌ (${result.error})`);
    }
  });
  
  logMessage(`Booking: ${results.booking ? '✅' : '❌'}`);
  logMessage(`Function Engine: ${results.functionEngine ? '✅' : '❌'}`);
  
  return results;
};

// Test conversation flow
export const testConversationFlow = async (log) => {
  const logMessage = (message, type = 'info') => {
    if (log) log({ message, type });
  };

  logMessage('🤖 Testing AI Agent Conversation Flow...');
  
  try {
    // Simulate AI agent checking availability
    logMessage('AI: Let me check your availability...');
    const availability = await testCheckAvailability();
    
    if (availability.some(a => a.success && a.slotCount > 0)) {
      logMessage('AI: I found available slots! Let me book one for you...');
      const booking = await testBookAppointment(availability.filter(a => a.success && a.slotCount > 0));
      
      if (booking) {
        logMessage('AI: ✅ Appointment booked successfully!');
        logMessage(`Booking ID: ${booking.bookingId}`);
        return true;
      } else {
        logMessage('AI: ❌ Sorry, booking failed. Please try again.');
        return false;
      }
    } else {
      logMessage('AI: ❌ No available slots found for the requested dates.');
      return false;
    }
  } catch (error) {
    logMessage(`AI: ❌ Error: ${error.message}`, 'error');
    return false;
  }
};