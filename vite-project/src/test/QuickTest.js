// Quick Cal.com Test Script
// Run this in browser console or import in your app

const QUICK_TEST_CONFIG = {
  api_key: 'cal_live_ab4d1bf553fdebc1ff2be9325500a150',
  event_type_id: '3053103',
  timezone: 'UTC'
};

// Quick test function
export const quickTest = async () => {
  console.log('🚀 Starting Quick Cal.com Test...');
  console.log('API Key:', QUICK_TEST_CONFIG.api_key);
  console.log('Event ID:', QUICK_TEST_CONFIG.event_type_id);

  try {
    // Test 1: Check availability for tomorrow
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`\n📅 Checking availability for ${tomorrow}...`);

    const response = await fetch(`https://api.cal.com/v1/availability?eventTypeId=${QUICK_TEST_CONFIG.event_type_id}&date=${tomorrow}&timeZone=${QUICK_TEST_CONFIG.timezone}`, {
      headers: {
        'Authorization': `Bearer ${QUICK_TEST_CONFIG.api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Availability check successful!');
      console.log('Available slots:', data.days || []);
      
      // Test 2: Try to book an appointment if slots are available
      if (data.days && data.days.length > 0) {
        console.log('\n📝 Attempting to book appointment...');
        
        const bookingResponse = await fetch('https://api.cal.com/v1/bookings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${QUICK_TEST_CONFIG.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            eventTypeId: parseInt(QUICK_TEST_CONFIG.event_type_id),
            start: `${tomorrow}T10:00:00.000Z`,
            timeZone: QUICK_TEST_CONFIG.timezone,
            responses: {
              name: 'Test User',
              email: 'test@example.com',
              notes: 'Test booking from Retell AI platform'
            },
            metadata: {
              source: 'retell-ai-test'
            }
          })
        });

        if (bookingResponse.ok) {
          const bookingData = await bookingResponse.json();
          console.log('✅ Appointment booked successfully!');
          console.log('Booking ID:', bookingData.id);
          console.log('Booking UID:', bookingData.uid);
          console.log('Booking Details:', bookingData);
        } else {
          const errorData = await bookingResponse.json();
          console.log('❌ Booking failed:', errorData);
        }
      } else {
        console.log('ℹ️ No available slots found for booking test');
      }
    } else {
      const errorData = await response.json();
      console.log('❌ Availability check failed:', errorData);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
};

// Test with different dates
export const testMultipleDates = async () => {
  console.log('📅 Testing multiple dates...');
  
  const dates = [
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Day after tomorrow
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]  // 3 days from now
  ];

  for (const date of dates) {
    console.log(`\nChecking ${date}...`);
    
    try {
      const response = await fetch(`https://api.cal.com/v1/availability?eventTypeId=${QUICK_TEST_CONFIG.event_type_id}&date=${date}&timeZone=${QUICK_TEST_CONFIG.timezone}`, {
        headers: {
          'Authorization': `Bearer ${QUICK_TEST_CONFIG.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${date}: ${data.days ? data.days.length : 0} available slots`);
        if (data.days && data.days.length > 0) {
          console.log('Slots:', data.days);
        }
      } else {
        const errorData = await response.json();
        console.log(`❌ ${date}: ${errorData.message || 'Error'}`);
      }
    } catch (error) {
      console.log(`❌ ${date}: ${error.message}`);
    }
  }
};

// Test event type details
export const testEventType = async () => {
  console.log('📋 Testing event type details...');
  
  try {
    const response = await fetch(`https://api.cal.com/v1/event-types/${QUICK_TEST_CONFIG.event_type_id}`, {
      headers: {
        'Authorization': `Bearer ${QUICK_TEST_CONFIG.api_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Event type found!');
      console.log('Event Details:', {
        id: data.id,
        title: data.title,
        length: data.length,
        description: data.description,
        slug: data.slug
      });
    } else {
      const errorData = await response.json();
      console.log('❌ Event type not found:', errorData);
    }
  } catch (error) {
    console.error('❌ Event type test error:', error);
  }
};

// Run all quick tests
export const runAllQuickTests = async () => {
  console.log('🚀 Running All Quick Tests...');
  
  await testEventType();
  await quickTest();
  await testMultipleDates();
  
  console.log('\n🎯 Quick tests completed!');
};

// Browser console usage:
// import { quickTest, runAllQuickTests } from './test/QuickTest';
// await quickTest();
// await runAllQuickTests();

export default {
  quickTest,
  testMultipleDates,
  testEventType,
  runAllQuickTests
};
