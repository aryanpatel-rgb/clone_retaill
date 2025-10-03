const express = require('express');
const { pool, executeQuery } = require('../database/connection');
const router = express.Router();
const { query, validationResult } = require('express-validator');

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Analytics validation rules
const validateAnalyticsQuery = [
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('date_from must be a valid ISO 8601 date'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('date_to must be a valid ISO 8601 date'),
  query('agent_id')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('agent_id must be a valid string'),
  handleValidationErrors
];

// Get analytics data
router.get('/', validateAnalyticsQuery, async (req, res) => {
  try {
    const { date_from, date_to, agent_id } = req.query;
    
    // Get date range (default to last 7 days)
    const endDate = date_to ? new Date(date_to) : new Date();
    const startDate = date_from ? new Date(date_from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Validate date range
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date must be before end date'
      });
    }

    // Get key metrics
    const metrics = await getKeyMetrics(startDate, endDate, agent_id);
    
    // Get call volume over time
    const callVolume = await getCallVolume(startDate, endDate, agent_id);
    
    // Get duration trends
    const durationTrends = await getDurationTrends(startDate, endDate, agent_id);
    
    // Get success rate trends
    const successRateTrends = await getSuccessRateTrends(startDate, endDate, agent_id);

    res.json({
      success: true,
      data: {
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        metrics,
        callVolume,
        durationTrends,
        successRateTrends
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics data'
    });
  }
});

// Get agent-specific analytics
router.get('/agent/:agentId', [
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('date_from must be a valid ISO 8601 date'),
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('date_to must be a valid ISO 8601 date'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { agentId } = req.params;
    const { date_from, date_to } = req.query;
    
    // Get date range (default to last 30 days)
    const endDate = date_to ? new Date(date_to) : new Date();
    const startDate = date_from ? new Date(date_from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Validate date range
    if (startDate > endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date must be before end date'
      });
    }

    // Get agent details
    const agentResult = await executeQuery(`
      SELECT name, description FROM agents WHERE agent_id = $1
    `, [agentId]);

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const agent = agentResult.rows[0];
    
    // Get agent-specific metrics
    const metrics = await getKeyMetrics(startDate, endDate, agentId);
    
    // Get call volume over time for this agent
    const callVolume = await getCallVolume(startDate, endDate, agentId);
    
    // Get duration trends for this agent
    const durationTrends = await getDurationTrends(startDate, endDate, agentId);
    
    // Get success rate trends for this agent
    const successRateTrends = await getSuccessRateTrends(startDate, endDate, agentId);

    // Get recent calls for this agent
    const recentCalls = await getRecentCalls(agentId, 10);

    res.json({
      success: true,
      data: {
        agent: {
          id: agentId,
          name: agent.name,
          description: agent.description
        },
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        metrics,
        callVolume,
        durationTrends,
        successRateTrends,
        recentCalls
      }
    });
  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent analytics'
    });
  }
});

