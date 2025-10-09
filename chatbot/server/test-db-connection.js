const { Pool } = require('pg');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 Testing NeonDB Connection...');
  console.log('DATABASE_URL length:', process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 'Missing');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment variables');
    return;
  }

  // Mask sensitive parts of the URL for logging
  const maskedUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@');
  console.log('Connection string:', maskedUrl);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 1,
    connectionTimeoutMillis: 10000, // 10 seconds timeout
    idleTimeoutMillis: 30000,
  });

  try {
    console.log('⏳ Attempting to connect...');
    const client = await pool.connect();
    console.log('✅ Connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    console.log('📅 Current time:', result.rows[0].current_time);
    console.log('🐘 PostgreSQL version:', result.rows[0].postgres_version);
    
    client.release();
    await pool.end();
    console.log('✅ Connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    if (error.code === 'ENOTFOUND') {
      console.error('💡 This usually means the hostname is incorrect');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 This usually means the port is blocked or incorrect');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('💡 This usually means a network timeout - check your internet connection');
    } else if (error.message.includes('authentication failed')) {
      console.error('💡 This usually means the username/password is incorrect');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.error('💡 This usually means the database name is incorrect');
    }
    
    await pool.end();
    process.exit(1);
  }
}

testDatabaseConnection();
