const express = require('express');
const router = express.Router();
const { executeQuery } = require('../database/connection');
const logger = require('../utils/logger');
const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

// Team member validation rules
const validateTeamMember = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name is required and must be less than 255 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email must be a valid email address'),
  body('role')
    .isIn(['admin', 'manager', 'member', 'viewer'])
    .withMessage('Role must be one of: admin, manager, member, viewer'),
  handleValidationErrors
];

const validateTeamMemberId = [
  param('id')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Team member ID is required'),
  handleValidationErrors
];

/**
 * Get all team members
 */
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT 
        id, name, email, role, status, created_at as joinedAt, 
        last_login as lastActive, avatar, preferences as permissions
      FROM users 
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `);

    const teamMembers = result.rows.map(member => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status || 'active',
      joinedAt: member.joinedat,
      lastActive: member.lastactive,
      avatar: member.avatar,
      permissions: member.permissions || getDefaultPermissions(member.role)
    }));

    res.json({
      success: true,
      teamMembers
    });
  } catch (error) {
    logger.error('Failed to get team members', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get team members'
    });
  }
});

/**
 * Get a specific team member
 */
router.get('/:id', validateTeamMemberId, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        id, name, email, role, status, created_at as joinedAt, 
        last_login as lastActive, avatar, preferences as permissions
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found'
      });
    }

    const member = result.rows[0];
    const teamMember = {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status || 'active',
      joinedAt: member.joinedat,
      lastActive: member.lastactive,
      avatar: member.avatar,
      permissions: member.permissions || getDefaultPermissions(member.role)
    };

    res.json({
      success: true,
      teamMember
    });
  } catch (error) {
    logger.error('Failed to get team member', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get team member'
    });
  }
});

/**
 * Create a new team member
 */
router.post('/', validateTeamMember, async (req, res) => {
  try {
    const { name, email, role } = req.body;
    
    // Check if user already exists
    const existingUser = await executeQuery(`
      SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL
    `, [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create user
    const result = await executeQuery(`
      INSERT INTO users (name, email, password_hash, role, status, preferences, created_at)
      VALUES ($1, $2, $3, $4, 'pending', $5, CURRENT_TIMESTAMP)
      RETURNING id, name, email, role, status, created_at
    `, [name, email, hashedPassword, role, JSON.stringify(getDefaultPermissions(role))]);

    const newMember = result.rows[0];

    // TODO: Send invitation email with temporary password
    logger.info('Team member created', { 
      id: newMember.id, 
      email: newMember.email, 
      role: newMember.role 
    });

    res.status(201).json({
      success: true,
      teamMember: {
        id: newMember.id,
        name: newMember.name,
        email: newMember.email,
        role: newMember.role,
        status: newMember.status,
        joinedAt: newMember.created_at,
        lastActive: null,
        avatar: null,
        permissions: getDefaultPermissions(newMember.role)
      },
      message: 'Team member invited successfully',
      tempPassword: tempPassword // Remove this in production
    });
  } catch (error) {
    logger.error('Failed to create team member', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create team member'
    });
  }
});

/**
 * Update a team member
 */
router.put('/:id', validateTeamMemberId, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Name must be less than 255 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'member', 'viewer'])
    .withMessage('Role must be one of: admin, manager, member, viewer'),
  body('status')
    .optional()
    .isIn(['active', 'pending', 'suspended'])
    .withMessage('Status must be one of: active, pending, suspended'),
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, status, permissions } = req.body;
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
      // Update permissions when role changes
      updates.push(`preferences = $${paramCount++}`);
      values.push(JSON.stringify(permissions || getDefaultPermissions(role)));
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (permissions !== undefined && role === undefined) {
      updates.push(`preferences = $${paramCount++}`);
      values.push(JSON.stringify(permissions));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await executeQuery(`
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING id, name, email, role, status, preferences, created_at, updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found'
      });
    }

    const updatedMember = result.rows[0];

    res.json({
      success: true,
      teamMember: {
        id: updatedMember.id,
        name: updatedMember.name,
        email: updatedMember.email,
        role: updatedMember.role,
        status: updatedMember.status,
        joinedAt: updatedMember.created_at,
        lastActive: null,
        avatar: null,
        permissions: updatedMember.preferences
      },
      message: 'Team member updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update team member', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update team member'
    });
  }
});

/**
 * Delete a team member
 */
router.delete('/:id', validateTeamMemberId, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete user
    const result = await executeQuery(`
      UPDATE users 
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, name, email
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found'
      });
    }

    logger.info('Team member deleted', { 
      id: result.rows[0].id, 
      email: result.rows[0].email 
    });

    res.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    logger.error('Failed to delete team member', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete team member'
    });
  }
});

/**
 * Resend invitation to team member
 */
router.post('/:id/resend-invitation', validateTeamMemberId, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT email, name FROM users 
      WHERE id = $1 AND status = 'pending' AND deleted_at IS NULL
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pending team member not found'
      });
    }

    const member = result.rows[0];

    // TODO: Send invitation email
    logger.info('Invitation resent', { 
      id, 
      email: member.email 
    });

    res.json({
      success: true,
      message: 'Invitation resent successfully'
    });
  } catch (error) {
    logger.error('Failed to resend invitation', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to resend invitation'
    });
  }
});

// Helper functions
function getDefaultPermissions(role) {
  const permissions = {
    admin: ['manage_agents', 'view_analytics', 'manage_team', 'manage_billing', 'manage_settings'],
    manager: ['manage_agents', 'view_analytics', 'view_team'],
    member: ['view_agents', 'view_analytics'],
    viewer: ['view_agents']
  };
  return permissions[role] || permissions.viewer;
}

function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Health check for team routes
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'team',
    timestamp: new Date().toISOString(),
    endpoints: {
      'team-members': 'GET /api/team',
      'get-member': 'GET /api/team/:id',
      'create-member': 'POST /api/team',
      'update-member': 'PUT /api/team/:id',
      'delete-member': 'DELETE /api/team/:id',
      'resend-invitation': 'POST /api/team/:id/resend-invitation'
    }
  });
});

module.exports = router;