// Helper function to get key metrics
async function getKeyMetrics(startDate, endDate, agentId) {
  try {
    let query = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
        AVG(CASE WHEN status = 'completed' THEN duration ELSE NULL END) as avg_duration,
        MIN(start_time) as first_call,
        MAX(start_time) as last_call
      FROM sessions 
      WHERE start_time >= $1 AND start_time <= $2
    `;
    
    const params = [startDate, endDate];
    
    if (agentId) {
      query += ` AND agent_id = $3`;
      params.push(agentId);
    }
    
    const result = await executeQuery(query, params);
    const row = result.rows[0];
    
    const successRate = row.total_calls > 0 ? 
      (row.successful_calls / row.total_calls * 100).toFixed(1) : 0;
    
    return {
      totalCalls: parseInt(row.total_calls) || 0,
      successfulCalls: parseInt(row.successful_calls) || 0,
      failedCalls: parseInt(row.failed_calls) || 0,
      successRate: parseFloat(successRate),
      averageDuration: parseFloat(row.avg_duration) || 0,
      firstCall: row.first_call,
      lastCall: row.last_call
    };
  } catch (error) {
    console.error('Error getting key metrics:', error);
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      successRate: 0,
      averageDuration: 0,
      firstCall: null,
      lastCall: null
    };
  }
}

// Helper function to get call volume over time
async function getCallVolume(startDate, endDate, agentId) {
  try {
    let query = `
      SELECT 
        DATE(start_time) as date,
        COUNT(*) as calls
      FROM sessions 
      WHERE start_time >= $1 AND start_time <= $2
    `;
    
    const params = [startDate, endDate];
    
    if (agentId) {
      query += ` AND agent_id = $3`;
      params.push(agentId);
    }
    
    query += ` GROUP BY DATE(start_time) ORDER BY date`;
    
    const result = await executeQuery(query, params);
    return result.rows.map(row => ({
      date: row.date,
      calls: parseInt(row.calls)
    }));
  } catch (error) {
    console.error('Error getting call volume:', error);
    return [];
  }
}

// Helper function to get duration trends
async function getDurationTrends(startDate, endDate, agentId) {
  try {
    let query = `
      SELECT 
        DATE(start_time) as date,
        AVG(CASE WHEN status = 'completed' THEN duration ELSE NULL END) as avg_duration
      FROM sessions 
      WHERE start_time >= $1 AND start_time <= $2
    `;
    
    const params = [startDate, endDate];
    
    if (agentId) {
      query += ` AND agent_id = $3`;
      params.push(agentId);
    }
    
    query += ` GROUP BY DATE(start_time) ORDER BY date`;
    
    const result = await executeQuery(query, params);
    return result.rows.map(row => ({
      date: row.date,
      averageDuration: parseFloat(row.avg_duration) || 0
    }));
  } catch (error) {
    console.error('Error getting duration trends:', error);
    return [];
  }
}

// Helper function to get success rate trends
async function getSuccessRateTrends(startDate, endDate, agentId) {
  try {
    let query = `
      SELECT 
        DATE(start_time) as date,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls
      FROM sessions 
      WHERE start_time >= $1 AND start_time <= $2
    `;
    
    const params = [startDate, endDate];
    
    if (agentId) {
      query += ` AND agent_id = $3`;
      params.push(agentId);
    }
    
    query += ` GROUP BY DATE(start_time) ORDER BY date`;
    
    const result = await executeQuery(query, params);
    return result.rows.map(row => {
      const successRate = row.total_calls > 0 ? 
        (row.successful_calls / row.total_calls * 100) : 0;
      return {
        date: row.date,
        successRate: parseFloat(successRate.toFixed(1)),
        totalCalls: parseInt(row.total_calls),
        successfulCalls: parseInt(row.successful_calls)
      };
    });
  } catch (error) {
    console.error('Error getting success rate trends:', error);
    return [];
  }
}

// Helper function to get recent calls
async function getRecentCalls(agentId, limit = 10) {
  try {
    const result = await executeQuery(`
      SELECT 
        s.*,
        a.name as agent_name
      FROM sessions s
      LEFT JOIN agents a ON s.agent_id = a.agent_id
      WHERE s.agent_id = $1
      ORDER BY s.start_time DESC
      LIMIT $2
    `, [agentId, limit]);
    
    return result.rows.map(row => ({
      id: row.session_id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      customerId: row.customer_id,
      type: row.type,
      status: row.status,
      duration: row.duration,
      startTime: row.start_time,
      endTime: row.end_time,
      transcript: row.transcript,
      satisfaction: row.satisfaction
    }));
  } catch (error) {
    console.error('Error getting recent calls:', error);
    return [];
  }
}

// Health check for analytics
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'analytics',
    timestamp: new Date().toISOString(),
    endpoints: {
      'analytics': 'GET /api/analytics',
      'agent-analytics': 'GET /api/analytics/agent/:agentId'
    }
  });
});

module.exports = router;