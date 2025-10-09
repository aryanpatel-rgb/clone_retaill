const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { generateToken, verifyToken } = require('../middleware/auth');
const { validateUserRegistration, validateUserLogin, validateProfileUpdate, validatePasswordChange } = require('../middleware/validation');
const logger = require('../services/logger');

/**
 * Authentication Routes for Chatbot
 * Handles user registration, login, and profile management
 */

// Get database service instance
let databaseService;

// Initialize database service reference
const initializeAuthRoutes = (dbService) => {
  databaseService = dbService;
};

/**
 * POST /auth/register - Register a new user
 */
router.post('/register', validateUserRegistration, async (req, res) => {
  try {
    const { username, email, password, calcomApiKey, calcomEventId } = req.body;

    // Check if database service is available
    if (!databaseService) {
      return res.status(500).json({
        success: false,
        error: 'Database service not available'
      });
    }

    // Check if user already exists
    const existingUser = await databaseService.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Check if username already exists
    const existingUsername = await databaseService.getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        error: 'Username already taken'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userData = {
      username,
      email,
      passwordHash,
      calcomApiKey: calcomApiKey || null,
      calcomEventId: calcomEventId || null
    };

    const user = await databaseService.createUser(userData);

    // Generate JWT token
    const token = generateToken(user);

    logger.info('User registered successfully', { 
      userId: user.id, 
      username: user.username, 
      email: user.email 
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.created_at,
          isActive: user.is_active
        },
        token,
        expiresIn: '7d'
      }
    });

  } catch (error) {
    logger.error('Registration failed:', error);
    
    if (error.code === '23505') { // PostgreSQL unique constraint violation
      if (error.constraint === 'users_email_key') {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }
      if (error.constraint === 'users_username_key') {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

/**
 * POST /auth/login - Login user
 */
router.post('/login', validateUserLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if database service is available
    if (!databaseService) {
      return res.status(500).json({
        success: false,
        error: 'Database service not available'
      });
    }

    // Get user by email
    const user = await databaseService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Update last login
    await databaseService.updateLastLogin(user.id);

    // Generate JWT token
    const token = generateToken(user);

    logger.info('User logged in successfully', { 
      userId: user.id, 
      username: user.username, 
      email: user.email 
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          calcomApiKey: user.calcom_api_key,
          calcomEventId: user.calcom_event_id,
          openaiApiKey: user.openai_api_key,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          isActive: user.is_active
        },
        token,
        expiresIn: '7d'
      }
    });

  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.'
    });
  }
});

/**
 * GET /auth/me - Get current user profile
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if database service is available
    if (!databaseService) {
      return res.status(500).json({
        success: false,
        error: 'Database service not available'
      });
    }

    // Get user data
    const user = await databaseService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user statistics
    const stats = await databaseService.getUserStats(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          calcomApiKey: user.calcom_api_key,
          calcomEventId: user.calcom_event_id,
          openaiApiKey: user.openai_api_key,
          createdAt: user.created_at,
          lastLogin: user.last_login,
          isActive: user.is_active
        },
        stats
      }
    });

  } catch (error) {
    logger.error('Get profile failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

/**
 * PUT /auth/profile - Update user profile
 */
router.put('/profile', verifyToken, validateProfileUpdate, async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Check if database service is available
    if (!databaseService) {
      return res.status(500).json({
        success: false,
        error: 'Database service not available'
      });
    }

    // Check if email is being changed and if it already exists
    if (updateData.email) {
      const existingUser = await databaseService.getUserByEmail(updateData.email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use by another account'
        });
      }
    }

    // Check if username is being changed and if it already exists
    if (updateData.username) {
      const existingUser = await databaseService.getUserByUsername(updateData.username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
    }

    // Update user profile
    const updatedUser = await databaseService.updateUserProfile(userId, updateData);

    logger.info('User profile updated successfully', { 
      userId, 
      updatedFields: Object.keys(updateData) 
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          calcomApiKey: updatedUser.calcom_api_key,
          calcomEventId: updatedUser.calcom_event_id,
          openaiApiKey: updatedUser.openai_api_key,
          updatedAt: updatedUser.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Profile update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * PUT /auth/password - Change user password
 */
router.put('/password', verifyToken, validatePasswordChange, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Check if database service is available
    if (!databaseService) {
      return res.status(500).json({
        success: false,
        error: 'Database service not available'
      });
    }

    // Get user with password hash
    const user = await databaseService.getUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await databaseService.updateUserPassword(userId, newPasswordHash);

    logger.info('User password changed successfully', { userId });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Password change failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

/**
 * POST /auth/verify-token - Verify JWT token
 */
router.post('/verify-token', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

module.exports = {
  router,
  initializeAuthRoutes
};
