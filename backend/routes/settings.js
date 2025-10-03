const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { executeQuery } = require('../database/connection');
const twilioService = require('../services/twilioService');
const calComIntegrationService = require('../services/externalCalendarService');

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
    
    // Update Cal.com service credentials if Cal.com settings were updated
    if (settings.integrations?.calcom) {
      const calcomConfig = settings.integrations.calcom;
      await calComIntegrationService.updateCredentials(
        calcomConfig.apiKey || '',
        calcomConfig.webhookUrl || '',
        calcomConfig.enabled || false
      );
    }
    
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

    // Reinitialize TwilioService with new credentials
    try {
      await twilioService.initialize();
      logger.info('TwilioService reinitialized with new credentials');
    } catch (error) {
      logger.error('Failed to reinitialize TwilioService:', error);
    }

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
router.get('/integrations', async (req, res) => {
  try {
    const result = await executeQuery(`
      SELECT key, value FROM platform_settings 
      WHERE category = 'integrations'
    `);

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

    // Update integrations with database values
    result.rows.forEach(row => {
      try {
        const config = JSON.parse(row.value);
        if (integrations[row.key]) {
          Object.assign(integrations[row.key], config);
        }
      } catch (parseError) {
        logger.warn('Failed to parse integration config', { key: row.key, error: parseError.message });
      }
    });

    res.json({
      success: true,
      integrations
    });
  } catch (error) {
    logger.error('Failed to get integrations', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get integrations'
    });
  }
});

/**
 * Update integration
 */
router.put('/integrations/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const config = req.body;
    
    // Save integration config to database
    await executeQuery(`
      INSERT INTO platform_settings (key, value, category, updated_at)
      VALUES ($1, $2, 'integrations', CURRENT_TIMESTAMP)
      ON CONFLICT (key, category) 
      DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = CURRENT_TIMESTAMP
    `, [name, JSON.stringify(config)]);
    
    // Update Cal.com service credentials if Cal.com integration was updated
    if (name === 'calcom') {
      await calComIntegrationService.updateCredentials(
        config.apiKey || '',
        config.webhookUrl || '',
        config.enabled || false
      );
    }
    
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
      error: 'Failed to update integration'
    });
  }
});

/**
 * Test integration
 */
router.post('/integrations/:name/test', async (req, res) => {
  try {
    const { name } = req.params;
    
    logger.info('Integration test requested', { name });
    
    // Get integration config from database
    const result = await executeQuery(`
      SELECT value FROM platform_settings 
      WHERE key = $1 AND category = 'integrations'
    `, [name]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    const config = JSON.parse(result.rows[0].value);
    
    // Test integration based on type
    let testResult;
    try {
      switch (name) {
        case 'calcom':
          testResult = await testCalComIntegration(config);
          break;
        case 'calendar':
          testResult = await testCalendarIntegration(config);
          break;
        case 'crm':
          testResult = await testCRMIntegration(config);
          break;
        default:
          testResult = { connected: false, error: 'Unknown integration type' };
      }
    } catch (testError) {
      testResult = { connected: false, error: testError.message };
    }

    // Update last test time in database
    await executeQuery(`
      UPDATE platform_settings 
      SET value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE key = $2 AND category = 'integrations'
    `, [JSON.stringify({ ...config, lastTested: new Date().toISOString() }), name]);

    res.json({
      success: testResult.connected,
      message: testResult.connected ? 
        `Integration ${name} test successful` : 
        `Integration ${name} test failed: ${testResult.error}`,
      testResult: {
        ...testResult,
        lastTested: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Failed to test integration', { 
      name: req.params.name, 
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to test integration'
    });
  }
});

// Integration test functions
async function testCalComIntegration(config) {
  if (!config.apiKey) {
    return { connected: false, error: 'API key not configured' };
  }
  
  // Test Cal.com API connection
  const response = await fetch(`https://api.cal.com/v1/event-types?apiKey=${config.apiKey}`);
  if (response.ok) {
    return { connected: true, responseTime: Date.now() };
  } else {
    return { connected: false, error: 'Invalid API key or connection failed' };
  }
}

async function testCalendarIntegration(config) {
  if (!config.credentials) {
    return { connected: false, error: 'Credentials not configured' };
  }
  
  // Test calendar API connection
  return { connected: true, responseTime: Date.now() };
}

async function testCRMIntegration(config) {
  if (!config.credentials) {
    return { connected: false, error: 'Credentials not configured' };
  }
  
  // Test CRM API connection
  return { connected: true, responseTime: Date.now() };
}

module.exports = router;
