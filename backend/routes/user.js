const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../database/connection');
const bcrypt = require('bcryptjs');

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

// User profile validation rules
const validateUserProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be between 1-255 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email must be a valid email address'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be a valid object'),
  handleValidationErrors
];

/**
 * Get user profile
 */
router.get('/profile', async (req, res) => {
  try {
    // Get user ID from token (in real implementation, extract from JWT)
    const userId = req.user?.id || 'user-1'; // Default for development
    
    const result = await executeQuery(`
      SELECT id, name, email, role, company, preferences, created_at, updated_at
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        preferences: user.preferences || {
        notifications: true,
        theme: 'light',
        language: 'en',
        timezone: 'UTC'
      }
      }
    });
  } catch (error) {
    logger.error('Failed to get user profile', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

/**
 * Update user profile
 */
router.put('/profile', validateUserProfile, async (req, res) => {
  try {
    const userId = req.user?.id || 'user-1'; // Default for development
    const { name, email, preferences } = req.body;
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (preferences !== undefined) {
      updates.push(`preferences = $${paramCount++}`);
      values.push(JSON.stringify(preferences));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await executeQuery(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, role, company, preferences, created_at, updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updatedUser = result.rows[0];

    res.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        company: updatedUser.company,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
        preferences: updatedUser.preferences
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update user profile', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile'
    });
  }
});

/**
 * Get user preferences
 */
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user?.id || 'user-1'; // Default for development
    
    const result = await executeQuery(`
      SELECT preferences FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const preferences = result.rows[0].preferences || {
        notifications: true,
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
      emailAlerts: true,
      smsAlerts: false,
      callRecording: true,
      analyticsSharing: false
    };

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    logger.error('Failed to get user preferences', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get user preferences'
    });
  }
});

/**
 * Update user preferences
 */
router.put('/preferences', [
  body('preferences')
    .isObject()
    .withMessage('Preferences must be a valid object'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user?.id || 'user-1'; // Default for development
    const { preferences } = req.body;
    
    const result = await executeQuery(`
      UPDATE users 
      SET preferences = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING preferences, updated_at
    `, [JSON.stringify(preferences), userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      preferences: result.rows[0].preferences,
      updatedAt: result.rows[0].updated_at,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update user preferences', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update user preferences'
    });
  }
});

/**
 * Get user activity/usage stats
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user?.id || 'user-1'; // Default for development
    
    // Get user's total calls
    const callsResult = await executeQuery(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_calls,
        AVG(CASE WHEN status = 'completed' THEN duration ELSE NULL END) as avg_duration,
        SUM(CASE WHEN status = 'completed' THEN duration ELSE 0 END) as total_minutes
      FROM sessions 
      WHERE customer_id IN (
        SELECT phone_number FROM contacts WHERE created_by = $1
      ) OR customer_id LIKE $2
    `, [userId, `%${userId}%`]);

    // Get user's agents count
    const agentsResult = await executeQuery(`
      SELECT COUNT(*) as total_agents
      FROM agents 
      WHERE created_by = $1
    `, [userId]);

    // Get user's contacts count
    const contactsResult = await executeQuery(`
      SELECT COUNT(*) as total_contacts
      FROM contacts 
      WHERE created_by = $1
    `, [userId]);

    // Get monthly usage
    const monthlyResult = await executeQuery(`
      SELECT 
        DATE_TRUNC('month', start_time) as month,
        COUNT(*) as calls,
        SUM(CASE WHEN status = 'completed' THEN duration ELSE 0 END) as minutes
      FROM sessions 
      WHERE customer_id IN (
        SELECT phone_number FROM contacts WHERE created_by = $1
      ) OR customer_id LIKE $2
      AND start_time >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', start_time)
      ORDER BY month DESC
      LIMIT 4
    `, [userId, `%${userId}%`]);

    const calls = callsResult.rows[0];
    const agents = agentsResult.rows[0];
    const contacts = contactsResult.rows[0];
    const monthlyData = monthlyResult.rows;

    const userStats = {
      totalCalls: parseInt(calls.total_calls) || 0,
      totalAgents: parseInt(agents.total_agents) || 0,
      totalContacts: parseInt(contacts.total_contacts) || 0,
      totalMinutes: Math.floor((parseInt(calls.total_minutes) || 0) / 60),
      successRate: calls.total_calls > 0 ? 
        ((parseInt(calls.successful_calls) || 0) / parseInt(calls.total_calls) * 100).toFixed(1) : 0,
      avgCallDuration: parseFloat(calls.avg_duration) || 0,
      lastActive: new Date().toISOString(),
      monthlyUsage: {
        calls: monthlyData.length > 0 ? parseInt(monthlyData[0].calls) : 0,
        minutes: monthlyData.length > 0 ? Math.floor(parseInt(monthlyData[0].minutes) / 60) : 0,
        agents: parseInt(agents.total_agents) || 0
      },
      weeklyTrend: monthlyData.slice(0, 4).map(row => ({
        week: `Week ${new Date(row.month).getMonth() + 1}`,
        calls: parseInt(row.calls),
        minutes: Math.floor(parseInt(row.minutes) / 60)
      }))
    };

    res.json({
      success: true,
      stats: userStats
    });
  } catch (error) {
    logger.error('Failed to get user stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get user stats'
    });
  }
});

/**
 * Change user password
 */
router.put('/password', [
  body('currentPassword')
    .isLength({ min: 6 })
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user?.id || 'user-1'; // Default for development
    const { currentPassword, newPassword } = req.body;
    
    // Get current user
    const userResult = await executeQuery(`
      SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await executeQuery(`
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [hashedPassword, userId]);
    
    logger.info('Password changed successfully', { userId });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Failed to change password', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

/**
 * Delete user account
 */
router.delete('/account', [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password is required for account deletion'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user?.id || 'user-1'; // Default for development
    const { password } = req.body;
    
    // Get current user
    const userResult = await executeQuery(`
      SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userResult.rows[0].password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Soft delete user (set deleted_at timestamp)
    await executeQuery(`
      UPDATE users 
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [userId]);
    
    logger.info('Account deleted successfully', { userId });
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete account', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

// Health check for user routes
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user',
    timestamp: new Date().toISOString(),
    endpoints: {
      'profile': 'GET /api/user/profile',
      'update-profile': 'PUT /api/user/profile',
      'preferences': 'GET /api/user/preferences',
      'update-preferences': 'PUT /api/user/preferences',
      'stats': 'GET /api/user/stats',
      'change-password': 'PUT /api/user/password',
      'delete-account': 'DELETE /api/user/account'
    }
  });
});

module.exports = router;