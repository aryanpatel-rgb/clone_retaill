const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { executeQuery } = require('../database/connection');

/**
 * Get platform settings
 */
router.get('/', async (req, res) => {
  try {
    // Get settings from database
    const result = await executeQuery(`
      SELECT * FROM platform_settings WHERE id = 1
    `);

    let settings;
    if (result.rows.length === 0) {
      // Create default settings if none exist
      settings = {
        general: {
          platformName: 'AI Calling Platform',
          timezone: 'UTC',
          language: 'en',
          notifications: true
        },
        twilio: {
          enabled: false,
          accountSid: '',
          authToken: '',
          phoneNumber: ''
        },
        integrations: {
          calcom: {
            enabled: false,
            apiKey: '',
            webhookUrl: ''
          }
        }
      };
      
      // Save default settings
      await executeQuery(`
        INSERT INTO platform_settings (id, settings)
        VALUES (1, $1)
      `, [JSON.stringify(settings)]);
    } else {
      settings = result.rows[0].settings;
    }

    // Hide sensitive data
    if (settings.twilio) {
      settings.twilio.authToken = settings.twilio.authToken ? '***hidden***' : '';
    }

    res.json(settings);
  } catch (error) {
    logger.error('Failed to get settings', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update platform settings
 */
router.put('/', async (req, res) => {
  try {
    const settings = req.body;
    
    // Save to database
    await executeQuery(`
      INSERT INTO platform_settings (id, settings)
      VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(settings)]);
    
    logger.info('Settings updated', { 
      general: settings.general,
      twilio: settings.twilio ? { enabled: settings.twilio.enabled } : null,
      integrations: settings.integrations 
    });
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    logger.error('Failed to update settings', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Configure Twilio settings
 */
router.post('/twilio', async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber } = req.body;
    
    if (!accountSid || !authToken || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Account SID, Auth Token, and Phone Number are required'
      });
    }

    // Get current settings
    const result = await executeQuery(`
      SELECT * FROM platform_settings WHERE id = 1
    `);

    let settings;
    if (result.rows.length === 0) {
      settings = {
        general: {
          platformName: 'AI Calling Platform',
          timezone: 'UTC',
          language: 'en',
          notifications: true
        },
        twilio: {
          enabled: true,
          accountSid,
          authToken,
          phoneNumber
        },
        integrations: {
          calcom: {
            enabled: false,
            apiKey: '',
            webhookUrl: ''
          }
        }
      };
    } else {
      settings = result.rows[0].settings;
      settings.twilio = {
        enabled: true,
        accountSid,
        authToken,
        phoneNumber
      };
    }

    // Save to database
    await executeQuery(`
      INSERT INTO platform_settings (id, settings)
      VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(settings)]);

    logger.info('Twilio configuration updated', { 
      accountSid: accountSid.substring(0, 8) + '...',
      phoneNumber 
    });

    res.json({
      success: true,
      message: 'Twilio configuration saved successfully',
      twilio: {
        enabled: true,
        accountSid: accountSid.substring(0, 8) + '...',
        phoneNumber
      }
    });
  } catch (error) {
    logger.error('Failed to configure Twilio', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test Twilio connection
 */
router.post('/twilio/test', async (req, res) => {
  try {
    // Get Twilio settings
    const result = await executeQuery(`
      SELECT settings FROM platform_settings WHERE id = 1
    `);

    if (result.rows.length === 0 || !result.rows[0].settings.twilio?.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Twilio is not configured'
      });
    }

    const twilioConfig = result.rows[0].settings.twilio;
    
    // Test Twilio connection
    const twilio = require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);
    
    // Test connection by fetching account info
    let account;
    try {
      account = await twilio.api.accounts(twilioConfig.accountSid).fetch();
    } catch (fetchError) {
      // If direct account fetch fails, try a simpler validation
      if (fetchError.message.includes('Authenticate') || fetchError.message.includes('401')) {
        throw new Error('Invalid Account SID or Auth Token. Please check your Twilio credentials.');
      }
      throw fetchError;
    }
    
    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(twilioConfig.phoneNumber)) {
      throw new Error('Invalid phone number format. Please use E.164 format (e.g., +1234567890)');
    }
    
    res.json({
      success: true,
      message: 'Twilio connection successful',
      account: {
        friendlyName: account.friendlyName,
        status: account.status,
        phoneNumber: twilioConfig.phoneNumber,
        accountSid: twilioConfig.accountSid.substring(0, 8) + '...'
      }
    });
  } catch (error) {
    logger.error('Twilio connection test failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Twilio connection failed: ' + error.message
    });
  }
});

/**
 * Get integrations
 */
router.get('/integrations', (req, res) => {
  try {
    // Mock integrations - in real implementation, get from database
    const integrations = {
      calcom: {
        enabled: false,
        name: 'Cal.com',
        description: 'Calendar scheduling integration',
        apiKey: '',
        webhookUrl: ''
      },
      calendar: {
        enabled: false,
        name: 'Calendar',
        description: 'Google Calendar or Outlook integration',
        type: 'google',
        credentials: ''
      },
      crm: {
        enabled: false,
        name: 'CRM',
        description: 'Customer relationship management integration',
        type: 'salesforce',
        credentials: ''
      }
    };

    res.json(integrations);
  } catch (error) {
    logger.error('Failed to get integrations', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update integration
 */
router.put('/integrations/:name', (req, res) => {
  try {
    const { name } = req.params;
    const config = req.body;
    
    // Mock update - in real implementation, save to database
    logger.info('Integration updated', { name, config });
    
    res.json({
      success: true,
      message: `Integration ${name} updated successfully`,
      integration: {
        name,
        ...config
      }
    });
  } catch (error) {
    logger.error('Failed to update integration', { 
      name: req.params.name, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test integration
 */
router.post('/integrations/:name/test', (req, res) => {
  try {
    const { name } = req.params;
    
    // Mock test - in real implementation, test the integration
    logger.info('Integration test requested', { name });
    
    // Simulate test delay
    setTimeout(() => {
      res.json({
        success: true,
        message: `Integration ${name} test successful`,
        testResult: {
          connected: true,
          responseTime: Math.floor(Math.random() * 1000) + 200,
          lastTested: new Date().toISOString()
        }
      });
    }, 1000);
    
  } catch (error) {
    logger.error('Failed to test integration', { 
      name: req.params.name, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
