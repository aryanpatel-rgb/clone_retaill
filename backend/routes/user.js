const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * Get user profile
 */
router.get('/profile', (req, res) => {
  try {
    // Mock user profile - in real implementation, get from database
    const userProfile = {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@company.com',
      role: 'admin',
      company: 'AI Solutions Inc.',
      createdAt: new Date().toISOString(),
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en',
        timezone: 'UTC'
      }
    };

    res.json(userProfile);
  } catch (error) {
    logger.error('Failed to get user profile', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update user profile
 */
router.put('/profile', (req, res) => {
  try {
    const { name, email, preferences } = req.body;
    
    // Mock update - in real implementation, update database
    const updatedProfile = {
      id: 'user-1',
      name: name || 'John Doe',
      email: email || 'john@company.com',
      role: 'admin',
      company: 'AI Solutions Inc.',
      updatedAt: new Date().toISOString(),
      preferences: {
        notifications: true,
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        ...preferences
      }
    };

    logger.info('User profile updated', { userId: updatedProfile.id });
    
    res.json(updatedProfile);
  } catch (error) {
    logger.error('Failed to update user profile', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
