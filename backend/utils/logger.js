const winston = require('winston');
const path = require('path');

/**
 * Enhanced Logging System
 * Provides structured logging with different levels and formats
 */
class Logger {
  constructor() {
    this.logger = this._createLogger();
  }

  /**
   * Create Winston logger instance
   * @returns {winston.Logger} Configured logger
   */
  _createLogger() {
    const transports = [];

    // Console transport - always enabled
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        )
      })
    );

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      defaultMeta: { 
        service: 'retail-ai-platform',
        version: process.env.npm_package_version || '1.0.0'
      },
      transports,
      exitOnError: false
    });
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.logger.info(message, this._sanitizeMeta(meta));
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta = {}) {
    this.logger.error(message, this._sanitizeMeta(meta));
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.logger.warn(message, this._sanitizeMeta(meta));
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.logger.debug(message, this._sanitizeMeta(meta));
  }

  /**
   * Log API request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  logRequest(req, res, duration) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length')
    };

    if (res.statusCode >= 400) {
      this.warn('API Request', meta);
    } else {
      this.info('API Request', meta);
    }
  }

  /**
   * Log call event
   * @param {string} event - Event type
   * @param {string} callSid - Call SID
   * @param {Object} data - Event data
   */
  logCallEvent(event, callSid, data = {}) {
    this.info(`Call Event: ${event}`, {
      callSid,
      event,
      ...this._sanitizeCallData(data)
    });
  }

  /**
   * Log AI processing
   * @param {string} callSid - Call SID
   * @param {string} operation - Operation type
   * @param {Object} data - Processing data
   */
  logAIProcessing(callSid, operation, data = {}) {
    this.info(`AI Processing: ${operation}`, {
      callSid,
      operation,
      ...this._sanitizeCallData(data)
    });
  }

  /**
   * Log external service interaction
   * @param {string} service - Service name
   * @param {string} operation - Operation type
   * @param {Object} data - Interaction data
   */
  logExternalService(service, operation, data = {}) {
    this.info(`External Service: ${service} - ${operation}`, {
      service,
      operation,
      ...this._sanitizeMeta(data)
    });
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in ms
   * @param {Object} meta - Additional metadata
   */
  logPerformance(operation, duration, meta = {}) {
    const level = duration > 5000 ? 'warn' : 'info';
    this[level](`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...meta
    });
  }

  /**
   * Sanitize metadata to remove sensitive information
   * @param {Object} meta - Metadata to sanitize
   * @returns {Object} Sanitized metadata
   */
  _sanitizeMeta(meta) {
    const sanitized = { ...meta };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this._sanitizeMeta(sanitized[key]);
      }
    });

    return sanitized;
  }

  /**
   * Sanitize call data
   * @param {Object} data - Call data to sanitize
   * @returns {Object} Sanitized call data
   */
  _sanitizeCallData(data) {
    const sanitized = { ...data };
    
    // Mask phone numbers
    if (sanitized.phoneNumber) {
      sanitized.phoneNumber = this._maskPhoneNumber(sanitized.phoneNumber);
    }
    if (sanitized.customerPhone) {
      sanitized.customerPhone = this._maskPhoneNumber(sanitized.customerPhone);
    }
    if (sanitized.from) {
      sanitized.from = this._maskPhoneNumber(sanitized.from);
    }
    if (sanitized.to) {
      sanitized.to = this._maskPhoneNumber(sanitized.to);
    }

    return this._sanitizeMeta(sanitized);
  }

  /**
   * Mask phone number for privacy
   * @param {string} phoneNumber - Phone number to mask
   * @returns {string} Masked phone number
   */
  _maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return phoneNumber;
    }
    
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length < 4) {
      return phoneNumber;
    }
    
    return phoneNumber.replace(/\d(?=\d{4})/g, '*');
  }

  /**
   * Create child logger with additional context
   * @param {Object} context - Additional context
   * @returns {Object} Child logger
   */
  child(context) {
    return {
      info: (message, meta = {}) => this.info(message, { ...context, ...meta }),
      error: (message, meta = {}) => this.error(message, { ...context, ...meta }),
      warn: (message, meta = {}) => this.warn(message, { ...context, ...meta }),
      debug: (message, meta = {}) => this.debug(message, { ...context, ...meta })
    };
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;