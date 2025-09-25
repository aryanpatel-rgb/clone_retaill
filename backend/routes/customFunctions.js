/**
 * Custom Functions Routes
 * API endpoints for managing custom functions (Retell AI style)
 */

const express = require('express');
const router = express.Router();
const customFunctionService = require('../services/customFunctionService');
const logger = require('../utils/logger');

/**
 * Create a custom function
 * POST /api/functions
 */
router.post('/', async (req, res) => {
  try {
    const functionData = req.body;

    // Validate required fields
    if (!functionData.name || !functionData.description) {
      return res.status(400).json({
        success: false,
        error: 'Function name and description are required'
      });
    }

    // Create function
    const result = await customFunctionService.createFunction(functionData);

    if (result.success) {
      logger.info('Custom function created via API', { 
        functionId: result.functionId, 
        name: functionData.name,
        functionType: functionData.functionType
      });

      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error creating custom function', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create custom function'
    });
  }
});

/**
 * Get all custom functions
 * GET /api/functions
 */
router.get('/', async (req, res) => {
  try {
    const result = await customFunctionService.getFunctions();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error getting custom functions', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get custom functions'
    });
  }
});

/** 
 * Get custom function by ID
 * GET /api/functions/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const functionData = await customFunctionService.getCustomFunction(id);

    if (functionData) {
      res.json({
        success: true,
        function: functionData
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Function not found'
      });
    }

  } catch (error) {
    logger.error('Error getting custom function', { error: error.message, functionId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to get custom function'
    });
  }
});

/**
 * Update custom function
 * PUT /api/functions/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const result = await customFunctionService.updateFunction(id, updateData);

    if (result.success) {
      logger.info('Custom function updated via API', { functionId: id });
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error updating custom function', { error: error.message, functionId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to update custom function'
    });
  }
});

/**
 * Delete custom function
 * DELETE /api/functions/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await customFunctionService.deleteFunction(id);

    if (result.success) {
      logger.info('Custom function deleted via API', { functionId: id });
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error deleting custom function', { error: error.message, functionId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to delete custom function'
    });
  }
  
});

/**
 * Test custom function
 * POST /api/functions/:id/test
 */
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { args = {}, context = {} } = req.body;

    // Get function by ID
    const functionData = await customFunctionService.getCustomFunction(id);
    
    if (!functionData) {
      return res.status(404).json({
        success: false,
        error: 'Function not found'
      });
    }

    // Execute function
    const result = await customFunctionService.executeFunction(functionData.name, args, context);

    logger.info('Custom function tested via API', { 
      functionId: id, 
      functionName: functionData.name,
      success: result.success 
    });

    res.json(result);

  } catch (error) {
    logger.error('Error testing custom function', { 
      error: error.message, 
      functionId: req.params.id 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to test custom function'
    });
  }
});

module.exports = router;