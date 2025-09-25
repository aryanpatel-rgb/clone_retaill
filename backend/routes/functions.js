const express = require('express');
const { pool, executeQuery } = require('../database/connection');
const router = express.Router();

// Get all functions for an agent
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const result = await executeQuery(`
      SELECT * FROM agent_functions 
      WHERE agent_id = $1 
      ORDER BY created_at DESC
    `, [agentId]);

    const functions = result.rows.map(func => ({
      id: func.id,
      agentId: func.agent_id,
      functionType: func.function_type,
      name: func.name,
      description: func.description,
      config: func.config,
      createdAt: func.created_at,
      updatedAt: func.updated_at
    }));

    res.json(functions);
  } catch (error) {
    console.error('Error fetching agent functions:', error);
    res.status(500).json({ error: 'Failed to fetch agent functions' });
  }
});

// Create a new function for an agent
router.post('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { function_type, name, description, config } = req.body;

    const result = await executeQuery(`
      INSERT INTO agent_functions (agent_id, function_type, name, description, config)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [agentId, function_type, name, description, JSON.stringify(config)]);

    const newFunction = {
      id: result.rows[0].id,
      agentId: result.rows[0].agent_id,
      functionType: result.rows[0].function_type,
      name: result.rows[0].name,
      description: result.rows[0].description,
      config: result.rows[0].config,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };

    res.status(201).json(newFunction);
  } catch (error) {
    console.error('Error creating agent function:', error);
    res.status(500).json({ error: 'Failed to create agent function' });
  }
});

// Update a function
router.put('/:functionId', async (req, res) => {
  try {
    const { functionId } = req.params;
    const { function_type, name, description, config } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (function_type !== undefined) {
      paramCount++;
      updates.push(`function_type = $${paramCount}`);
      values.push(function_type);
    }

    if (name !== undefined) {
      paramCount++;
      updates.push(`name = $${paramCount}`);
      values.push(name);
    }

    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }

    if (config !== undefined) {
      paramCount++;
      updates.push(`config = $${paramCount}`);
      values.push(JSON.stringify(config));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(functionId);

    const query = `
      UPDATE agent_functions 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await executeQuery(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Function not found' });
    }

    const updatedFunction = {
      id: result.rows[0].id,
      agentId: result.rows[0].agent_id,
      functionType: result.rows[0].function_type,
      name: result.rows[0].name,
      description: result.rows[0].description,
      config: result.rows[0].config,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };

    res.json(updatedFunction);
  } catch (error) {
    console.error('Error updating agent function:', error);
    res.status(500).json({ error: 'Failed to update agent function' });
  }
});

// Delete a function
router.delete('/:functionId', async (req, res) => {
  try {
    const { functionId } = req.params;

    const result = await executeQuery(`
      DELETE FROM agent_functions 
      WHERE id = $1 
      RETURNING *
    `, [functionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Function not found' });
    }

    res.json({ message: 'Function deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent function:', error);
    res.status(500).json({ error: 'Failed to delete agent function' });
  }
});

// Execute a function (for testing/development)
router.post('/:functionId/execute', async (req, res) => {
  try {
    const { functionId } = req.params;
    const { params } = req.body;

    // Get function details
    const functionResult = await pool.query(`
      SELECT * FROM agent_functions WHERE id = $1
    `, [functionId]);

    if (functionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Function not found' });
    }

    const func = functionResult.rows[0];
    const config = func.config;

    // Execute function based on type
    let result;
    switch (func.function_type) {
      case 'end_call':
        result = { success: true, message: 'Call ended successfully' };
        break;
      
      case 'check_availability':
        result = await checkCalendarAvailability(config, params);
        break;
      
      case 'book_appointment':
        result = await bookAppointment(config, params);
        break;
      
      case 'send_sms':
        result = await sendSMS(config, params);
        break;
      
      default:
        result = await executeCustomFunction(config, params);
    }

    res.json(result);
  } catch (error) {
    console.error('Error executing function:', error);
    res.status(500).json({ error: 'Failed to execute function', details: error.message });
  }
});

// Helper functions for executing different function types
async function checkCalendarAvailability(config, params) {
  // This would integrate with Cal.com API
  // For now, return mock data
  return {
    success: true,
    availableSlots: [
      { date: '2024-01-15', time: '10:00', available: true },
      { date: '2024-01-15', time: '14:00', available: true },
      { date: '2024-01-16', time: '09:00', available: true }
    ]
  };
}

async function bookAppointment(config, params) {
  // This would integrate with Cal.com API
  // For now, return mock data
  return {
    success: true,
    bookingId: `booking_${Date.now()}`,
    message: 'Appointment booked successfully'
  };
}

async function sendSMS(config, params) {
  // This would integrate with SMS service
  // For now, return mock data
  return {
    success: true,
    messageId: `sms_${Date.now()}`,
    message: 'SMS sent successfully'
  };
}

async function executeCustomFunction(config, params) {
  // This would make HTTP request to custom endpoint
  // For now, return mock data
  return {
    success: true,
    result: 'Custom function executed successfully',
    data: params
  };
}

module.exports = router;
