#!/usr/bin/env node

/**
 * Setup script for Chatbot Voice Calling System
 * This script helps configure the voice calling functionality
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Chatbot Voice Calling Setup');
console.log('================================\n');

const questions = [
  {
    key: 'OPENAI_API_KEY',
    question: 'Enter your OpenAI API Key: ',
    required: true
  },
  {
    key: 'TWILIO_ACCOUNT_SID',
    question: 'Enter your Twilio Account SID: ',
    required: true
  },
  {
    key: 'TWILIO_AUTH_TOKEN',
    question: 'Enter your Twilio Auth Token: ',
    required: true
  },
  {
    key: 'TWILIO_PHONE_NUMBER',
    question: 'Enter your Twilio Phone Number (with country code, e.g., +1234567890): ',
    required: true
  },
  {
    key: 'CALCOM_API_KEY',
    question: 'Enter your Cal.com API Key: ',
    required: false,
    default: 'cal_live_7cf677c0602f9a2760f4d79a404916ff'
  },
  {
    key: 'CALCOM_EVENT_ID',
    question: 'Enter your Cal.com Event ID: ',
    required: false,
    default: '3468013'
  },
  {
    key: 'PORT',
    question: 'Enter server port (default: 5000): ',
    required: false,
    default: '5000'
  }
];

const envVars = {};

function askQuestion(index) {
  if (index >= questions.length) {
    createEnvFile();
    return;
  }

  const q = questions[index];
  const prompt = q.required ? q.question : `${q.question} (optional, default: ${q.default}): `;
  
  rl.question(prompt, (answer) => {
    if (q.required && !answer.trim()) {
      console.log('❌ This field is required!');
      askQuestion(index);
    } else {
      envVars[q.key] = answer.trim() || q.default || '';
      askQuestion(index + 1);
    }
  });
}

function createEnvFile() {
  const envContent = Object.entries(envVars)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const envPath = path.join(__dirname, 'server', '.env');
  
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Environment file created successfully!');
    console.log(`📁 Location: ${envPath}`);
    
    // Check if node_modules exists
    const nodeModulesPath = path.join(__dirname, 'server', 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('\n📦 Installing dependencies...');
      console.log('Run: cd chatbot/server && npm install');
    } else {
      console.log('\n🎉 Setup complete!');
      console.log('\nTo start the server:');
      console.log('cd chatbot/server && npm start');
      console.log('\nTo start in development mode:');
      console.log('cd chatbot/server && npm run dev');
    }
    
    console.log('\n📞 Voice Calling Features:');
    console.log('- Make voice calls from chat interface');
    console.log('- AI-powered voice conversations');
    console.log('- Cal.com appointment booking via voice');
    console.log('- Real-time speech recognition');
    
  } catch (error) {
    console.error('❌ Error creating environment file:', error.message);
  }
  
  rl.close();
}

// Start the setup process
askQuestion(0);
