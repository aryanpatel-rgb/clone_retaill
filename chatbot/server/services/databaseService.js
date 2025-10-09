const { Pool } = require('pg');
const logger = require('./logger');

/**
 * Database Service for NeonDB PostgreSQL
 * Handles all database operations for voice calling system
 */
class DatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    try {
      // Create connection pool
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // Required for NeonDB
        },
        max: 20, // Maximum number of connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000, // Increased to 15 seconds
        query_timeout: 10000, // 10 seconds for queries
        statement_timeout: 10000, // 10 seconds for statements
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connection established successfully');
      
      // Create tables
      await this.createTables();
      
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  /**
   * Create all necessary tables
   */
  async createTables() {
    try {
      // Users table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          calcom_api_key VARCHAR(255),
          calcom_event_id VARCHAR(50),
          openai_api_key VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        )
      `);

      // Voice calls table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS voice_calls (
          id SERIAL PRIMARY KEY,
          call_id VARCHAR(255) UNIQUE NOT NULL,
          call_sid VARCHAR(255),
          phone_number VARCHAR(20) NOT NULL,
          customer_name VARCHAR(255),
          agent_prompt TEXT,
          calcom_api_key VARCHAR(255),
          calcom_event_id VARCHAR(255),
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(50) DEFAULT 'initiated',
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP,
          duration INTEGER,
          twilio_status VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Voice conversations table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS voice_conversations (
          id SERIAL PRIMARY KEY,
          call_id VARCHAR(255) NOT NULL,
          message_type VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
          content TEXT NOT NULL,
          function_call JSONB,
          function_result JSONB,
          context JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (call_id) REFERENCES voice_calls(call_id) ON DELETE CASCADE
        )
      `);

      // Chat sessions table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) UNIQUE NOT NULL,
          agent_prompt TEXT,
          calcom_api_key VARCHAR(255),
          calcom_event_id VARCHAR(255),
          openai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          message_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Chat messages table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL,
          message_type VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
          content TEXT NOT NULL,
          function_call JSONB,
          function_result JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
        )
      `);

      // Agent configurations table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS agent_configurations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          prompt TEXT NOT NULL,
          calcom_api_key VARCHAR(255),
          calcom_event_id VARCHAR(255),
          custom_functions JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Call analytics table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS call_analytics (
          id SERIAL PRIMARY KEY,
          call_id VARCHAR(255) NOT NULL,
          event_type VARCHAR(100) NOT NULL, -- 'call_started', 'call_ended', 'appointment_booked', etc.
          event_data JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (call_id) REFERENCES voice_calls(call_id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_voice_calls_phone_number ON voice_calls(phone_number);
        CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(status);
        CREATE INDEX IF NOT EXISTS idx_voice_calls_created_at ON voice_calls(created_at);
        CREATE INDEX IF NOT EXISTS idx_voice_conversations_call_id ON voice_conversations(call_id);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_call_analytics_call_id ON call_analytics(call_id);
        CREATE INDEX IF NOT EXISTS idx_call_analytics_event_type ON call_analytics(event_type);
      `);

      logger.info('Database tables created successfully');
      
    } catch (error) {
      logger.error('Failed to create database tables:', error);
      throw error;
    }
  }

  /**
   * Save voice call record
   */
  async saveVoiceCall(callData) {
    try {
      const query = `
        INSERT INTO voice_calls (
          call_id, call_sid, phone_number, customer_name, agent_prompt,
          calcom_api_key, calcom_event_id, status, twilio_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        callData.callId,
        callData.callSid,
        callData.phoneNumber,
        callData.customerName,
        callData.agentPrompt,
        callData.calcomApiKey,
        callData.calcomEventId,
        callData.status || 'initiated',
        callData.twilioStatus
      ];

      const result = await this.pool.query(query, values);
      logger.info('Voice call saved to database', { callId: callData.callId });
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to save voice call:', error);
      throw error;
    }
  }

  /**
   * Update voice call status
   */
  async updateVoiceCallStatus(callId, status, additionalData = {}) {
    try {
      const query = `
        UPDATE voice_calls 
        SET status = $1, twilio_status = $2, end_time = $3, duration = $4, updated_at = CURRENT_TIMESTAMP
        WHERE call_id = $5
        RETURNING *
      `;
      
      const values = [
        status,
        additionalData.twilioStatus,
        additionalData.endTime || (status === 'completed' ? new Date() : null),
        additionalData.duration,
        callId
      ];

      const result = await this.pool.query(query, values);
      
      if (result.rows.length > 0) {
        logger.info('Voice call status updated', { callId, status });
        return result.rows[0];
      } else {
        logger.warn('Voice call not found for update', { callId });
        return null;
      }
      
    } catch (error) {
      logger.error('Failed to update voice call status:', error);
      throw error;
    }
  }

  /**
   * Save voice conversation message
   */
  async saveVoiceConversation(callId, messageType, content, functionCall = null, functionResult = null, context = null) {
    try {
      const query = `
        INSERT INTO voice_conversations (
          call_id, message_type, content, function_call, function_result, context
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const values = [
        callId,
        messageType,
        content,
        functionCall ? JSON.stringify(functionCall) : null,
        functionResult ? JSON.stringify(functionResult) : null,
        context ? JSON.stringify(context) : null
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to save voice conversation:', error);
      throw error;
    }
  }

  /**
   * Get voice call with conversations
   */
  async getVoiceCallWithConversations(callId) {
    try {
      const callQuery = 'SELECT * FROM voice_calls WHERE call_id = $1';
      const callResult = await this.pool.query(callQuery, [callId]);
      
      if (callResult.rows.length === 0) {
        return null;
      }

      const conversationQuery = `
        SELECT * FROM voice_conversations 
        WHERE call_id = $1 
        ORDER BY timestamp ASC
      `;
      const conversationResult = await this.pool.query(conversationQuery, [callId]);

      return {
        call: callResult.rows[0],
        conversations: conversationResult.rows
      };
      
    } catch (error) {
      logger.error('Failed to get voice call with conversations:', error);
      throw error;
    }
  }

  /**
   * Save chat session
   */
  async saveChatSession(sessionData) {
    try {
      const query = `
        INSERT INTO chat_sessions (
          session_id, agent_prompt, calcom_api_key, calcom_event_id, openai_model
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [
        sessionData.sessionId,
        sessionData.agentPrompt,
        sessionData.calcomApiKey,
        sessionData.calcomEventId,
        sessionData.openaiModel || 'gpt-4o-mini'
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to save chat session:', error);
      throw error;
    }
  }

  /**
   * Save chat message
   */
  async saveChatMessage(sessionId, messageType, content, functionCall = null, functionResult = null) {
    try {
      const query = `
        INSERT INTO chat_messages (
          session_id, message_type, content, function_call, function_result
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [
        sessionId,
        messageType,
        content,
        functionCall ? JSON.stringify(functionCall) : null,
        functionResult ? JSON.stringify(functionResult) : null
      ];

      const result = await this.pool.query(query, values);
      
      // Update session message count and last activity
      await this.pool.query(`
        UPDATE chat_sessions 
        SET message_count = message_count + 1, last_activity = CURRENT_TIMESTAMP
        WHERE session_id = $1
      `, [sessionId]);
      
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to save chat message:', error);
      throw error;
    }
  }

  /**
   * Get recent voice calls
   */
  async getRecentVoiceCalls(limit = 50) {
    try {
      const query = `
        SELECT vc.*, 
               COUNT(vconv.id) as conversation_count,
               MAX(vconv.timestamp) as last_conversation_time
        FROM voice_calls vc
        LEFT JOIN voice_conversations vconv ON vc.call_id = vconv.call_id
        GROUP BY vc.id
        ORDER BY vc.created_at DESC
        LIMIT $1
      `;
      
      const result = await this.pool.query(query, [limit]);
      return result.rows;
      
    } catch (error) {
      logger.error('Failed to get recent voice calls:', error);
      throw error;
    }
  }

  /**
   * Get call analytics
   */
  async getCallAnalytics(timeframe = '24h') {
    try {
      let timeCondition = '';
      if (timeframe === '24h') {
        timeCondition = "WHERE created_at >= NOW() - INTERVAL '24 hours'";
      } else if (timeframe === '7d') {
        timeCondition = "WHERE created_at >= NOW() - INTERVAL '7 days'";
      } else if (timeframe === '30d') {
        timeCondition = "WHERE created_at >= NOW() - INTERVAL '30 days'";
      }

      const query = `
        SELECT 
          status,
          COUNT(*) as total_calls,
          AVG(duration) as avg_duration,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_calls,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls
        FROM voice_calls 
        ${timeCondition}
        GROUP BY status
        ORDER BY total_calls DESC
      `;
      
      const result = await this.pool.query(query);
      return result.rows;
      
    } catch (error) {
      logger.error('Failed to get call analytics:', error);
      throw error;
    }
  }

  /**
   * Log call analytics event
   */
  async logCallAnalytics(callId, eventType, eventData = {}) {
    try {
      const query = `
        INSERT INTO call_analytics (call_id, event_type, event_data)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      
      const values = [
        callId,
        eventType,
        JSON.stringify(eventData)
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to log call analytics:', error);
      throw error;
    }
  }

  // ========================================
  // USER MANAGEMENT METHODS
  // ========================================

  /**
   * Create a new user
   */
  async createUser(userData) {
    try {
      const query = `
        INSERT INTO users (username, email, password_hash, calcom_api_key, calcom_event_id, openai_api_key)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username, email, created_at, is_active
      `;
      
      const values = [
        userData.username,
        userData.email,
        userData.passwordHash,
        userData.calcomApiKey || null,
        userData.calcomEventId || null,
        userData.openaiApiKey || null
      ];

      const result = await this.pool.query(query, values);
      logger.info('User created successfully', { userId: result.rows[0].id, username: result.rows[0].username });
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    try {
      const query = `
        SELECT id, username, email, password_hash, calcom_api_key, calcom_event_id, 
               openai_api_key, created_at, updated_at, last_login, is_active
        FROM users 
        WHERE email = $1 AND is_active = true
      `;
      
      const result = await this.pool.query(query, [email]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Failed to get user by email:', error);
      throw error;
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username) {
    try {
      const query = `
        SELECT id, username, email, password_hash, calcom_api_key, calcom_event_id, 
               openai_api_key, created_at, updated_at, last_login, is_active
        FROM users 
        WHERE username = $1 AND is_active = true
      `;
      
      const result = await this.pool.query(query, [username]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Failed to get user by username:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const query = `
        SELECT id, username, email, calcom_api_key, calcom_event_id, 
               openai_api_key, created_at, updated_at, last_login, is_active
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  /**
   * Update user's last login time
   */
  async updateLastLogin(userId) {
    try {
      const query = `
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING last_login
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows[0].last_login;
      
    } catch (error) {
      logger.error('Failed to update last login:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (updateData.username !== undefined) {
        fields.push(`username = $${paramCount++}`);
        values.push(updateData.username);
      }
      if (updateData.email !== undefined) {
        fields.push(`email = $${paramCount++}`);
        values.push(updateData.email);
      }
      if (updateData.calcomApiKey !== undefined) {
        fields.push(`calcom_api_key = $${paramCount++}`);
        values.push(updateData.calcomApiKey);
      }
      if (updateData.calcomEventId !== undefined) {
        fields.push(`calcom_event_id = $${paramCount++}`);
        values.push(updateData.calcomEventId);
      }
      if (updateData.openaiApiKey !== undefined) {
        fields.push(`openai_api_key = $${paramCount++}`);
        values.push(updateData.openaiApiKey);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const query = `
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, email, calcom_api_key, calcom_event_id, openai_api_key, updated_at
      `;

      const result = await this.pool.query(query, values);
      logger.info('User profile updated successfully', { userId, updatedFields: fields.length });
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updateUserPassword(userId, newPasswordHash) {
    try {
      const query = `
        UPDATE users 
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, username, email
      `;
      
      const result = await this.pool.query(query, [newPasswordHash, userId]);
      logger.info('User password updated successfully', { userId: result.rows[0].id });
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to update user password:', error);
      throw error;
    }
  }

  /**
   * Check if email exists
   */
  async emailExists(email) {
    try {
      const query = `SELECT COUNT(*) as count FROM users WHERE email = $1`;
      const result = await this.pool.query(query, [email]);
      return parseInt(result.rows[0].count) > 0;
      
    } catch (error) {
      logger.error('Failed to check if email exists:', error);
      throw error;
    }
  }

  /**
   * Check if username exists
   */
  async usernameExists(username) {
    try {
      const query = `SELECT COUNT(*) as count FROM users WHERE username = $1`;
      const result = await this.pool.query(query, [username]);
      return parseInt(result.rows[0].count) > 0;
      
    } catch (error) {
      logger.error('Failed to check if username exists:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM voice_calls WHERE user_id = $1) as total_calls,
          (SELECT COUNT(*) FROM chat_sessions WHERE user_id = $1) as total_chat_sessions,
          (SELECT COUNT(*) FROM voice_calls WHERE user_id = $1 AND status = 'completed') as completed_calls,
          (SELECT COUNT(*) FROM chat_sessions WHERE user_id = $1 AND last_activity > CURRENT_TIMESTAMP - INTERVAL '24 hours') as active_sessions_today
      `;
      
      const result = await this.pool.query(query, [userId]);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to get user stats:', error);
      throw error;
    }
  }

  /**
   * Create or update chat session
   */
  async createOrUpdateChatSession(sessionId, sessionData) {
    try {
      const query = `
        INSERT INTO chat_sessions (session_id, agent_prompt, calcom_api_key, calcom_event_id, user_id, message_count)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (session_id) 
        DO UPDATE SET 
          last_activity = CURRENT_TIMESTAMP,
          message_count = $6,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const values = [
        sessionId,
        sessionData.agentPrompt,
        sessionData.calcomApiKey,
        sessionData.calcomEventId,
        sessionData.userId,
        sessionData.messageCount
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to create/update chat session:', error);
      throw error;
    }
  }

  /**
   * Store chat message
   */
  async storeChatMessage(sessionId, messageType, content, functionCall = null, functionResult = null) {
    try {
      const query = `
        INSERT INTO chat_messages (session_id, message_type, content, function_call, function_result)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [
        sessionId,
        messageType,
        content,
        functionCall ? JSON.stringify(functionCall) : null,
        functionResult ? JSON.stringify(functionResult) : null
      ];

      const result = await this.pool.query(query, values);
      return result.rows[0];
      
    } catch (error) {
      logger.error('Failed to store chat message:', error);
      throw error;
    }
  }

  /**
   * Get user's chat sessions
   */
  async getUserChatSessions(userId, limit = 20, offset = 0) {
    try {
      const query = `
        SELECT * FROM chat_sessions 
        WHERE user_id = $1 
        ORDER BY last_activity DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await this.pool.query(query, [userId, limit, offset]);
      return result.rows;
      
    } catch (error) {
      logger.error('Failed to get user chat sessions:', error);
      throw error;
    }
  }

  /**
   * Get chat session messages
   */
  async getChatSessionMessages(sessionId, limit = 100) {
    try {
      const query = `
        SELECT * FROM chat_messages 
        WHERE session_id = $1 
        ORDER BY timestamp ASC 
        LIMIT $2
      `;
      
      const result = await this.pool.query(query, [sessionId, limit]);
      return result.rows;
      
    } catch (error) {
      logger.error('Failed to get chat session messages:', error);
      throw error;
    }
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Delete old voice calls and related data
      await this.pool.query(`
        DELETE FROM voice_calls 
        WHERE created_at < $1
      `, [cutoffDate]);

      // Delete old chat sessions and related data
      await this.pool.query(`
        DELETE FROM chat_sessions 
        WHERE created_at < $1
      `, [cutoffDate]);

      // Delete old analytics
      await this.pool.query(`
        DELETE FROM call_analytics 
        WHERE timestamp < $1
      `, [cutoffDate]);

      logger.info('Old data cleanup completed', { cutoffDate, daysToKeep });
      
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connection closed');
    }
  }

  /**
   * Get connection status
   */
  isDatabaseConnected() {
    return this.isConnected;
  }
}

module.exports = new DatabaseService();
