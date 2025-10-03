/**
 * Contacts Routes
 * API endpoints for managing contacts with Twilio validation
 */

const express = require('express');
const router = express.Router();
const { pool, executeQuery } = require('../database/connection');
const twilioService = require('../services/twilioService');
const logger = require('../utils/logger');
const { validateContact, validateId } = require('../middleware/validation');

/**
 * Test endpoint to debug issues
 * GET /api/contacts/test
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Contacts route is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get all contacts
 * GET /api/contacts
 */
router.get('/', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT 
        id, name, phone_number, email, company, notes, tags,
        is_verified, verification_status, last_called, call_count,
        created_at, updated_at
      FROM contacts
    `;
    let params = [];
    
    if (search && search !== 'undefined') {
      sql += ' WHERE name ILIKE $1 OR phone_number ILIKE $1 OR email ILIKE $1';
      params.push(`%${search}%`);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await executeQuery(sql, params);
    
    // Parse tags from JSON if they exist
    const processedContacts = result.rows.map(contact => ({
      ...contact,
      tags: contact.tags ? contact.tags : []
    }));
    
    res.json({
      success: true,
      contacts: processedContacts,
      count: processedContacts.length
    });
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts'
    });
  }
});

/**
 * Get contact by ID
 * GET /api/contacts/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(`
      SELECT 
        id, name, phone_number, email, company, notes, tags,
        is_verified, verification_status, last_called, call_count,
        created_at, updated_at
      FROM contacts 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    const contact = result.rows[0];
    
    res.json({
      success: true,
      contact: {
        ...contact,
        tags: contact.tags || []
      }
    });
  } catch (error) {
    logger.error('Error fetching contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact'
    });
  }
});

/**
 * Test POST endpoint to debug issues
 * POST /api/contacts/test
 */
router.post('/test', (req, res) => {
  res.json({
    success: true,
    message: 'POST contacts route is working',
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

/**
 * Add new contact with Twilio validation
 * POST /api/contacts
 */
router.post('/', validateContact, async (req, res) => {
  try {
    logger.info('POST /api/contacts - Starting contact creation', {
      body: req.body
    });
    
    const { name, phone_number, email, company, notes, tags } = req.body;
    
    // Validate required fields
    if (!name || !phone_number) {
      logger.warn('POST /api/contacts - Missing required fields', {
        name: !!name,
        phone_number: !!phone_number
      });
      return res.status(400).json({
        success: false,
        error: 'Name and phone number are required'
      });
    }
    
    // Validate and format phone number
    let processedPhoneNumber = phone_number.replace(/\s+/g, '');
    
    // Auto-add country codes if not present
    if (!processedPhoneNumber.startsWith('+')) {
      const indianMobileRegex = /^[6-9]\d{9}$/;
      const indianWithCountryRegex = /^91[6-9]\d{9}$/;
      const usMobileRegex = /^[2-9]\d{9}$/;
      const usWithCountryRegex = /^1[2-9]\d{9}$/;
      
      if (indianMobileRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+91' + processedPhoneNumber;
      } else if (indianWithCountryRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+' + processedPhoneNumber;
      } else if (usMobileRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+1' + processedPhoneNumber;
      } else if (usWithCountryRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+' + processedPhoneNumber;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format. Please include country code.'
        });
      }
    }
    
    // Validate final phone number format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(processedPhoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone number format'
      });
    }
    
    // Check if contact already exists
    logger.info('POST /api/contacts - Checking for existing contact', {
      phone_number: processedPhoneNumber
    });
    
    const existingContact = await executeQuery(
      'SELECT id FROM contacts WHERE phone_number = $1',
      [processedPhoneNumber]
    );
    
    if (existingContact.rows.length > 0) {
      logger.warn('POST /api/contacts - Contact already exists', {
        phone_number: processedPhoneNumber,
        existing_id: existingContact.rows[0].id
      });
      return res.status(409).json({
        success: false,
        error: 'Contact with this phone number already exists'
      });
    }
    
    // Validate with Twilio if configured
    let verificationStatus = 'pending';
    let isVerified = false;
    
    if (twilioService.isTwilioConfigured()) {
      try {
        // Test if we can make a call to validate the number
        const validationResult = await twilioService.testConnection();
        if (validationResult.success) {
          verificationStatus = 'validated';
          isVerified = true;
        }
      } catch (error) {
        logger.warn('Twilio validation failed for contact', { 
          phone: processedPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
          error: error.message 
        });
      }
    }
    
    // Create contact
    logger.info('POST /api/contacts - Creating contact', {
      name: name.trim(),
      phone_number: processedPhoneNumber,
      email: email?.trim() || null,
      company: company?.trim() || null,
      notes: notes?.trim() || null,
      tags: tags || null,
      is_verified: isVerified,
      verification_status: verificationStatus
    });
    
    const result = await executeQuery(`
      INSERT INTO contacts (name, phone_number, email, company, notes, tags, is_verified, verification_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      name.trim(),
      processedPhoneNumber,
      email?.trim() || null,
      company?.trim() || null,
      notes?.trim() || null,
      tags || null,
      isVerified,
      verificationStatus
    ]);
    
    logger.info('Contact added successfully', {
      contactId: result.rows[0].id,
      name: name.trim(),
      phone: processedPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      verified: isVerified
    });
    
    res.status(201).json({
      success: true,
      contact: result.rows[0],
      message: 'Contact added successfully'
    });
    
  } catch (error) {
    logger.error('Error adding contact:', {
      message: error.message,
      stack: error.stack,
      error: error
    });
    res.status(500).json({
      success: false,
      error: 'Failed to add contact',
      details: error.message
    });
  }
});

/**
 * Update contact
 * PUT /api/contacts/:id
 */
router.put('/:id', validateId, validateContact, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone_number, email, company, notes, tags } = req.body;
    
    // Validate required fields
    if (!name || !phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Name and phone number are required'
      });
    }
    
    // Validate and format phone number
    let processedPhoneNumber = phone_number.replace(/\s+/g, '');
    
    // Auto-add country codes if not present
    if (!processedPhoneNumber.startsWith('+')) {
      const indianMobileRegex = /^[6-9]\d{9}$/;
      const indianWithCountryRegex = /^91[6-9]\d{9}$/;
      const usMobileRegex = /^[2-9]\d{9}$/;
      const usWithCountryRegex = /^1[2-9]\d{9}$/;
      
      if (indianMobileRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+91' + processedPhoneNumber;
      } else if (indianWithCountryRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+' + processedPhoneNumber;
      } else if (usMobileRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+1' + processedPhoneNumber;
      } else if (usWithCountryRegex.test(processedPhoneNumber)) {
        processedPhoneNumber = '+' + processedPhoneNumber;
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format. Please include country code.'
        });
      }
    }
    
    // Check if phone number is already used by another contact
    const existingContact = await executeQuery(
      'SELECT id FROM contacts WHERE phone_number = $1 AND id != $2',
      [processedPhoneNumber, id]
    );
    
    if (existingContact.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Phone number already exists for another contact'
      });
    }
    
    // Update contact
    const result = await executeQuery(`
      UPDATE contacts 
      SET name = $1, phone_number = $2, email = $3, company = $4, notes = $5, tags = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [
      name.trim(),
      processedPhoneNumber,
      email?.trim() || null,
      company?.trim() || null,
      notes?.trim() || null,
      tags || null,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    logger.info('Contact updated successfully', {
      contactId: id,
      name: name.trim(),
      phone: processedPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    });
    
    res.json({
      success: true,
      contact: result.rows[0],
      message: 'Contact updated successfully'
    });
    
  } catch (error) {
    logger.error('Error updating contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact'
    });
  }
});

