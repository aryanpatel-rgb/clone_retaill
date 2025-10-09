#!/usr/bin/env node

/**
 * Ngrok Setup Script for Chatbot Voice Calling
 * This script helps set up ngrok for Twilio webhooks
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🌐 Ngrok Setup for Twilio Voice Calling');
console.log('======================================\n');

console.log('📋 Steps to set up ngrok for Twilio:');
console.log('');
console.log('1. Install ngrok:');
console.log('   - Download from: https://ngrok.com/download');
console.log('   - Or use: npm install -g ngrok');
console.log('');
console.log('2. Create free ngrok account at: https://ngrok.com');
console.log('3. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken');
console.log('');

rl.question('Do you want to install ngrok now? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    installNgrok();
  } else {
    manualSetup();
  }
});

function installNgrok() {
  console.log('\n📦 Installing ngrok...');
  
  const installProcess = spawn('npm', ['install', '-g', 'ngrok'], {
    stdio: 'inherit',
    shell: true
  });

  installProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Ngrok installed successfully!');
      setupNgrokAuth();
    } else {
      console.log('❌ Failed to install ngrok. Please install manually.');
      manualSetup();
    }
  });
}

function setupNgrokAuth() {
  console.log('\n🔑 Ngrok Authentication Setup');
  console.log('1. Go to: https://dashboard.ngrok.com/get-started/your-authtoken');
  console.log('2. Copy your authtoken');
  console.log('');
  
  rl.question('Enter your ngrok authtoken: ', (authtoken) => {
    if (authtoken.trim()) {
      const authProcess = spawn('ngrok', ['config', 'add-authtoken', authtoken.trim()], {
        stdio: 'inherit',
        shell: true
      });

      authProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Ngrok authtoken configured successfully!');
          createStartScript();
        } else {
          console.log('❌ Failed to configure authtoken. Please run manually:');
          console.log(`   ngrok config add-authtoken ${authtoken.trim()}`);
          manualSetup();
        }
      });
    } else {
      console.log('❌ No authtoken provided.');
      manualSetup();
    }
  });
}

function createStartScript() {
  const startScript = `#!/bin/bash
# Start ngrok tunnel for Twilio webhooks
echo "🌐 Starting ngrok tunnel for Twilio webhooks..."
echo "📱 Make sure your chatbot server is running on port 5001"
echo ""

# Start ngrok tunnel on port 5001
ngrok http 5001

echo ""
echo "📋 Next steps:"
echo "1. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)"
echo "2. Update your .env file with: FRONTEND_URL=https://abc123.ngrok.io"
echo "3. Restart your chatbot server"
echo "4. Test voice calling!"
`;

  const startScriptPath = path.join(__dirname, 'start-ngrok.sh');
  
  try {
    fs.writeFileSync(startScriptPath, startScript);
    console.log('\n✅ Ngrok start script created!');
    console.log(`📁 Location: ${startScriptPath}`);
    console.log('\n🚀 To start ngrok tunnel:');
    console.log('   ./start-ngrok.sh');
    console.log('\n📋 Or manually:');
    console.log('   ngrok http 5001');
    
    createEnvTemplate();
  } catch (error) {
    console.error('❌ Error creating start script:', error.message);
    manualSetup();
  }
}

function createEnvTemplate() {
  const envTemplate = `# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Twilio Configuration for Voice Calling
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Cal.com Configuration
CALCOM_API_KEY=your-calcom-api-key
CALCOM_EVENT_ID=your-calcom-event-id

# Server Configuration
PORT=5001
FRONTEND_URL=https://your-ngrok-url.ngrok.io

# Logging
LOG_LEVEL=info

# IMPORTANT: Replace 'your-ngrok-url.ngrok.io' with your actual ngrok URL!
# Get this URL by running: ngrok http 5001
`;

  const envPath = path.join(__dirname, 'server', '.env.example');
  
  try {
    fs.writeFileSync(envPath, envTemplate);
    console.log('\n✅ Environment template created!');
    console.log(`📁 Location: ${envPath}`);
    console.log('\n📝 Update the .env file with your actual ngrok URL!');
    
    console.log('\n🎉 Setup complete! Next steps:');
    console.log('1. Start ngrok: ngrok http 5001');
    console.log('2. Copy the HTTPS URL from ngrok output');
    console.log('3. Update .env file with your ngrok URL');
    console.log('4. Start chatbot server: cd chatbot/server && npm start');
    console.log('5. Test voice calling!');
    
  } catch (error) {
    console.error('❌ Error creating env template:', error.message);
  }
  
  rl.close();
}

function manualSetup() {
  console.log('\n📋 Manual Setup Instructions:');
  console.log('');
  console.log('1. Install ngrok:');
  console.log('   - Download from: https://ngrok.com/download');
  console.log('   - Or: npm install -g ngrok');
  console.log('');
  console.log('2. Create ngrok account:');
  console.log('   - Go to: https://ngrok.com');
  console.log('   - Sign up for free account');
  console.log('');
  console.log('3. Get authtoken:');
  console.log('   - Go to: https://dashboard.ngrok.com/get-started/your-authtoken');
  console.log('   - Copy your authtoken');
  console.log('');
  console.log('4. Configure ngrok:');
  console.log('   - Run: ngrok config add-authtoken YOUR_AUTHTOKEN');
  console.log('');
  console.log('5. Start ngrok tunnel:');
  console.log('   - Run: ngrok http 5001');
  console.log('   - Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
  console.log('');
  console.log('6. Update .env file:');
  console.log('   - Set FRONTEND_URL=https://your-ngrok-url.ngrok.io');
  console.log('');
  console.log('7. Start chatbot server:');
  console.log('   - cd chatbot/server');
  console.log('   - npm start');
  console.log('');
  console.log('8. Test voice calling!');
  
  rl.close();
}
