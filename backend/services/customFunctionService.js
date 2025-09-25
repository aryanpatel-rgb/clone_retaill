/**
 * Custom Function Service
 * Manages user-defined functions with their configurations (like Retell AI)
 */

const config = require('../config/config');
const logger = require('../utils/logger');
const databaseService = require('./databaseService');

class CustomFunctionService {
  constructor() {
    this.functions = new Map();
    this._initializeDatabase();
  }

  /**
   * Initialize database tables for custom functions
   */
  async _initializeDatabase() {
    try {
      // Database service initializes automatically, just wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      logger.info('Custom function service initialized');
    } catch (error) {
      logger.error('Failed to initialize custom function service', { error: error.message });
    }
  }

  /**
   * Create a custom function
   */
  async createFunction(functionData) {
    try {
      const {
        name,
        description,
        apiKey,
        eventTypeId,
        timezone = 'UTC',
        functionType = 'calcom', // calcom, internal, utility
        parameters = {},
        userId = 'default'
      } = functionData;

      // Validate required fields
      if (!name || !description) {
        throw new Error('Function name and description are required');
      }

      if (functionType === 'calcom' && (!apiKey || !eventTypeId)) {
        throw new Error('API key and Event Type ID are required for Cal.com functions');
      }

      const functionId = `func_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const functionConfig = {
        id: functionId,
        name,
        description,
        apiKey,
        eventTypeId,
        timezone,
        functionType,
        parameters,
        userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store in database
      await databaseService.createCustomFunction(functionConfig);
      
      // Register the function
      this._registerFunction(functionConfig);

      logger.info('Custom function created', { functionId, name, functionType });
      
      return {
        success: true,
        functionId,
        function: functionConfig
      };

    } catch (error) {
      logger.error('Error creating custom function', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all custom functions for a user
   */
  async getFunctions(userId = 'default') {
    try {
      const functions = await databaseService.getCustomFunctions(userId);
      return {
        success: true,
        functions
      };
    } catch (error) {
      logger.error('Error getting custom functions', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update a custom function
   */
  async updateFunction(functionId, updateData) {
    try {
      const updatedFunction = await databaseService.updateCustomFunction(functionId, {
        ...updateData,
        updatedAt: new Date().toISOString()
      });

      if (updatedFunction) {
        // Re-register the function
        this._registerFunction(updatedFunction);
        
        logger.info('Custom function updated', { functionId });
        return {
          success: true,
          function: updatedFunction
        };
      } else {
        return {
          success: false,
          error: 'Function not found'
        };
      }
    } catch (error) {
      logger.error('Error updating custom function', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a custom function
   */
  async deleteFunction(functionId) {
    try {
      const deleted = await databaseService.deleteCustomFunction(functionId);
      
      if (deleted) {
        // Remove from registry
        this.functions.delete(functionId);
        
        logger.info('Custom function deleted', { functionId });
        return {
          success: true
        };
      } else {
        return {
          success: false,
          error: 'Function not found'
        };
      }
    } catch (error) {
      logger.error('Error deleting custom function', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Register a function in the registry
   */
  _registerFunction(functionConfig) {
    const { id, name, function_type, apiKey, eventTypeId, timezone, parameters } = functionConfig;
    const functionType = function_type; // Map database field to expected variable name
    
    // Create function implementation based on type
    let implementation;
    
    switch (functionType) {
      case 'calcom':
        implementation = this._createCalComFunction(apiKey, eventTypeId, timezone, parameters);
        break;
      case 'internal':
        implementation = this._createInternalFunction(parameters);
        break;
      case 'utility':
        implementation = this._createUtilityFunction(parameters);
        break;
      default:
        throw new Error(`Unknown function type: ${functionType}`);
    }

    this.functions.set(name, {
      id,
      config: functionConfig,
      implementation
    });

    logger.info('Function registered', { functionName: name, functionType });
  }

  /**
   * Create Cal.com function implementation
   */
  _createCalComFunction(apiKey, eventTypeId, timezone, parameters) {
    return async (args, context) => {
      try {
        // Use the custom API key and event type ID
        const calComService = require('./calComService');
        
        // Temporarily override the API key for this function call
        const originalApiKey = calComService.apiKey;
        calComService.apiKey = apiKey;

        // Determine function behavior based on name
        const functionName = context.functionName || '';
        
        if (functionName.includes('check') || functionName.includes('availability')) {
          // Check availability function
          const { date, time } = args;
          const startDate = new Date(`${date}T${time || '00:00:00'}`);
          const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
          
          const result = await calComService.getAvailableSlots(
            eventTypeId,
            startDate.toISOString(),
            endDate.toISOString(),
            30
          );

          return {
            success: true,
            available: result.slots && result.slots.length > 0,
            slots: result.slots || [],
            provider: 'calcom',
            timezone
          };
        } else if (functionName.includes('book') || functionName.includes('appointment')) {
          // Book appointment function
          const { customerName, customerEmail, startTime } = args;
          
          const bookingData = {
            customerName,
            customerEmail,
            startTime,
            endTime: new Date(new Date(startTime).getTime() + 30 * 60 * 1000).toISOString(),
            timezone
          };

          const result = await calComService.createBooking({
            eventTypeId,
            ...bookingData
          });

          return {
            success: true,
            bookingId: result.bookingId || `booking-${Date.now()}`,
            provider: 'calcom',
            timezone,
            message: 'Appointment booked successfully'
          };
        }

        // Restore original API key
        calComService.apiKey = originalApiKey;

        return {
          success: false,
          error: 'Unknown function type'
        };

      } catch (error) {
        logger.error('Error executing Cal.com function', { error: error.message });
        return {
          success: false,
          error: error.message
        };
      }
    };
  }

  /**
   * Create internal function implementation
   */
  _createInternalFunction(parameters) {
    return async (args, context) => {
      // Implementation for internal functions
      return {
        success: true,
        message: 'Internal function executed',
        data: args
      };
    };
  }

  /**
   * Create utility function implementation
   */
  _createUtilityFunction(parameters) {
    return async (args, context) => {
      // Implementation for utility functions
      return {
        success: true,
        message: 'Utility function executed',
        data: args
      };
    };
  }

  /**
   * Execute a custom function
   */
  async executeFunction(functionName, args = {}, context = {}) {
    const functionData = this.functions.get(functionName);
    
    if (!functionData) {
      throw new Error(`Custom function '${functionName}' not found`);
    }

    try {
      logger.info('Executing custom function', { functionName, args });
      
      const result = await functionData.implementation(args, {
        ...context,
        functionName,
        functionConfig: functionData.config
      });

      logger.info('Custom function executed successfully', { functionName, success: result.success });
      return result;

    } catch (error) {
      logger.error('Error executing custom function', { functionName, error: error.message });
      throw error;
    }
  }

  /**
   * Get function by name
   */
  getFunction(functionName) {
    return this.functions.get(functionName);
  }

  /**
   * Check if function exists
   */
  hasFunction(functionName) {
    return this.functions.has(functionName);
  }

  /**
   * Get all registered function names
   */
  getAllFunctionNames() {
    return Array.from(this.functions.keys());
  }

  /**
   * Load functions from database on startup
   */
  async loadFunctionsFromDatabase() {
    try {
      const functions = await databaseService.getCustomFunctions();
      
      for (const func of functions) {
        this._registerFunction(func);
      }

      logger.info('Loaded custom functions from database', { count: functions.length });
    } catch (error) {
      logger.error('Error loading functions from database', { error: error.message });
    }
  }
}

module.exports = new CustomFunctionService();

