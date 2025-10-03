/**
 * Custom Functions Routes
 * API endpoints for managing custom functions (Retell AI style)
 */

const express = require('express');
const router = express.Router();
const customFunctionService = require('../services/customFunctionService');
const logger = require('../utils/logger');
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

// Custom function validation rules
const validateCustomFunction = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Function name is required and must be less than 255 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description is required and must be between 10-1000 characters'),
  body('functionType')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Function type must be less than 100 characters'),
  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be a valid object'),
  handleValidationErrors
];

// ID parameter validation
const validateId = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('ID parameter is required'),
  handleValidationErrors
];

/**
 * Create a custom function
 * POST /api/custom-functions
 */
router.post('/', validateCustomFunction, async (req, res) => {
  try {
    const functionData = req.body;

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
 * GET /api/custom-functions
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
    logger.error('Error fetching custom functions', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch custom functions'
    });
  }
});

/**
 * Get a specific custom function
 * GET /api/custom-functions/:id
 */
router.get('/:id', validateId, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await customFunctionService.getFunctionById(id);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    logger.error('Error fetching custom function', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch custom function'
    });
  }
});

/**
 * Update a custom function
 * PUT /api/custom-functions/:id
 */
router.put('/:id', validateId, validateCustomFunction, async (req, res) => {
  try {
    const { id } = req.params;
    const functionData = req.body;

    const result = await customFunctionService.updateFunction(id, functionData);

    if (result.success) {
      logger.info('Custom function updated via API', { 
        functionId: id,
        name: functionData.name
      });

      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error updating custom function', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update custom function'
    });
  }
});

/**
 * Delete a custom function
 * DELETE /api/custom-functions/:id
 */
router.delete('/:id', validateId, async (req, res) => {
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
    logger.error('Error deleting custom function', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete custom function'
    });
  }
});

/**
 * Test a custom function
 * POST /api/custom-functions/:id/test
 */
router.post('/:id/test', validateId, async (req, res) => {
  try {
    const { id } = req.params;
    const { params } = req.body;

    const result = await customFunctionService.testFunction(id, params);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Error testing custom function', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to test custom function'
    });
  }
});

module.exports = router;