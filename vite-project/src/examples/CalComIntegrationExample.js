// Complete Cal.com Integration Example
// This shows the entire flow from user input to API execution

import calComService from '../services/calcom';
import functionEngine from '../services/functionEngine';

// Example 1: User creates a function with perfect information
const createFunctionExample = async () => {
  console.log('=== STEP 1: User Creates Function ===');
  
  const userInput = {
    function_type: 'check_availability',
    name: 'check_availability',
    description: 'Check calendar availability for booking appointments',
    config: {
      api_key: 'cal_live_aa4320bc62efc343487b0bfea5512444', // User's Cal.com API key
      event_type_id: '3060687', // User's Event Type ID from Cal.com
      timezone: 'Asia/Kolkata' // User's preferred timezone
    }
  };

  console.log('User provides:', userInput);
  
  // This gets stored in the database
  const storedFunction = await createAgentFunction('agent_123', userInput);
  console.log('Function stored:', storedFunction);
};

// Example 2: AI Agent uses the function in conversation
const aiConversationExample = async () => {
  console.log('\n=== STEP 2: AI Agent Uses Function ===');
  
  // AI agent's response with function call
  const aiResponse = "I'll check our availability for you. Let me look at the calendar... check_availability()";
  
  console.log('AI Response:', aiResponse);
  
  // Function engine detects the function call
  const functionCalls = functionEngine.parseFunctionCalls(aiResponse);
  console.log('Detected function calls:', functionCalls);
  
  // Execute the function with stored configuration
  const result = await functionEngine.executeFunction(
    'check_availability',
    {
      api_key: 'cal_live_aa4320bc62efc343487b0bfea5512444',
      event_type_id: '3060687',
      timezone: 'Asia/Kolkata'
    },
    { date: '2024-01-15' }
  );
  
  console.log('Function execution result:', result);
};

// Example 3: Real Cal.com API call
const realCalComCallExample = async () => {
  console.log('\n=== STEP 3: Real Cal.com API Call ===');
  
  try {
    // This is what actually happens when we call Cal.com
    const availability = await calComService.checkAvailability(
      'cal_live_aa4320bc62efc343487b0bfea5512444', // API Key
      '3060687', // Event Type ID
      {
        date: '2024-01-15',
        timezone: 'Asia/Kolkata'
      }
    );
    
    console.log('Cal.com API Response:', availability);
    
    if (availability.success) {
      console.log('Available slots:', availability.availableSlots);
      
      // AI agent can now respond to user
      const aiResponse = `I found ${availability.availableSlots.length} available slots on January 15th. Would you like me to book one for you?`;
      console.log('AI Response to user:', aiResponse);
    }
  } catch (error) {
    console.error('Cal.com API Error:', error);
  }
};

// Example 4: Booking an appointment
const bookAppointmentExample = async () => {
  console.log('\n=== STEP 4: Booking Appointment ===');
  
  try {
    const booking = await calComService.bookAppointment(
      'cal_live_aa4320bc62efc343487b0bfea5512444', // API Key
      '3060687', // Event Type ID
      {
        name: 'John Doe',
        email: 'john@example.com',
        date: '2024-01-15',
        time: '10:00',
        timezone: 'Asia/Kolkata',
        notes: 'Meeting with AI agent'
      }
    );
    
    console.log('Booking result:', booking);
    
    if (booking.success) {
      console.log('Appointment booked successfully!');
      console.log('Booking ID:', booking.bookingId);
      console.log('Booking UID:', booking.bookingUid);
    }
  } catch (error) {
    console.error('Booking error:', error);
  }
};

// Example 5: Complete conversation flow
const completeConversationFlow = () => {
  console.log('\n=== COMPLETE CONVERSATION FLOW ===');
  
  const conversation = [
    {
      user: "Hi, I'd like to schedule a meeting",
      ai: "I'd be happy to help you schedule a meeting. Let me check our availability for you.",
      functionCall: "check_availability()",
      functionResult: {
        success: true,
        availableSlots: [
          { date: '2024-01-15', time: '10:00', available: true },
          { date: '2024-01-15', time: '14:00', available: true },
          { date: '2024-01-16', time: '09:00', available: true }
        ]
      }
    },
    {
      user: "January 15th at 10 AM works for me",
      ai: "Perfect! I'll book that appointment for you.",
      functionCall: "book_appointment({name: 'John Doe', email: 'john@example.com', date: '2024-01-15', time: '10:00'})",
      functionResult: {
        success: true,
        bookingId: 'booking_123456',
        message: 'Appointment booked successfully'
      }
    },
    {
      user: "Great! What's my booking ID?",
      ai: "Your appointment has been confirmed! Your booking ID is booking_123456. You'll receive a confirmation email shortly.",
      functionCall: null
    }
  ];
  
  conversation.forEach((step, index) => {
    console.log(`\nStep ${index + 1}:`);
    console.log(`User: ${step.user}`);
    console.log(`AI: ${step.ai}`);
    if (step.functionCall) {
      console.log(`Function Call: ${step.functionCall}`);
      console.log(`Function Result:`, step.functionResult);
    }
  });
};

// Export examples for testing
export {
  createFunctionExample,
  aiConversationExample,
  realCalComCallExample,
  bookAppointmentExample,
  completeConversationFlow
};

// Usage example:
// import { completeConversationFlow } from './CalComIntegrationExample';
// completeConversationFlow();
