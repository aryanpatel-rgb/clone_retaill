const { Pool } = require('pg');
require('dotenv').config({ path: './config.env' });

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  acquireTimeoutMillis: 10000,
  createTimeoutMillis: 10000,
  destroyTimeoutMillis: 5000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200,
});

// Test database connection
pool.on('connect', (client) => {
  console.log('✅ Connected to NeonDB PostgreSQL');
});

pool.on('error', (err, client) => {
  console.error('❌ Database connection error:', err);
  // Don't exit the process, just log the error
});

pool.on('remove', (client) => {
  console.log('🔌 Database client removed from pool');
});

// Helper function to execute queries with retry logic
const executeQuery = async (query, params = [], retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await pool.query(query, params);
      return result;
    } catch (error) {
      console.error(`Query attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) {
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// Initialize database tables
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    
    // Create agents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        ai_prompt TEXT,
        status VARCHAR(50) DEFAULT 'inactive',
        voice VARCHAR(100) DEFAULT 'Emma',
        language VARCHAR(50) DEFAULT 'English',
        model VARCHAR(100) DEFAULT 'gpt-4',
        api_key VARCHAR(255),
        webhook_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        agent_id VARCHAR(255) REFERENCES agents(agent_id),
        customer_id VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'in_progress',
        duration INTEGER DEFAULT 0,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP,
        transcript TEXT,
        satisfaction INTEGER CHECK (satisfaction >= 1 AND satisfaction <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create analytics table for storing aggregated data
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(255) REFERENCES agents(agent_id),
        date DATE NOT NULL,
        total_calls INTEGER DEFAULT 0,
        successful_calls INTEGER DEFAULT 0,
        failed_calls INTEGER DEFAULT 0,
        avg_duration DECIMAL(10,2) DEFAULT 0,
        total_duration INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agent_id, date)
      )
    `);

    // Create users table for authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create agent_functions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_functions (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(255) REFERENCES agents(agent_id),
        function_type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        config JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create platform_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        settings JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT single_row CHECK (id = 1)
      )
    `);


    // Insert sample data
    await insertSampleData(client);
    
    client.release();
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};

// Insert sample data
const insertSampleData = async (client) => {
  try {
    // Check if sample data already exists
    const agentCheck = await client.query('SELECT COUNT(*) FROM agents');
    if (agentCheck.rows[0].count > 0) {
      console.log('📊 Sample data already exists, skipping...');
      return;
    }

    // Insert sample agents
    const sampleAgents = [
      {
        agent_id: 'agent_1f4d87d98373d631bd8865ff90',
        name: 'Customer Support Agent',
        description: 'Handles customer inquiries and support tickets',
        status: 'active',
        voice: 'Emma',
        language: 'English',
        model: 'gpt-4',
        api_key: 'rt_sk_1234567890abcdef',
        webhook_url: 'https://api.example.com/webhook'
      },
      {
        agent_id: 'agent_2a5e98f29484e742ce9976gg01',
        name: 'Sales Assistant',
        description: 'Qualifies leads and schedules appointments',
        status: 'active',
        voice: 'James',
        language: 'English',
        model: 'gpt-4',
        api_key: 'rt_sk_abcdef1234567890',
        webhook_url: 'https://api.example.com/webhook'
      },
      {
        agent_id: 'agent_3b6f09g40595f853df0087hh12',
        name: 'Appointment Scheduler',
        description: 'Books appointments and manages calendar',
        status: 'paused',
        voice: 'Sarah',
        language: 'English',
        model: 'gpt-3.5-turbo',
        api_key: 'rt_sk_9876543210fedcba',
        webhook_url: 'https://api.example.com/webhook'
      }
    ];

    for (const agent of sampleAgents) {
      await client.query(`
        INSERT INTO agents (agent_id, name, description, status, voice, language, model, api_key, webhook_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (agent_id) DO NOTHING
      `, [agent.agent_id, agent.name, agent.description, agent.status, agent.voice, agent.language, agent.model, agent.api_key, agent.webhook_url]);
    }

    // Insert sample sessions
    const sampleSessions = [
      {
        session_id: 'session_001',
        agent_id: 'agent_1f4d87d98373d631bd8865ff90',
        customer_id: 'cust_12345',
        type: 'call',
        status: 'completed',
        duration: 204,
        start_time: new Date('2024-01-20T14:30:00Z'),
        end_time: new Date('2024-01-20T14:33:24Z'),
        transcript: 'Customer called about billing issue. Agent resolved the problem successfully.',
        satisfaction: 5
      },
      {
        session_id: 'session_002',
        agent_id: 'agent_2a5e98f29484e742ce9976gg01',
        customer_id: 'cust_12346',
        type: 'chat',
        status: 'completed',
        duration: 138,
        start_time: new Date('2024-01-20T15:15:00Z'),
        end_time: new Date('2024-01-20T15:17:18Z'),
        transcript: 'Customer interested in premium plan. Lead qualified successfully.',
        satisfaction: 4
      },
      {
        session_id: 'session_003',
        agent_id: 'agent_3b6f09g40595f853df0087hh12',
        customer_id: 'cust_12347',
        type: 'call',
        status: 'failed',
        duration: 45,
        start_time: new Date('2024-01-20T16:00:00Z'),
        end_time: new Date('2024-01-20T16:00:45Z'),
        transcript: 'Call dropped due to network issues.',
        satisfaction: null
      }
    ];

    for (const session of sampleSessions) {
      await client.query(`
        INSERT INTO sessions (session_id, agent_id, customer_id, type, status, duration, start_time, end_time, transcript, satisfaction)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (session_id) DO NOTHING
      `, [session.session_id, session.agent_id, session.customer_id, session.type, session.status, session.duration, session.start_time, session.end_time, session.transcript, session.satisfaction]);
    }

    console.log('✅ Sample data inserted successfully');
  } catch (error) {
    console.error('❌ Error inserting sample data:', error);
  }
};

module.exports = { pool, initializeDatabase, executeQuery };