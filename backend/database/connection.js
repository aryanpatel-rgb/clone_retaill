const { Pool } = require('pg');
require('dotenv').config();

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
        status VARCHAR(50) DEFAULT 'active',
        company VARCHAR(255),
        preferences JSONB,
        avatar VARCHAR(255),
        last_login TIMESTAMP,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns to users table (migration for existing tables)
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'active\'');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(255)');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255)');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP');
    } catch (migrationError) {
      console.log('ℹ️  Users table migration note:', migrationError.message);
    }

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

    // Ensure is_active column exists (migration for existing tables)
    try {
      await client.query('ALTER TABLE agent_functions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
    } catch (migrationError) {
      console.log('ℹ️  Migration note:', migrationError.message);
    }

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

    // Create contacts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        email VARCHAR(255),
        company VARCHAR(255),
        notes TEXT,
        tags TEXT[],
        is_verified BOOLEAN DEFAULT false,
        verification_status VARCHAR(50) DEFAULT 'pending',
        last_called TIMESTAMP,
        call_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(phone_number)
      )
    `);

    // Create calls table
    await client.query(`
      CREATE TABLE IF NOT EXISTS calls (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        customer_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'initiated',
        twilio_call_sid VARCHAR(255),
        duration INTEGER DEFAULT 0,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
      )
    `);

    // Create conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(255) PRIMARY KEY,
        call_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (call_id) REFERENCES calls(id)
      )
    `);

    // Create appointment_bookings table for Cal.com integration
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointment_bookings (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        booking_id VARCHAR(255) UNIQUE,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        customer_phone VARCHAR(20),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled',
        provider VARCHAR(50) DEFAULT 'calcom',
        event_type_id VARCHAR(255),
        timezone VARCHAR(50) DEFAULT 'UTC',
        notes TEXT,
        confirmation_sent BOOLEAN DEFAULT false,
        reminder_sent BOOLEAN DEFAULT false,
        call_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(agent_id),
        FOREIGN KEY (call_id) REFERENCES calls(id)
      )
    `);

    // Create availability_cache table for performance
    await client.query(`
      CREATE TABLE IF NOT EXISTS availability_cache (
        id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        event_type_id VARCHAR(255),
        date DATE NOT NULL,
        cached_slots JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
      )
    `);

    // Create booking_reminders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_reminders (
        id VARCHAR(255) PRIMARY KEY,
        booking_id VARCHAR(255) NOT NULL,
        reminder_type VARCHAR(50) NOT NULL,
        scheduled_time TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES appointment_bookings(id)
      )
    `);


    // Create indexes for performance
    await createIndexes(client);
    
    // Cleanup old tables
    await cleanupDynamicForms(client);
    
    client.release();
    console.log('✅ Database tables and indexes initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};

// Create database indexes for performance
const createIndexes = async (client) => {
  try {
    console.log('🔍 Creating database indexes...');
    
    // Agents table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents(created_at)');
    
    // Sessions table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions(customer_id)');
    
    // Analytics table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_analytics_agent_id ON analytics(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date)');
    
    // Users table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    
    // Agent functions table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_agent_functions_agent_id ON agent_functions(agent_id)');
    
    // Check if is_active column exists before creating index
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_agent_functions_is_active ON agent_functions(is_active)');
    } catch (indexError) {
      console.log('ℹ️  is_active column may not exist in agent_functions table:', indexError.message);
    }
    
    // Contacts table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_contacts_is_verified ON contacts(is_verified)');
    
    // Calls table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_calls_phone_number ON calls(phone_number)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid)');
    
    // Conversations table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_conversations_call_id ON conversations(call_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)');
    
    // Appointment bookings table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointment_bookings_agent_id ON appointment_bookings(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointment_bookings_booking_id ON appointment_bookings(booking_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointment_bookings_start_time ON appointment_bookings(start_time)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointment_bookings_status ON appointment_bookings(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointment_bookings_customer_email ON appointment_bookings(customer_email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointment_bookings_provider ON appointment_bookings(provider)');
    
    // Availability cache table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_availability_cache_agent_id ON availability_cache(agent_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_availability_cache_date ON availability_cache(date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_availability_cache_expires_at ON availability_cache(expires_at)');
    
    // Booking reminders table indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_booking_reminders_booking_id ON booking_reminders(booking_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_booking_reminders_scheduled_time ON booking_reminders(scheduled_time)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_booking_reminders_status ON booking_reminders(status)');
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
};

// Cleanup: Remove dynamic_forms table if it exists
const cleanupDynamicForms = async (client) => {
  try {
    console.log('🧹 Cleaning up: Removing dynamic_forms table...');
    
    // Drop the foreign key constraint first
    await client.query(`
      ALTER TABLE dynamic_forms DROP CONSTRAINT IF EXISTS dynamic_forms_agent_id_fkey
    `);
    
    // Drop the dynamic_forms table
    await client.query(`
      DROP TABLE IF EXISTS dynamic_forms
    `);
    
    console.log('✅ dynamic_forms table removed successfully');
  } catch (error) {
    console.log('ℹ️  dynamic_forms table cleanup:', error.message);
  }
};

module.exports = { pool, initializeDatabase, executeQuery };