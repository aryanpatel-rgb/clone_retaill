const jwt = require('jsonwebtoken');
const logger = require('../services/logger');

/**
 * Authentication Middleware for Chatbot
 * Handles JWT token verification and user authentication
 */

// JWT Secret - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

/**
 * Verify JWT token middleware
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token format' 
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Add user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username
    };

    logger.info('Token verified successfully', { 
      userId: req.user.id, 
      email: req.user.email 
    });

    next();
  } catch (error) {
    logger.error('Token verification failed', { error: error.message });
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token expired' 
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'Token verification failed' 
    });
  }
};

/**
 * Optional token verification - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username
    };

    next();
  } catch (error) {
    // If token is invalid, continue without user info
    req.user = null;
    next();
  }
};

/**
 * Generate JWT token
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username
  };

  const options = {
    expiresIn: '7d', // Token expires in 7 days
    issuer: 'chatbot-ai',
    audience: 'chatbot-users'
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

/**
 * Extract user ID from token without verification (for logging)
 */
const extractUserIdFromToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded ? decoded.id : null;
  } catch (error) {
    return null;
  }
};

module.exports = {
  verifyToken,
  optionalAuth,
  generateToken,
  extractUserIdFromToken,
  JWT_SECRET
};
