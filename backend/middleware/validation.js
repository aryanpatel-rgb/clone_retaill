const { body, param, query, validationResult } = require('express-validator');

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

// Agent validation rules
const validateAgent = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Agent name is required and must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('aiPrompt')
    .trim()
    .isLength({ min: 10 })
    .withMessage('AI prompt is required and must be at least 10 characters'),
  body('voice')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Voice must be less than 100 characters'),
  body('language')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Language must be less than 50 characters'),
  body('model')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Model must be less than 100 characters'),
  handleValidationErrors
];

// Contact validation rules
const validateContact = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Contact name is required and must be less than 255 characters'),
  body('phone_number')
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be a valid international format'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email must be a valid email address'),
  body('company')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Company name must be less than 255 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
];

// Call validation rules
const validateCall = [
  body('agentId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Agent ID is required'),
  body('phoneNumber')
    .trim()
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be a valid international format'),
  body('customerName')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Customer name must be less than 255 characters'),
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

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// Auth validation rules
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors
];

const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be less than 255 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateAgent,
  validateContact,
  validateCall,
  validateId,
  validatePagination,
  validateLogin,
  validateRegister
};