/**
 * Delete contact
 * DELETE /api/contacts/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await executeQuery(
      'DELETE FROM contacts WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    logger.info('Contact deleted successfully', {
      contactId: id,
      name: result.rows[0].name
    });
    
    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
    
  } catch (error) {
    logger.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact'
    });
  }
});

/**
 * Verify contact phone number with Twilio
 * POST /api/contacts/:id/verify
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!twilioService.isTwilioConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Twilio is not configured. Cannot verify phone numbers.'
      });
    }
    
    // Get contact
    const contactResult = await executeQuery(
      'SELECT * FROM contacts WHERE id = $1',
      [id]
    );
    
    if (contactResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    const contact = contactResult.rows[0];
    
    // Test Twilio connection
    try {
      const validationResult = await twilioService.testConnection();
      if (validationResult.success) {
        // Update contact verification status
        await executeQuery(`
          UPDATE contacts 
          SET is_verified = true, verification_status = 'validated', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [id]);
        
        logger.info('Contact phone number verified', {
          contactId: id,
          phone: contact.phone_number.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
        });
        
        res.json({
          success: true,
          message: 'Phone number verified successfully',
          verified: true
        });
      } else {
        throw new Error('Twilio validation failed');
      }
    } catch (error) {
      // Update contact verification status to failed
      await executeQuery(`
        UPDATE contacts 
        SET verification_status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [id]);
      
      logger.warn('Contact phone number verification failed', {
        contactId: id,
        phone: contact.phone_number.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
        error: error.message
      });
      
      res.status(400).json({
        success: false,
        error: 'Phone number verification failed',
        verified: false
      });
    }
    
  } catch (error) {
    logger.error('Error verifying contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify contact'
    });
  }
});

/**
 * Get contact call history
 * GET /api/contacts/:id/calls
 */
router.get('/:id/calls', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    
    // Check if contact exists
    const contactResult = await executeQuery(
      'SELECT phone_number FROM contacts WHERE id = $1',
      [id]
    );
    
    if (contactResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    const phoneNumber = contactResult.rows[0].phone_number;
    
    // Get calls for this contact
    const callsResult = await executeQuery(`
      SELECT 
        c.id, c.status, c.duration, c.started_at, c.ended_at,
        a.name as agent_name, a.id as agent_id
      FROM calls c
      LEFT JOIN agents a ON c.agent_id = a.id
      WHERE c.phone_number = $1
      ORDER BY c.started_at DESC
      LIMIT $2
    `, [phoneNumber, parseInt(limit)]);
    
    res.json({
      success: true,
      calls: callsResult.rows,
      count: callsResult.rows.length
    });
    
  } catch (error) {
    logger.error('Error fetching contact calls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact calls'
    });
  }
});

module.exports = router;
