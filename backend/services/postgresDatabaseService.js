/**
 * PostgreSQL Database Service for Dynamic AI Calling Platform
 * Manages agents, calls, and conversations in PostgreSQL database
 */

const { pool, executeQuery } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class PostgresDatabaseService {
  constructor() {
    this.pool = pool;
  }

  /**
   * Run a database query with retry logic
   */
  async runQuery(sql, params = []) {
    try {
      const result = await executeQuery(sql, params);
      return { id: result.insertId || result.rows?.[0]?.id, changes: result.rowCount || 0 };
    } catch (error) {
      logger.error('Database query error', { error: error.message, sql });
      throw error;
    }
  }

  /**
   * Get a single record
   */
  async getQuery(sql, params = []) {
    try {
      const result = await executeQuery(sql, params);
      return result.rows?.[0] || null;
    } catch (error) {
      logger.error('Database get error', { error: error.message, sql });
      throw error;
    }
  }

  /**
   * Get multiple records
   */
  async allQuery(sql, params = []) {
    try {
      const result = await executeQuery(sql, params);
      return result.rows || [];
    } catch (error) {
      logger.error('Database all error', { error: error.message, sql });
      throw error;
    }
  }

  // Agent Management Methods

  /**
   * Create a new agent
   */
  async createAgent(agentData) {
    const id = uuidv4();
    const { name, description, prompt, voice_id, model, temperature, max_tokens } = agentData;

    const sql = `
      INSERT INTO agents (agent_id, name, description, ai_prompt, voice, model, api_key, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await this.getQuery(sql, [id, name, description, prompt, voice_id, model, null]);
    
    logger.info('Agent created', { id, name });
    return { id, ...agentData };
  }

  /**
   * Get all agents
   */
  async getAllAgents() {
    const sql = 'SELECT * FROM agents ORDER BY created_at DESC';
    return await this.allQuery(sql);
  }

  /**
   * Get agent by ID
   */
  async getAgentById(id) {
    const sql = 'SELECT * FROM agents WHERE agent_id = $1';
    return await this.getQuery(sql, [id]);
  }

  /**
   * Update agent
   */
  async updateAgent(id, agentData) {
    const { name, description, prompt, voice_id, model, temperature, max_tokens } = agentData;
    
    const sql = `
      UPDATE agents 
      SET name = $1, description = $2, ai_prompt = $3, voice = $4, model = $5, updated_at = CURRENT_TIMESTAMP
      WHERE agent_id = $6
      RETURNING *
    `;

    const result = await this.getQuery(sql, [name, description, prompt, voice_id, model, id]);
    
    if (result) {
      logger.info('Agent updated', { id, name });
      return result;
    } else {
      throw new Error('Agent not found or not updated');
    }
  }

  /**
   * Delete agent (soft delete)
   */
  async deleteAgent(id) {
    const sql = 'UPDATE agents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2';
    const result = await this.runQuery(sql, ['inactive', id]);
    
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
      INSERT INTO calls (id, agent_id, phone_number, customer_name, twilio_call_sid, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    const result = await this.getQuery(sql, [id, agent_id, phone_number, customer_name, twilio_call_sid]);
    
    logger.info('Call created', { id, agent_id, phone_number });
    return result.id;
  }

  /**
   * Get call by ID
   */
  async getCallById(id) {
    const sql = 'SELECT * FROM calls WHERE id = $1';
    return await this.getQuery(sql, [id]);
  }

  /**
   * Get call by Twilio Call SID
   */
  async getCallByTwilioSid(twilioCallSid) {
    const sql = 'SELECT * FROM calls WHERE twilio_call_sid = $1';
    return await this.getQuery(sql, [twilioCallSid]);
  }

  /**
   * Update call status
   */
  async updateCallStatus(id, status, additionalData = {}) {
    const { duration, ended_at, twilio_call_sid } = additionalData;
    
    let sql = 'UPDATE calls SET status = $1, updated_at = CURRENT_TIMESTAMP';
    let params = [status];
    let paramIndex = 2;

    if (duration !== undefined) {
      sql += `, duration = $${paramIndex}`;
      params.push(duration);
      paramIndex++;
    }

    if (ended_at !== undefined) {
      sql += `, ended_at = $${paramIndex}`;
      params.push(ended_at);
      paramIndex++;
    }

    if (twilio_call_sid !== undefined) {
      sql += `, twilio_call_sid = $${paramIndex}`;
      params.push(twilio_call_sid);
      paramIndex++;
    }

    sql += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const result = await this.getQuery(sql, params);
    
    if (result) {
      logger.info('Call status updated', { id, status });
      return result;
    } else {
      logger.warn('Call not found for update', { id, status });
      return null;
    }
  }

  /**
   * Get all calls for an agent
   */
  async getCallsByAgent(agentId, limit = 50) {
    const sql = `
      SELECT * FROM calls 
      WHERE agent_id = $1 
      ORDER BY started_at DESC 
      LIMIT $2
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
      INSERT INTO conversations (id, call_id, role, content, timestamp, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await this.getQuery(sql, [id, callId, role, content]);
    
    logger.info('Conversation message added', { callId, role, contentLength: content.length });
    return { id, callId, role, content };
  }

  /**
   * Get conversation history for a call
   */
  async getConversationHistory(callId) {
    const sql = `
      SELECT * FROM conversations 
      WHERE call_id = $1 
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
    const agentCount = await this.getQuery('SELECT COUNT(*) as count FROM agents WHERE status = $1', ['active']);
    stats.totalAgents = parseInt(agentCount.count);

    // Total calls
    const callCount = await this.getQuery('SELECT COUNT(*) as count FROM calls');
    stats.totalCalls = parseInt(callCount.count);

    // Active calls
    const activeCallCount = await this.getQuery('SELECT COUNT(*) as count FROM calls WHERE status IN ($1, $2)', ['initiated', 'in_progress']);
    stats.activeCalls = parseInt(activeCallCount.count);

    // Total conversation messages
    const messageCount = await this.getQuery('SELECT COUNT(*) as count FROM conversations');
    stats.totalMessages = parseInt(messageCount.count);

    return stats;
  }

  /**
   * Get agent statistics
   */
  async getAgentStats(agentId) {
    const stats = {};

    // Total calls for this agent
    const callCount = await this.getQuery('SELECT COUNT(*) as count FROM calls WHERE agent_id = $1', [agentId]);
    stats.totalCalls = parseInt(callCount.count);

    // Average call duration
    const avgDuration = await this.getQuery('SELECT AVG(duration) as avg FROM calls WHERE agent_id = $1 AND duration > 0', [agentId]);
    stats.averageDuration = Math.round(parseFloat(avgDuration.avg) || 0);

    // Success rate (calls that ended successfully)
    const successCount = await this.getQuery('SELECT COUNT(*) as count FROM calls WHERE agent_id = $1 AND status = $2', [agentId, 'completed']);
    stats.successRate = stats.totalCalls > 0 ? Math.round((parseInt(successCount.count) / stats.totalCalls) * 100) : 0;

    return stats;
  }

  // Custom Functions CRUD Methods (like Retell AI)

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
      INSERT INTO agent_functions (
        agent_id, function_type, name, description, config, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const config = {
      apiKey,
      eventTypeId,
      timezone,
      functionType,
      parameters,
      userId
    };

    const result = await this.getQuery(sql, [id, functionType, name, description, JSON.stringify(config), true]);
    return functionData;
  }

  /**
   * Get all custom functions for a user
   */
  async getCustomFunctions(userId = 'default') {
    const sql = 'SELECT * FROM agent_functions WHERE is_active = true ORDER BY created_at DESC';
    const functions = await this.allQuery(sql);
    
    // Parse JSON config (handle both string and object types)
    return functions.map(func => ({
      ...func,
      config: typeof func.config === 'string' ? JSON.parse(func.config || '{}') : (func.config || {})
    }));
  }

  /**
   * Get a custom function by ID
   */
  async getCustomFunction(functionId) {
    const sql = 'SELECT * FROM agent_functions WHERE agent_id = $1';
    const functionData = await this.getQuery(sql, [functionId]);
    
    if (functionData) {
      functionData.config = JSON.parse(functionData.config || '{}');
    }
    
    return functionData;
  }

  /**
   * Get a custom function by name
   */
  async getCustomFunctionByName(functionName) {
    const sql = 'SELECT * FROM agent_functions WHERE name = $1';
    const functionData = await this.getQuery(sql, [functionName]);
    
    if (functionData) {
      functionData.config = JSON.parse(functionData.config || '{}');
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
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }
    if (description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }
    if (apiKey !== undefined || eventTypeId !== undefined || timezone !== undefined || functionType !== undefined || parameters !== undefined) {
      // Get existing config and merge
      const existing = await this.getCustomFunction(functionId);
      const config = existing?.config || {};
      
      if (apiKey !== undefined) config.apiKey = apiKey;
      if (eventTypeId !== undefined) config.eventTypeId = eventTypeId;
      if (timezone !== undefined) config.timezone = timezone;
      if (functionType !== undefined) config.functionType = functionType;
      if (parameters !== undefined) config.parameters = parameters;
      
      fields.push(`config = $${paramIndex}`);
      values.push(JSON.stringify(config));
      paramIndex++;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(functionId);

    const sql = `UPDATE agent_functions SET ${fields.join(', ')} WHERE agent_id = $${paramIndex} RETURNING *`;
    const result = await this.getQuery(sql, values);

    return result;
  }

  /**
   * Delete a custom function
   */
  async deleteCustomFunction(functionId) {
    const sql = 'UPDATE agent_functions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $1';
    const result = await this.runQuery(sql, [functionId]);
    return result.changes > 0;
  }

  // Contact Methods

  /**
   * Get all contacts
   */
  async getContacts(search = null, limit = 50, offset = 0) {
    let sql = `
      SELECT id, name, phone_number, email, company, notes, tags,
             is_verified, verification_status, last_called, call_count,
             created_at, updated_at
      FROM contacts
    `;
    let params = [];
    let paramIndex = 1;

    if (search) {
      sql += ` WHERE name ILIKE $${paramIndex} OR phone_number ILIKE $${paramIndex} OR email ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    return await this.allQuery(sql, params);
  }

  /**
   * Get contact by ID
   */
  async getContactById(id) {
    const sql = 'SELECT * FROM contacts WHERE id = $1';
    return await this.getQuery(sql, [id]);
  }

  /**
   * Create new contact
   */
  async createContact(contactData) {
    const { name, phone_number, email, company, notes, tags, is_verified, verification_status } = contactData;
    
    const sql = `
      INSERT INTO contacts (name, phone_number, email, company, notes, tags, is_verified, verification_status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const params = [
      name,
      phone_number,
      email || null,
      company || null,
      notes || null,
      tags || null,
      is_verified || false,
      verification_status || 'pending'
    ];

    const result = await this.getQuery(sql, params);
    return result;
  }

  /**
   * Update contact
   */
  async updateContact(id, contactData) {
    const { name, phone_number, email, company, notes, tags } = contactData;
    
    const sql = `
      UPDATE contacts 
      SET name = $1, phone_number = $2, email = $3, company = $4, notes = $5, tags = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;
    
    const params = [
      name,
      phone_number,
      email || null,
      company || null,
      notes || null,
      tags || null,
      id
    ];

    const result = await this.getQuery(sql, params);
    
    if (result) {
      return result;
    } else {
      throw new Error('Contact not found');
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(id) {
    const sql = 'DELETE FROM contacts WHERE id = $1';
    const result = await this.runQuery(sql, [id]);
    return result.changes > 0;
  }

  /**
   * Verify contact phone number
   */
  async verifyContact(id, isVerified = true, verificationStatus = 'validated') {
    const sql = `
      UPDATE contacts 
      SET is_verified = $1, verification_status = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await this.getQuery(sql, [isVerified, verificationStatus, id]);
    
    if (result) {
      return result;
    } else {
      throw new Error('Contact not found');
    }
  }

  /**
   * Get contacts by phone number
   */
  async getContactByPhone(phoneNumber) {
    const sql = 'SELECT * FROM contacts WHERE phone_number = $1';
    return await this.getQuery(sql, [phoneNumber]);
  }

  /**
   * Update contact call count and last called
   */
  async updateContactCallInfo(id, callCount = null, lastCalled = null) {
    let sql = 'UPDATE contacts SET updated_at = CURRENT_TIMESTAMP';
    let params = [];
    let paramIndex = 1;

    if (callCount !== null) {
      sql += `, call_count = call_count + $${paramIndex}`;
      params.push(callCount);
      paramIndex++;
    }

    if (lastCalled !== null) {
      sql += `, last_called = $${paramIndex}`;
      params.push(lastCalled);
      paramIndex++;
    }

    sql += ` WHERE id = $${paramIndex}`;
    params.push(id);

    const result = await this.runQuery(sql, params);
    return { id, updated: true };
  }

  /**
   * Get calls by phone number
   */
  async getCallsByPhoneNumber(phoneNumber, limit = 50) {
    const sql = `
      SELECT id, agent_id, phone_number, customer_name, status, twilio_call_sid, 
             duration, started_at, ended_at
      FROM calls 
      WHERE phone_number = $1 
      ORDER BY started_at DESC 
      LIMIT $2
    `;
    return await this.allQuery(sql, [phoneNumber, limit]);
  }
}

// Create singleton instance
const postgresDatabaseService = new PostgresDatabaseService();

module.exports = postgresDatabaseService;
