const express = require('express');
const { pool, executeQuery } = require('../database/connection');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');

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

// Function validation rules
const validateFunction = [
  body('function_type')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Function type is required and must be less than 100 characters'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Function name is required and must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be a valid object'),
  handleValidationErrors
];

const validateAgentId = [
  param('agentId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Agent ID parameter is required'),
  handleValidationErrors
];

const validateFunctionId = [
  param('functionId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Function ID parameter is required'),
  handleValidationErrors
];

// Get all functions for an agent
router.get('/agent/:agentId', validateAgentId, async (req, res) => {
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
      isActive: func.is_active,
      createdAt: func.created_at,
      updatedAt: func.updated_at
    }));

    res.json({
      success: true,
      functions
    });
  } catch (error) {
    console.error('Error fetching agent functions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agent functions'
    });
  }
});

// Create a new function for an agent
router.post('/agent/:agentId', validateAgentId, validateFunction, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { function_type, name, description, config } = req.body;
    
    const result = await executeQuery(`
      INSERT INTO agent_functions (agent_id, function_type, name, description, config, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `, [agentId, function_type, name, description, JSON.stringify(config || {})]);

    const newFunction = {
      id: result.rows[0].id,
      agentId: result.rows[0].agent_id,
      functionType: result.rows[0].function_type,
      name: result.rows[0].name,
      description: result.rows[0].description,
      config: result.rows[0].config,
      isActive: result.rows[0].is_active,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };

    res.status(201).json({
      success: true,
      function: newFunction,
      message: 'Function created successfully'
    });
  } catch (error) {
    console.error('Error creating agent function:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create agent function'
    });
  }
});

// Update a function
router.put('/:functionId', validateFunctionId, async (req, res) => {
  try {
    const { functionId } = req.params;
    const { name, description, config, isActive } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (config !== undefined) {
      updates.push(`config = $${paramCount++}`);
      values.push(JSON.stringify(config));
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(functionId);

    const result = await executeQuery(`
      UPDATE agent_functions 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Function not found'
      });
    }

    const updatedFunction = {
      id: result.rows[0].id,
      agentId: result.rows[0].agent_id,
      functionType: result.rows[0].function_type,
      name: result.rows[0].name,
      description: result.rows[0].description,
      config: result.rows[0].config,
      isActive: result.rows[0].is_active,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at
    };

    res.json({
      success: true,
      function: updatedFunction,
      message: 'Function updated successfully'
    });
  } catch (error) {
    console.error('Error updating function:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update function'
    });
  }
});

// Delete a function
router.delete('/:functionId', validateFunctionId, async (req, res) => {
  try {
    const { functionId } = req.params;
    
    const result = await executeQuery(`
      DELETE FROM agent_functions 
      WHERE id = $1
      RETURNING *
    `, [functionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Function not found'
      });
    }

    res.json({
      success: true,
      message: 'Function deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting function:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete function'
    });
  }
});

// Execute a function
router.post('/:functionId/execute', validateFunctionId, async (req, res) => {
  try {
    const { functionId } = req.params;
    const { params } = req.body;
    
    // Get function details
    const functionResult = await executeQuery(`
      SELECT * FROM agent_functions 
      WHERE id = $1 AND is_active = true
    `, [functionId]);

    if (functionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Function not found or inactive'
      });
    }

    const func = functionResult.rows[0];
    const config = func.config || {};
    
    let result;
    
    // Execute based on function type
    switch (func.function_type) {
      case 'check_availability':
        result = await checkCalendarAvailability(config, params);
        break;
      case 'book_appointment':
        result = await bookAppointment(config, params);
        break;
      case 'send_sms':
        result = await sendSMS(config, params);
        break;
      case 'end_call':
        result = { success: true, message: 'Call ended successfully' };
        break;
      default:
        result = { success: false, error: 'Unknown function type' };
    }

    res.json({
      success: result.success,
      result: result,
      functionType: func.function_type,
      functionName: func.name
    });
  } catch (error) {
    console.error('Error executing function:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute function'
    });
  }
});

// Built-in function implementations
async function checkCalendarAvailability(config, params) {
  try {
    // Check if Cal.com integration is configured
    const calcomResult = await executeQuery(`
      SELECT value FROM platform_settings 
      WHERE key = 'calcom' AND category = 'integrations'
    `);

    if (calcomResult.rows.length === 0) {
      return {
        success: false,
        error: 'Calendar integration not configured'
      };
    }

    const calcomConfig = JSON.parse(calcomResult.rows[0].value);
    if (!calcomConfig.apiKey) {
      return {
        success: false,
        error: 'Calendar API key not configured'
      };
    }

    // Call Cal.com API to get available slots
    const { startDate, endDate, eventTypeId } = params;
    const calcomUrl = `https://api.cal.com/v1/slots?eventTypeId=${eventTypeId}&startTime=${startDate}T00:00:00.000Z&endTime=${endDate}T23:59:59.999Z&apiKey=${calcomConfig.apiKey}`;
    
    const response = await fetch(calcomUrl);
    if (!response.ok) {
      return {
        success: false,
        error: 'Failed to fetch calendar availability'
      };
    }

    const data = await response.json();
    return {
      success: true,
      availableSlots: data.slots || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function bookAppointment(config, params) {
  try {
    // Check if Cal.com integration is configured
    const calcomResult = await executeQuery(`
      SELECT value FROM platform_settings 
      WHERE key = 'calcom' AND category = 'integrations'
    `);

    if (calcomResult.rows.length === 0) {
      return {
        success: false,
        error: 'Calendar integration not configured'
      };
    }

    const calcomConfig = JSON.parse(calcomResult.rows[0].value);
    if (!calcomConfig.apiKey) {
      return {
        success: false,
        error: 'Calendar API key not configured'
      };
    }

    // Create booking via Cal.com API
    const { eventTypeId, start, responses } = params;
    const bookingData = {
      eventTypeId,
      start,
      responses: responses || {},
      timeZone: 'UTC',
      language: 'en'
    };

    const response = await fetch(`https://api.cal.com/v1/bookings?apiKey=${calcomConfig.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bookingData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || 'Failed to create booking'
      };
    }

    const booking = await response.json();
    return {
      success: true,
      bookingId: booking.id,
      message: 'Appointment booked successfully'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function sendSMS(config, params) {
  try {
    // Check if Twilio integration is configured
    const twilioResult = await executeQuery(`
      SELECT value FROM platform_settings 
      WHERE key = 'twilio_account_sid' AND category = 'twilio'
    `);

    if (twilioResult.rows.length === 0) {
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    // Use TwilioService for SMS
    const twilioService = require('../services/twilioService');
    const { phoneNumber, message } = params;

    const result = await twilioService.sendSMS(phoneNumber, message);
    
    return {
      success: result.success,
      messageId: result.messageId || `sms_${Date.now()}`,
      message: result.success ? 'SMS sent successfully' : result.error
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Health check for functions
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'functions',
    timestamp: new Date().toISOString(),
    endpoints: {
      'agent-functions': 'GET /api/functions/agent/:agentId',
      'create-function': 'POST /api/functions/agent/:agentId',
      'update-function': 'PUT /api/functions/:functionId',
      'delete-function': 'DELETE /api/functions/:functionId',
      'execute-function': 'POST /api/functions/:functionId/execute'
    }
  });
});

module.exports = router;