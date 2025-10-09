/**
 * Configuration management for Retaill AI Backend
 */

const path = require('path');

class Config {
  constructor() {
    this.config = {
      // Server configuration
      server: {
        port: process.env.PORT || 3001,
        host: process.env.HOST || 'localhost',
        env: process.env.NODE_ENV || 'development',
        ngrokUrl: process.env.NGROK_URL || `http://localhost:${process.env.PORT || 3001}`
      },

      // Database configuration (PostgreSQL only)
      database: {
        // PostgreSQL configuration
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'retaill_ai',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        // Connection pool settings
        max: process.env.DB_MAX_CONNECTIONS || 20,
        idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT || 30000,
        connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT || 2000
      },

      // JWT configuration
      jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
      },

      // Twilio configuration
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER,
        webhookUrl: process.env.TWILIO_WEBHOOK_URL || `http://localhost:${this.config?.server?.port || 3001}/api/webhooks/twilio`
      },

      // OpenAI configuration
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 200,
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7
      },

      // ElevenLabs configuration
      elevenlabs: {
        apiKey: process.env.ELEVENLABS_API_KEY,
        voiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
      },

      // Retell AI configuration
      retell: {
        apiKey: process.env.RETELL_API_KEY,
        baseUrl: process.env.RETELL_BASE_URL || 'https://api.retellai.com'
      },

      // Cal.com configuration
      calcom: {
        apiKey: process.env.CALCOM_API_KEY,
        baseUrl: process.env.CALCOM_BASE_URL || 'https://api.cal.com/v1',
        webhookSecret: process.env.CALCOM_WEBHOOK_SECRET
      },

      // WebSocket configuration
      websocket: {
        port: process.env.WS_PORT || 3002,
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:5173',
          credentials: true
        }
      },

      // File upload configuration
      uploads: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
        allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,audio/mpeg,audio/wav').split(','),
        destination: process.env.UPLOAD_DESTINATION || path.join(__dirname, '../uploads')
      },

      // Logging configuration
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || path.join(__dirname, '../logs/app.log'),
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
      },

      // Rate limiting
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100 // limit each IP to 100 requests per windowMs
      },

      // CORS configuration
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      }
    };
  }

  get(key) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    let current = this.config;
    
    for (const k of keys) {
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[lastKey] = value;
  }

  getAll() {
    return this.config;
  }

  validate() {
    const errors = [];

    // Validate required environment variables
    if (!this.get('jwt.secret') || this.get('jwt.secret') === 'your-super-secret-jwt-key-change-this-in-production') {
      errors.push('JWT_SECRET must be set to a secure value');
    }

    if (this.get('server.env') === 'production') {
      if (!this.get('openai.apiKey')) {
        errors.push('OPENAI_API_KEY is required in production');
      }
      if (!this.get('twilio.accountSid')) {
        errors.push('TWILIO_ACCOUNT_SID is required in production');
      }
      if (!this.get('twilio.authToken')) {
        errors.push('TWILIO_AUTH_TOKEN is required in production');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Create singleton instance
const config = new Config();

// Validate configuration on startup
const validation = config.validate();
if (!validation.isValid) {
  console.warn('Configuration validation warnings:', validation.errors);
}

module.exports = config;
