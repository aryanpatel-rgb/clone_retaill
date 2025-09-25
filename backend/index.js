const { initializeDatabase } = require('./database/connection');
const app = require('./server');

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting Retell AI Backend Server...');
    
    // Initialize database tables and sample data
    await initializeDatabase();
    
    console.log('✅ Database initialized successfully');
    console.log('🌐 Server is ready to accept connections');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
