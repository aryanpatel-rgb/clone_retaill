import React, { useState } from 'react';
import { FileText, Copy, RotateCcw } from 'lucide-react';

const PromptEditor = ({ prompt, onChange }) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
  };

  const handleReset = () => {
    const defaultPrompt = `ROLE: Anna – Friendly, professional voice assistant from Textdrip, and instantly book a time slot.

CRITICAL: Today is ${new Date().toISOString().split('T')[0]}. Tomorrow is ${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}. NEVER use old dates like 2022-03-06 or 2022-09-15.

GOALS:
1. Verify lead info.
3. Handle "not a good time" by scheduling callback.
4. Quickly capture preferred time → book directly when you have all info → recap.
5. Keep conversation short, natural, and accurate.

AVAILABLE FUNCTIONS:
- check_availability_cal: Use FIRST when user provides a specific time to verify availability, or when user asks "what's available?"
- book_appointment_cal: Use AFTER checking availability and getting user confirmation to book
- get_slots_cal: Get available time slots

CRITICAL BOOKING LOGIC:
- When user provides a specific time (like "3 pm", "tomorrow 3 pm", "2:30 PM"), FIRST use check_availability_cal to verify the time is available
- If the time is available, ask for permission to book it
- When user says "yes", "book it", "confirm", "proceed" → IMMEDIATELY use book_appointment_cal
- NEVER call check_availability_cal again after user confirms booking
- If user asks "what's available?" without specific time → check_availability_cal for general availability

CONVERSATION FLOW:
1. Greet warmly 
2. Get customer details (name, email)
3. Ask for preferred date/time
4. If user provides specific time → check_availability_cal first
5. If time is available → ask permission to book
6. If user confirms → book_appointment_cal
7. Confirm all details and end politely

TONE: Professional, friendly, efficient, helpful`;
    onChange(defaultPrompt);
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-gray-500 mr-2" />
          <span className="text-sm font-medium text-gray-700">Agent Instructions</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </button>
          <button
            onClick={handleReset}
            className="flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </button>
        </div>
      </div>

      {/* Prompt Editor */}
      <div className="relative">
        {isEditing ? (
          <textarea
            value={prompt}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setIsEditing(false)}
            className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Enter your agent prompt here..."
            autoFocus
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm bg-gray-50 cursor-text overflow-y-auto whitespace-pre-wrap"
          >
            {prompt || 'Click to edit your agent prompt...'}
          </div>
        )}
      </div>

      {/* Function Usage Hints */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Available Functions in Prompt:</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div><code className="bg-blue-100 px-1 rounded">check_availability_cal</code> - Check calendar availability</div>
          <div><code className="bg-blue-100 px-1 rounded">book_appointment_cal</code> - Book an appointment</div>
          <div><code className="bg-blue-100 px-1 rounded">end_conversation</code> - End the conversation</div>
          <div><code className="bg-blue-100 px-1 rounded">custom_api_call</code> - Make custom API calls</div>
        </div>
      </div>
    </div>
  );
};

export default PromptEditor;
