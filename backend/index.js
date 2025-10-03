const { initializeDatabase } = require('./database/connection');
const app = require('./server');
const customFunctionService = require('./services/customFunctionService');

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting Retell AI Backend Server...');
    
    // Initialize database tables and sample data
    await initializeDatabase();
    
    // Load user's custom functions from database
    await customFunctionService.loadFunctionsFromDatabase();
    
    console.log('✅ Database initialized successfully');
    console.log('✅ Custom functions loaded successfully');
    console.log('🌐 Server is ready to accept connections');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
