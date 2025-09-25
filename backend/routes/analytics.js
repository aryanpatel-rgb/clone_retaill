const express = require('express');
const { pool, executeQuery } = require('../database/connection');
const router = express.Router();

// Get analytics data
router.get('/', async (req, res) => {
  try {
    const { date_from, date_to, agent_id } = req.query;
    
    // Get date range (default to last 7 days)
    const endDate = date_to ? new Date(date_to) : new Date();
    const startDate = date_from ? new Date(date_from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get key metrics
    const metrics = await getKeyMetrics(startDate, endDate, agent_id);
    
    // Get call volume over time
    const callVolume = await getCallVolume(startDate, endDate, agent_id);
    
    // Get duration trends
    const durationTrends = await getDurationTrends(startDate, endDate, agent_id);
    
    // Get status distribution
    const statusDistribution = await getStatusDistribution(startDate, endDate, agent_id);
    
    // Get agent performance
    const agentPerformance = await getAgentPerformance(startDate, endDate);

    res.json({
      metrics,
      callVolume,
      durationTrends,
      statusDistribution,
      agentPerformance,
      dateRange: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Get key metrics
async function getKeyMetrics(startDate, endDate, agentId) {
  let query = `
    SELECT 
      COUNT(*) as total_calls,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_calls,
      AVG(CASE WHEN status = 'completed' THEN duration ELSE NULL END) as avg_duration,
      AVG(satisfaction) as avg_satisfaction
    FROM sessions
    WHERE start_time >= $1 AND start_time <= $2
  `;
  
  const queryParams = [startDate, endDate];
  
  if (agentId && agentId !== 'all') {
    query += ` AND agent_id = $3`;
    queryParams.push(agentId);
  }

  const result = await executeQuery(query, queryParams);
  const data = result.rows[0];

  return {
    totalCalls: parseInt(data.total_calls) || 0,
    successfulCalls: parseInt(data.successful_calls) || 0,
    failedCalls: parseInt(data.failed_calls) || 0,
    avgDuration: data.avg_duration ? Math.round(data.avg_duration) : 0,
    avgSatisfaction: data.avg_satisfaction ? parseFloat(data.avg_satisfaction).toFixed(1) : 0,
    successRate: data.total_calls > 0 ? 
      ((data.successful_calls / data.total_calls) * 100).toFixed(1) : 0
  };
}

// Get call volume over time
async function getCallVolume(startDate, endDate, agentId) {
  let query = `
    SELECT 
      DATE(start_time) as date,
      COUNT(*) as total_calls,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls
    FROM sessions
    WHERE start_time >= $1 AND start_time <= $2
  `;
  
  const queryParams = [startDate, endDate];
  
  if (agentId && agentId !== 'all') {
    query += ` AND agent_id = $3`;
    queryParams.push(agentId);
  }

  query += ` GROUP BY DATE(start_time) ORDER BY date`;

  const result = await executeQuery(query, queryParams);
  
  return result.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    calls: parseInt(row.total_calls),
    successful: parseInt(row.successful_calls)
  }));
}

// Get duration trends
async function getDurationTrends(startDate, endDate, agentId) {
  let query = `
    SELECT 
      DATE(start_time) as date,
      AVG(CASE WHEN status = 'completed' THEN duration ELSE NULL END) as avg_duration
    FROM sessions
    WHERE start_time >= $1 AND start_time <= $2
  `;
  
  const queryParams = [startDate, endDate];
  
  if (agentId && agentId !== 'all') {
    query += ` AND agent_id = $3`;
    queryParams.push(agentId);
  }

  query += ` GROUP BY DATE(start_time) ORDER BY date`;

  const result = await executeQuery(query, queryParams);
  
  return result.rows.map(row => ({
    date: row.date.toISOString().split('T')[0],
    duration: row.avg_duration ? Math.round(row.avg_duration) : 0
  }));
}

// Get status distribution
async function getStatusDistribution(startDate, endDate, agentId) {
  let query = `
    SELECT 
      status,
      COUNT(*) as count
    FROM sessions
    WHERE start_time >= $1 AND start_time <= $2
  `;
  
  const queryParams = [startDate, endDate];
  
  if (agentId && agentId !== 'all') {
    query += ` AND agent_id = $3`;
    queryParams.push(agentId);
  }

  query += ` GROUP BY status`;

  const result = await executeQuery(query, queryParams);
  
  const colors = {
    'completed': '#10B981',
    'failed': '#EF4444',
    'in_progress': '#F59E0B'
  };

  return result.rows.map(row => ({
    name: row.status.charAt(0).toUpperCase() + row.status.slice(1),
    value: parseInt(row.count),
    color: colors[row.status] || '#6B7280'
  }));
}

// Get agent performance
async function getAgentPerformance(startDate, endDate) {
  const query = `
    SELECT 
      a.agent_id,
      a.name,
      COUNT(s.id) as total_calls,
      COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as successful_calls,
      AVG(CASE WHEN s.status = 'completed' THEN s.duration ELSE NULL END) as avg_duration,
      AVG(s.satisfaction) as avg_satisfaction
    FROM agents a
    LEFT JOIN sessions s ON a.agent_id = s.agent_id 
      AND s.start_time >= $1 AND s.start_time <= $2
    GROUP BY a.agent_id, a.name
    ORDER BY total_calls DESC
  `;

  const result = await executeQuery(query, [startDate, endDate]);
  
  return result.rows.map(row => ({
    agentId: row.agent_id,
    name: row.name,
    totalCalls: parseInt(row.total_calls) || 0,
    successfulCalls: parseInt(row.successful_calls) || 0,
    avgDuration: row.avg_duration ? Math.round(row.avg_duration) : 0,
    avgSatisfaction: row.avg_satisfaction ? parseFloat(row.avg_satisfaction).toFixed(1) : 0,
    successRate: row.total_calls > 0 ? 
      ((row.successful_calls / row.total_calls) * 100).toFixed(1) : 0
  }));
}

// Get real-time metrics
router.get('/realtime', async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get current hour stats
    const currentHour = await executeQuery(`
      SELECT 
        COUNT(*) as calls_this_hour,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_calls
      FROM sessions
      WHERE start_time >= $1
    `, [oneHourAgo]);

    // Get last 24 hours stats
    const last24Hours = await executeQuery(`
      SELECT 
        COUNT(*) as calls_today,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_today,
        AVG(CASE WHEN status = 'completed' THEN duration ELSE NULL END) as avg_duration_today
      FROM sessions
      WHERE start_time >= $1
    `, [oneDayAgo]);

    res.json({
      currentHour: {
        calls: parseInt(currentHour.rows[0].calls_this_hour) || 0,
        active: parseInt(currentHour.rows[0].active_calls) || 0
      },
      last24Hours: {
        calls: parseInt(last24Hours.rows[0].calls_today) || 0,
        completed: parseInt(last24Hours.rows[0].completed_today) || 0,
        avgDuration: last24Hours.rows[0].avg_duration_today ? 
          Math.round(last24Hours.rows[0].avg_duration_today) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching real-time metrics:', error);
    res.status(500).json({ error: 'Failed to fetch real-time metrics' });
  }
});

module.exports = router;
