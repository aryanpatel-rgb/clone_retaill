/**
 * Database Service for Dynamic AI Calling Platform
 * Manages agents, calls, and conversations in SQLite database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/config');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = config.get('database.path');
    this.init();
  }

  /**
   * Initialize database connection and create tables
   */
  async init() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Connect to database
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error('Database connection error', { error: err.message });
          throw err;
        }
        logger.info('Connected to SQLite database', { path: this.dbPath });
      });

      // Create tables
      await this.createTables();
      
    } catch (error) {
      logger.error('Database initialization error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create database tables
   */
  async createTables() {
    const tables = [
      // Agents table
      `CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        prompt TEXT NOT NULL,
        voice_id TEXT,
        model TEXT DEFAULT 'gpt-4o-mini',
        temperature REAL DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 200,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Calls table
      `CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        customer_name TEXT,
        status TEXT DEFAULT 'initiated',
        twilio_call_sid TEXT,
        duration INTEGER DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )`,

      // Conversations table
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        call_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (call_id) REFERENCES calls (id)
      )`,

      // Users table (for future multi-user support)
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Custom functions table (like Retell AI)
      `CREATE TABLE IF NOT EXISTS custom_functions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        api_key TEXT,
        event_type_id TEXT,
        timezone TEXT DEFAULT 'UTC',
        function_type TEXT DEFAULT 'calcom',
        parameters TEXT DEFAULT '{}',
        user_id TEXT DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.runQuery(table);
    }

    logger.info('Database tables created successfully');
  }

  /**
   * Run a database query
   */
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('Database query error', { error: err.message, sql });
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Get a single record
   */
  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Database get error', { error: err.message, sql });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get multiple records
   */
  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database all error', { error: err.message, sql });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Agent Management Methods

  /**
   * Create a new agent
   */
  async createAgent(agentData) {
    const id = uuidv4();
    const { name, description, prompt, voice_id, model, temperature, max_tokens } = agentData;

    const sql = `
      INSERT INTO agents (id, name, description, prompt, voice_id, model, temperature, max_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.runQuery(sql, [id, name, description, prompt, voice_id, model, temperature, max_tokens]);
    
    logger.info('Agent created', { id, name });
    return { id, ...agentData };
  }

  /**
   * Get all agents
   */
  async getAllAgents() {
    const sql = 'SELECT * FROM agents WHERE is_active = 1 ORDER BY created_at DESC';
    return await this.allQuery(sql);
  }

  /**
   * Get agent by ID
   */
  async getAgentById(id) {
    const sql = 'SELECT * FROM agents WHERE id = ? AND is_active = 1';
    return await this.getQuery(sql, [id]);
  }

  /**
   * Update agent
   */
  async updateAgent(id, agentData) {
    const { name, description, prompt, voice_id, model, temperature, max_tokens } = agentData;
    
    const sql = `
      UPDATE agents 
      SET name = ?, description = ?, prompt = ?, voice_id = ?, model = ?, temperature = ?, max_tokens = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_active = 1
    `;

    const result = await this.runQuery(sql, [name, description, prompt, voice_id, model, temperature, max_tokens, id]);
    
    if (result.changes > 0) {
      logger.info('Agent updated', { id, name });
      return await this.getAgentById(id);
    } else {
      throw new Error('Agent not found or not updated');
    }
  }

  /**
   * Delete agent (soft delete)
   */
  async deleteAgent(id) {
    const sql = 'UPDATE agents SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    const result = await this.runQuery(sql, [id]);
    
    if (result.changes > 0) {
      logger.info('Agent deleted', { id });
      return true;
    } else {
      throw new Error('Agent not found');
    }
  }

  // Call Management Methods

  /**
   * Create a new call
   */
  async createCall(callData) {
    const id = uuidv4();
    const { agent_id, phone_number, customer_name, twilio_call_sid } = callData;

    const sql = `
      INSERT INTO calls (id, agent_id, phone_number, customer_name, twilio_call_sid)
      VALUES (?, ?, ?, ?, ?)
    `;

    await this.runQuery(sql, [id, agent_id, phone_number, customer_name, twilio_call_sid]);
    
    logger.info('Call created', { id, agent_id, phone_number });
    return id;
  }

  /**
   * Get call by ID
   */
  async getCallById(id) {
    const sql = 'SELECT * FROM calls WHERE id = ?';
    return await this.getQuery(sql, [id]);
  }

  /**
   * Get call by Twilio Call SID
   */
  async getCallByTwilioSid(twilioCallSid) {
    const sql = 'SELECT * FROM calls WHERE twilio_call_sid = ?';
    return await this.getQuery(sql, [twilioCallSid]);
  }

  /**
   * Update call status
   */
  async updateCallStatus(id, status, additionalData = {}) {
    const { duration, ended_at, twilio_call_sid } = additionalData;
    
    let sql = 'UPDATE calls SET status = ?';
    let params = [status];

    if (duration !== undefined) {
      sql += ', duration = ?';
      params.push(duration);
    }

    if (ended_at !== undefined) {
      sql += ', ended_at = ?';
      params.push(ended_at);
    }

    if (twilio_call_sid !== undefined) {
      sql += ', twilio_call_sid = ?';
      params.push(twilio_call_sid);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    const result = await this.runQuery(sql, params);
    
    if (result.changes > 0) {
      logger.info('Call status updated', { id, status });
      return await this.getCallById(id);
    } else {
      logger.warn('Call not found for update', { id, status });
      return null; // Return null instead of throwing error
    }
  }

  /**
   * Get call by ID
   */
  async getCallById(id) {
    const sql = 'SELECT * FROM calls WHERE id = ?';
    return await this.getQuery(sql, [id]);
  }

  /**
   * Get all calls for an agent
   */
  async getCallsByAgent(agentId, limit = 50) {
    const sql = `
      SELECT * FROM calls 
      WHERE agent_id = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `;
    return await this.allQuery(sql, [agentId, limit]);
  }

  // Conversation Management Methods

  /**
   * Add conversation message
   */
  async addConversationMessage(callId, role, content) {
    const id = uuidv4();
    
    const sql = `
      INSERT INTO conversations (id, call_id, role, content)
      VALUES (?, ?, ?, ?)
    `;

    await this.runQuery(sql, [id, callId, role, content]);
    
    logger.info('Conversation message added', { callId, role, contentLength: content.length });
    return { id, callId, role, content };
  }

  /**
   * Get conversation history for a call
   */
  async getConversationHistory(callId) {
    const sql = `
      SELECT * FROM conversations 
      WHERE call_id = ? 
      ORDER BY timestamp ASC
    `;
    return await this.allQuery(sql, [callId]);
  }

  // Statistics Methods

  /**
   * Get platform statistics
   */
  async getPlatformStats() {
    const stats = {};

    // Total agents
    const agentCount = await this.getQuery('SELECT COUNT(*) as count FROM agents WHERE is_active = 1');
    stats.totalAgents = agentCount.count;

    // Total calls
    const callCount = await this.getQuery('SELECT COUNT(*) as count FROM calls');
    stats.totalCalls = callCount.count;

    // Active calls
    const activeCallCount = await this.getQuery('SELECT COUNT(*) as count FROM calls WHERE status IN ("initiated", "in_progress")');
    stats.activeCalls = activeCallCount.count;

    // Total conversation messages
    const messageCount = await this.getQuery('SELECT COUNT(*) as count FROM conversations');
    stats.totalMessages = messageCount.count;

    return stats;
  }

  /**
   * Get agent statistics
   */
  async getAgentStats(agentId) {
    const stats = {};

    // Total calls for this agent
    const callCount = await this.getQuery('SELECT COUNT(*) as count FROM calls WHERE agent_id = ?', [agentId]);
    stats.totalCalls = callCount.count;

    // Average call duration
    const avgDuration = await this.getQuery('SELECT AVG(duration) as avg FROM calls WHERE agent_id = ? AND duration > 0', [agentId]);
    stats.averageDuration = Math.round(avgDuration.avg || 0);

    // Success rate (calls that ended successfully)
    const successCount = await this.getQuery('SELECT COUNT(*) as count FROM calls WHERE agent_id = ? AND status = "completed"', [agentId]);
    stats.successRate = callCount.count > 0 ? Math.round((successCount.count / callCount.count) * 100) : 0;

    return stats;
  }

  // =============================================================================
  // CUSTOM FUNCTIONS CRUD METHODS (like Retell AI)
  // =============================================================================

  /**
   * Create a custom function
   */
  async createCustomFunction(functionData) {
    const {
      id,
      name,
      description,
      apiKey,
      eventTypeId,
      timezone = 'UTC',
      functionType = 'calcom',
      parameters = {},
      userId = 'default'
    } = functionData;

    const sql = `
      INSERT INTO custom_functions (
        id, name, description, api_key, event_type_id, 
        timezone, function_type, parameters, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      name,
      description,
      apiKey,
      eventTypeId,
      timezone,
      functionType,
      JSON.stringify(parameters),
      userId
    ];

    await this.runQuery(sql, params);
    return functionData;
  }

  /**
   * Get all custom functions for a user
   */
  async getCustomFunctions(userId = 'default') {
    const sql = 'SELECT * FROM custom_functions WHERE user_id = ? ORDER BY created_at DESC';
    const functions = await this.allQuery(sql, [userId]);
    
    // Parse JSON parameters
    return functions.map(func => ({
      ...func,
      parameters: JSON.parse(func.parameters || '{}')
    }));
  }

  /**
   * Get a custom function by ID
   */
  async getCustomFunction(functionId) {
    const sql = 'SELECT * FROM custom_functions WHERE id = ?';
    const functionData = await this.getQuery(sql, [functionId]);
    
    if (functionData) {
      functionData.parameters = JSON.parse(functionData.parameters || '{}');
    }
    
    return functionData;
  }

  /**
   * Get a custom function by name
   */
  async getCustomFunctionByName(functionName) {
    const sql = 'SELECT * FROM custom_functions WHERE name = ?';
    const functionData = await this.getQuery(sql, [functionName]);
    
    if (functionData) {
      functionData.parameters = JSON.parse(functionData.parameters || '{}');
    }
    
    return functionData;
  }

  /**
   * Update a custom function
   */
  async updateCustomFunction(functionId, updateData) {
    const {
      name,
      description,
      apiKey,
      eventTypeId,
      timezone,
      functionType,
      parameters
    } = updateData;

    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      values.push(description);
    }
    if (apiKey !== undefined) {
      fields.push('api_key = ?');
      values.push(apiKey);
    }
    if (eventTypeId !== undefined) {
      fields.push('event_type_id = ?');
      values.push(eventTypeId);
    }
    if (timezone !== undefined) {
      fields.push('timezone = ?');
      values.push(timezone);
    }
    if (functionType !== undefined) {
      fields.push('function_type = ?');
      values.push(functionType);
    }
    if (parameters !== undefined) {
      fields.push('parameters = ?');
      values.push(JSON.stringify(parameters));
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(functionId);

    const sql = `UPDATE custom_functions SET ${fields.join(', ')} WHERE id = ?`;
    await this.runQuery(sql, values);

    return await this.getCustomFunction(functionId);
  }

  /**
   * Delete a custom function
   */
  async deleteCustomFunction(functionId) {
    const sql = 'DELETE FROM custom_functions WHERE id = ?';
    const result = await this.runQuery(sql, [functionId]);
    return result.changes > 0;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          logger.error('Database close error', { error: err.message });
        } else {
          logger.info('Database connection closed');
        }
      });
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;
