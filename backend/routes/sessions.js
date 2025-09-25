const express = require('express');
const { pool, executeQuery } = require('../database/connection');
const router = express.Router();

// Get all sessions with optional filtering
router.get('/', async (req, res) => {
  try {
    const { status, agent_id, type, date_from, date_to, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        s.*,
        a.name as agent_name
      FROM sessions s
      LEFT JOIN agents a ON s.agent_id = a.agent_id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 0;

    if (status && status !== 'all') {
      paramCount++;
      query += ` AND s.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (agent_id && agent_id !== 'all') {
      paramCount++;
      query += ` AND s.agent_id = $${paramCount}`;
      queryParams.push(agent_id);
    }

    if (type) {
      paramCount++;
      query += ` AND s.type = $${paramCount}`;
      queryParams.push(type);
    }

    if (date_from) {
      paramCount++;
      query += ` AND s.start_time >= $${paramCount}`;
      queryParams.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND s.start_time <= $${paramCount}`;
      queryParams.push(date_to);
    }

    query += ` ORDER BY s.start_time DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await executeQuery(query, queryParams);

    const sessions = result.rows.map(session => ({
      id: session.session_id,
      agentName: session.agent_name,
      customerId: session.customer_id,
      type: session.type,
      status: session.status,
      duration: formatDuration(session.duration),
      startTime: session.start_time,
      endTime: session.end_time,
      transcript: session.transcript,
      satisfaction: session.satisfaction
    }));

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM sessions s
      WHERE 1=1
    `;
    
    const countParams = [];
    let countParamCount = 0;

    if (status && status !== 'all') {
      countParamCount++;
      countQuery += ` AND s.status = $${countParamCount}`;
      countParams.push(status);
    }

    if (agent_id && agent_id !== 'all') {
      countParamCount++;
      countQuery += ` AND s.agent_id = $${countParamCount}`;
      countParams.push(agent_id);
    }

    if (type) {
      countParamCount++;
      countQuery += ` AND s.type = $${countParamCount}`;
      countParams.push(type);
    }

    if (date_from) {
      countParamCount++;
      countQuery += ` AND s.start_time >= $${countParamCount}`;
      countParams.push(date_from);
    }

    if (date_to) {
      countParamCount++;
      countQuery += ` AND s.start_time <= $${countParamCount}`;
      countParams.push(date_to);
    }

    const countResult = await executeQuery(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      sessions,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: offset + sessions.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session statistics
router.get('/stats', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    
    let query = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_sessions,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_sessions,
        AVG(CASE WHEN status = 'completed' THEN duration ELSE NULL END) as avg_duration,
        AVG(satisfaction) as avg_satisfaction
      FROM sessions
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCount = 0;

    if (date_from) {
      paramCount++;
      query += ` AND start_time >= $${paramCount}`;
      queryParams.push(date_from);
    }

    if (date_to) {
      paramCount++;
      query += ` AND start_time <= $${paramCount}`;
      queryParams.push(date_to);
    }

    const result = await executeQuery(query, queryParams);
    const stats = result.rows[0];

    res.json({
      totalSessions: parseInt(stats.total_sessions) || 0,
      completedSessions: parseInt(stats.completed_sessions) || 0,
      failedSessions: parseInt(stats.failed_sessions) || 0,
      inProgressSessions: parseInt(stats.in_progress_sessions) || 0,
      avgDuration: stats.avg_duration ? Math.round(stats.avg_duration) : 0,
      avgSatisfaction: stats.avg_satisfaction ? parseFloat(stats.avg_satisfaction).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session statistics' });
  }
});

// Get single session by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        s.*,
        a.name as agent_name
      FROM sessions s
      LEFT JOIN agents a ON s.agent_id = a.agent_id
      WHERE s.session_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];
    const sessionData = {
      id: session.session_id,
      agentName: session.agent_name,
      customerId: session.customer_id,
      type: session.type,
      status: session.status,
      duration: formatDuration(session.duration),
      startTime: session.start_time,
      endTime: session.end_time,
      transcript: session.transcript,
      satisfaction: session.satisfaction
    };

    res.json(sessionData);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create new session
router.post('/', async (req, res) => {
  try {
    const { agent_id, customer_id, type, transcript } = req.body;
    
    // Generate unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const result = await executeQuery(`
      INSERT INTO sessions (session_id, agent_id, customer_id, type, transcript, status)
      VALUES ($1, $2, $3, $4, $5, 'in_progress')
      RETURNING *
    `, [sessionId, agent_id, customer_id, type, transcript]);

    res.status(201).json({
      id: result.rows[0].session_id,
      agentId: result.rows[0].agent_id,
      customerId: result.rows[0].customer_id,
      type: result.rows[0].type,
      status: result.rows[0].status,
      startTime: result.rows[0].start_time,
      transcript: result.rows[0].transcript
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, duration, transcript, satisfaction } = req.body;

    let query = 'UPDATE sessions SET ';
    const updates = [];
    const queryParams = [];
    let paramCount = 0;

    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      queryParams.push(status);
    }

    if (duration !== undefined) {
      paramCount++;
      updates.push(`duration = $${paramCount}`);
      queryParams.push(duration);
    }

    if (transcript !== undefined) {
      paramCount++;
      updates.push(`transcript = $${paramCount}`);
      queryParams.push(transcript);
    }

    if (satisfaction !== undefined) {
      paramCount++;
      updates.push(`satisfaction = $${paramCount}`);
      queryParams.push(satisfaction);
    }

    if (status === 'completed' || status === 'failed') {
      paramCount++;
      updates.push(`end_time = $${paramCount}`);
      queryParams.push(new Date());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    query += updates.join(', ') + ` WHERE session_id = $${paramCount}`;
    queryParams.push(id);

    const result = await executeQuery(query, queryParams);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session updated successfully' });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await executeQuery(`
      DELETE FROM sessions WHERE session_id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Helper function to format duration
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

module.exports = router;
