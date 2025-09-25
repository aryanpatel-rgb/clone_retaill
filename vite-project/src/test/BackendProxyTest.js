// Test the backend proxy for Cal.com API calls
// This test verifies that the CORS issue is fixed

const TEST_CONFIG = {
  api_key: 'cal_live_ab4d1bf553fdebc1ff2be9325500a150',
  event_type_id: '3053103',
  timezone: 'UTC'
};

// Test backend proxy endpoints
export const testBackendProxy = async () => {
  console.log('🔧 Testing Backend Proxy for Cal.com API...');
  
  try {
    // Test 1: Validate API Key via backend
    console.log('\n1. Testing API Key validation via backend...');
    const validateResponse = await fetch('http://localhost:5000/api/calcom/validate-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: TEST_CONFIG.api_key
      })
    });

    if (validateResponse.ok) {
      const validateData = await validateResponse.json();
      console.log('✅ API Key validation successful:', validateData);
    } else {
      const errorData = await validateResponse.json();
      console.log('❌ API Key validation failed:', errorData);
    }

    // Test 2: Get Event Type via backend
    console.log('\n2. Testing Event Type fetch via backend...');
    const eventTypeResponse = await fetch(`http://localhost:5000/api/calcom/event-types/${TEST_CONFIG.event_type_id}?apiKey=${TEST_CONFIG.api_key}`);
    
    if (eventTypeResponse.ok) {
      const eventTypeData = await eventTypeResponse.json();
      console.log('✅ Event Type fetch successful:', eventTypeData);
    } else {
      const errorData = await eventTypeResponse.json();
      console.log('❌ Event Type fetch failed:', errorData);
    }

    // Test 3: Check Availability via backend
    console.log('\n3. Testing Availability check via backend...');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const availabilityResponse = await fetch('http://localhost:5000/api/calcom/availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: TEST_CONFIG.api_key,
        eventTypeId: TEST_CONFIG.event_type_id,
        startDate: tomorrow,
        endDate: nextWeek,
        timezone: TEST_CONFIG.timezone
      })
    });

    if (availabilityResponse.ok) {
      const availabilityData = await availabilityResponse.json();
      console.log('✅ Availability check successful:', availabilityData);
      
      // Test 4: Book Appointment if slots available
      if (availabilityData.success && availabilityData.slots.length > 0) {
        console.log('\n4. Testing Appointment booking via backend...');
        
        const startDateTime = `${tomorrow}T10:00:00.000Z`;
        const endDateTime = new Date(new Date(startDateTime).getTime() + 30 * 60 * 1000).toISOString();
        
        const bookingResponse = await fetch('http://localhost:5000/api/calcom/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: TEST_CONFIG.api_key,
            eventTypeId: TEST_CONFIG.event_type_id,
            name: 'Test User',
            email: 'test@example.com',
            start: startDateTime,
            end: endDateTime,
            timezone: TEST_CONFIG.timezone,
            notes: 'Test booking from backend proxy'
          })
        });

        if (bookingResponse.ok) {
          const bookingData = await bookingResponse.json();
          console.log('✅ Appointment booking successful:', bookingData);
        } else {
          const errorData = await bookingResponse.json();
          console.log('❌ Appointment booking failed:', errorData);
        }
      } else {
        console.log('ℹ️ No available slots found for booking test');
      }
    } else {
      const errorData = await availabilityResponse.json();
      console.log('❌ Availability check failed:', errorData);
    }

    console.log('\n🎯 Backend proxy test completed!');
    
  } catch (error) {
    console.error('❌ Backend proxy test error:', error);
  }
};

// Test frontend service with backend proxy
export const testFrontendService = async () => {
  console.log('\n🎨 Testing Frontend Service with Backend Proxy...');
  
  try {
    // Import the updated Cal.com service
    const { default: calComService } = await import('../services/calcom');
    
    // Test API key validation
    console.log('Testing API key validation...');
    const validateResult = await calComService.validateApiKey(TEST_CONFIG.api_key);
    console.log('API Key validation result:', validateResult);
    
    // Test event type fetch
    console.log('Testing event type fetch...');
    const eventTypeResult = await calComService.getEventType(TEST_CONFIG.api_key, TEST_CONFIG.event_type_id);
    console.log('Event type result:', eventTypeResult);
    
    // Test availability check
    console.log('Testing availability check...');
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const availabilityResult = await calComService.checkAvailability(
      TEST_CONFIG.api_key,
      TEST_CONFIG.event_type_id,
      { startDate: tomorrow, endDate: nextWeek, timezone: TEST_CONFIG.timezone }
    );
    console.log('Availability result:', availabilityResult);
    
    console.log('✅ Frontend service test completed!');
    
  } catch (error) {
    console.error('❌ Frontend service test error:', error);
  }
};

// Run all backend proxy tests
export const runAllBackendTests = async () => {
  console.log('🚀 Running All Backend Proxy Tests...');
  console.log('API Key:', TEST_CONFIG.api_key);
  console.log('Event ID:', TEST_CONFIG.event_type_id);
  
  await testBackendProxy();
  await testFrontendService();
  
  console.log('\n🎯 All backend proxy tests completed!');
};

export default {
  testBackendProxy,
  testFrontendService,
  runAllBackendTests
};

// Usage:
// import BackendProxyTest from './BackendProxyTest';
// await BackendProxyTest.runAllBackendTests();
