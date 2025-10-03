const express = require('express');
const { pool, executeQuery } = require('../database/connection');
const { validateAgent, validateId, validatePagination } = require('../middleware/validation');
const router = express.Router();

// Get all agents with pagination
router.get('/', validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const result = await executeQuery(`
      SELECT 
        a.*,
        COUNT(s.id) as total_calls,
        AVG(CASE WHEN s.status = 'completed' THEN s.duration ELSE NULL END) as avg_duration,
        ROUND(
          (COUNT(CASE WHEN s.status = 'completed' THEN 1 END) * 100.0 / 
           NULLIF(COUNT(s.id), 0)), 1
        ) as success_rate,
        MAX(s.start_time) as last_active
      FROM agents a
      LEFT JOIN sessions s ON a.agent_id = s.agent_id
      GROUP BY a.id, a.agent_id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Get total count for pagination
    const countResult = await executeQuery('SELECT COUNT(*) FROM agents');
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    const agents = result.rows.map(agent => ({
      id: agent.agent_id,
      name: agent.name,
      description: agent.description,
      aiPrompt: agent.ai_prompt || '',
      status: agent.status,
      voice: agent.voice,
      language: agent.language,
      model: agent.model,
      calls: parseInt(agent.total_calls) || 0,
      avgDuration: agent.avg_duration ? 
        `${Math.floor(agent.avg_duration / 60)}:${String(Math.floor(agent.avg_duration % 60)).padStart(2, '0')}` : 
        '0:00',
      successRate: parseFloat(agent.success_rate) || 0,
      lastActive: agent.last_active ? 
        getTimeAgo(new Date(agent.last_active)) : 
        'Never',
      createdAt: agent.created_at,
      apiKey: agent.api_key,
      webhookUrl: agent.webhook_url
    }));

    res.json({
      agents,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get single agent by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        a.*,
        COUNT(s.id) as total_calls,
        AVG(CASE WHEN s.status = 'completed' THEN s.duration ELSE NULL END) as avg_duration,
        ROUND(
          (COUNT(CASE WHEN s.status = 'completed' THEN 1 END) * 100.0 / 
           NULLIF(COUNT(s.id), 0)), 1
        ) as success_rate,
        MAX(s.start_time) as last_active
      FROM agents a
      LEFT JOIN sessions s ON a.agent_id = s.agent_id
      WHERE a.agent_id = $1
      GROUP BY a.id, a.agent_id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const agent = result.rows[0];
    const agentData = {
      id: agent.agent_id,
      name: agent.name,
      description: agent.description,
      aiPrompt: agent.ai_prompt || '',
      status: agent.status,
      voice: agent.voice,
      language: agent.language,
      model: agent.model,
      calls: parseInt(agent.total_calls) || 0,
      avgDuration: agent.avg_duration ? 
        `${Math.floor(agent.avg_duration / 60)}:${String(Math.floor(agent.avg_duration % 60)).padStart(2, '0')}` : 
        '0:00',
      successRate: parseFloat(agent.success_rate) || 0,
      lastActive: agent.last_active ? 
        getTimeAgo(new Date(agent.last_active)) : 
        'Never',
      createdAt: agent.created_at,
      apiKey: agent.api_key,
      webhookUrl: agent.webhook_url
    };

    res.json(agentData);
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Create new agent
router.post('/', validateAgent, async (req, res) => {
  try {
    const { name, description, aiPrompt, voice, language, model, webhookUrl } = req.body;
    
    // Generate unique agent ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const apiKey = `rt_sk_${Math.random().toString(36).substr(2, 16)}`;

    const result = await executeQuery(`
      INSERT INTO agents (agent_id, name, description, ai_prompt, voice, language, model, api_key, webhook_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'inactive')
      RETURNING *
    `, [agentId, name, description, aiPrompt, voice, language, model, apiKey, webhookUrl]);

    res.status(201).json({
      id: result.rows[0].agent_id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      aiPrompt: result.rows[0].ai_prompt || '',
      status: result.rows[0].status,
      voice: result.rows[0].voice,
      language: result.rows[0].language,
      model: result.rows[0].model,
      apiKey: result.rows[0].api_key,
      webhookUrl: result.rows[0].webhook_url,
      createdAt: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Update agent
router.put('/:id', validateId, validateAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, aiPrompt, status, voice, language, model, webhookUrl } = req.body;

    const result = await executeQuery(`
      UPDATE agents 
      SET name = $1, description = $2, ai_prompt = $3, status = $4, voice = $5, language = $6, model = $7, webhook_url = $8, updated_at = CURRENT_TIMESTAMP
      WHERE agent_id = $9
      RETURNING *
    `, [name, description, aiPrompt, status, voice, language, model, webhookUrl, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      id: result.rows[0].agent_id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      aiPrompt: result.rows[0].ai_prompt || '',
      status: result.rows[0].status,
      voice: result.rows[0].voice,
      language: result.rows[0].language,
      model: result.rows[0].model,
      webhookUrl: result.rows[0].webhook_url,
      updatedAt: result.rows[0].updated_at
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Delete agent
router.delete('/:id', validateId, async (req, res) => {
  try {
    const { id } = req.params;

    // First, delete related agent functions
    await executeQuery(`
      DELETE FROM agent_functions WHERE agent_id = $1
    `, [id]);

    // Then delete related sessions
    await executeQuery(`
      DELETE FROM sessions WHERE agent_id = $1
    `, [id]);

    // Then delete related analytics
    await executeQuery(`
      DELETE FROM analytics WHERE agent_id = $1
    `, [id]);

    // Finally delete the agent
    const result = await executeQuery(`
      DELETE FROM agents WHERE agent_id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    
    // Provide more specific error messages
    if (error.code === '23503') {
      res.status(409).json({ 
        error: 'Cannot delete agent: It is still being used by other records. Please remove all related data first.' 
      });
    } else {
      res.status(500).json({ error: 'Failed to delete agent' });
    }
  }
});

// Helper function to calculate time ago
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

module.exports = router;
