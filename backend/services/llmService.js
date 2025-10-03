/**
 * LLM Service - Support for Multiple LLM Providers
 * Inspired by Retell AI's approach to support multiple LLM providers
 */

const { OpenAI } = require('openai');
const config = require('../config/config');
const logger = require('../utils/logger');

class LLMService {
  constructor() {
    this.providers = {
      openai: this.initializeOpenAI(),
      azure: this.initializeAzureOpenAI(),
      openrouter: this.initializeOpenRouter()
    };
    
    this.defaultProvider = config.get('llm.defaultProvider') || 'openai';
  }

  /**
   * Initialize OpenAI provider
   */
  initializeOpenAI() {
    if (!config.get('openai.apiKey')) {
      logger.warn('OpenAI API key not configured');
      return null;
    }

    return new OpenAI({
      apiKey: config.get('openai.apiKey'),
      timeout: 15000,
      maxRetries: 2
    });
  }

  /**
   * Initialize Azure OpenAI provider
   */
  initializeAzureOpenAI() {
    if (!config.get('azure.apiKey') || !config.get('azure.endpoint')) {
      logger.warn('Azure OpenAI not configured');
      return null;
    }

    return new OpenAI({
      apiKey: config.get('azure.apiKey'),
      baseURL: `${config.get('azure.endpoint')}/openai/deployments/${config.get('azure.deployment')}/chat/completions?api-version=${config.get('azure.apiVersion')}`,
      defaultQuery: { 'api-version': config.get('azure.apiVersion') },
      defaultHeaders: {
        'api-key': config.get('azure.apiKey')
      },
      timeout: 15000,
      maxRetries: 2
    });
  }

  /**
   * Initialize OpenRouter provider
   */
  initializeOpenRouter() {
    if (!config.get('openrouter.apiKey')) {
      logger.warn('OpenRouter API key not configured');
      return null;
    }

    return new OpenAI({
      apiKey: config.get('openrouter.apiKey'),
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': config.get('openrouter.appName') || 'Dynamic AI Calling Platform',
        'X-Title': config.get('openrouter.appUrl') || 'https://github.com/yourusername/dynamic-ai-calling-platform'
      },
      timeout: 15000,
      maxRetries: 2
    });
  }

  /**
   * Generate response using specified provider
   */
  async generateResponse(messages, options = {}) {
    const {
      provider = this.defaultProvider,
      model = this.getDefaultModel(provider),
      temperature = 0.7,
      maxTokens = 200,
      timeout = 10000,
      functions = null,
      functionCall = 'auto'
    } = options;

    const llmClient = this.providers[provider];
    if (!llmClient) {
      // Return a fallback response when LLM is not configured
      logger.warn('LLM provider not available, returning fallback response', { provider });
      return {
        content: "Hello! I'm your AI assistant. I'm here to help you. How can I assist you today?",
        usage: { total_tokens: 0 },
        fallback: true
      };
    }

    try {
      logger.info('Generating LLM response', { 
        provider, 
        model, 
        messageCount: messages.length,
        hasFunctions: !!functions
      });

      const requestOptions = {
        model: model,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      };

      // Add function calling if functions are provided
      if (functions && functions.length > 0) {
        requestOptions.functions = functions;
        requestOptions.function_call = functionCall;
      }

      const completion = await Promise.race([
        llmClient.chat.completions.create(requestOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('LLM request timeout')), timeout)
        )
      ]);

      const message = completion.choices[0].message;

      // Handle function calling response
      if (message.function_call) {
        logger.info('Function call detected', { 
          functionName: message.function_call.name,
          arguments: message.function_call.arguments
        });
        
        return {
          content: message.content,
          function_call: message.function_call,
          usage: completion.usage
        };
      }

      const response = message.content;

      if (!response || response.trim().length === 0) {
        throw new Error('Empty response from LLM');
      }

      logger.info('LLM response generated', { 
        provider, 
        model, 
        responseLength: response.length 
      });

      return response.trim();

    } catch (error) {
      logger.error('LLM generation error', { 
        provider, 
        model, 
        error: error.message 
      });

      // Fallback to default provider if current provider fails
      if (provider !== this.defaultProvider) {
        logger.info('Falling back to default provider', { 
          from: provider, 
          to: this.defaultProvider 
        });
        return this.generateResponse(messages, { 
          ...options, 
          provider: this.defaultProvider 
        });
      }

      // If all providers fail, return a fallback response
      logger.warn('All LLM providers failed, returning fallback response', { error: error.message });
      return {
        content: "Hello! I'm your AI assistant. I'm here to help you. How can I assist you today?",
        usage: { total_tokens: 0 },
        fallback: true
      };
    }
  }

  /**
   * Get default model for provider
   */
  getDefaultModel(provider) {
    const defaultModels = {
      openai: config.get('openai.model') || 'gpt-4o-mini',
      azure: config.get('azure.deployment') || 'gpt-4o-mini',
      openrouter: config.get('openrouter.model') || 'openai/gpt-4o-mini'
    };

    return defaultModels[provider];
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    const available = [];
    
    Object.keys(this.providers).forEach(provider => {
      if (this.providers[provider]) {
        available.push({
          name: provider,
          displayName: this.getProviderDisplayName(provider),
          defaultModel: this.getDefaultModel(provider)
        });
      }
    });

    return available;
  }

  /**
   * Get provider display name
   */
  getProviderDisplayName(provider) {
    const displayNames = {
      openai: 'OpenAI',
      azure: 'Azure OpenAI',
      openrouter: 'OpenRouter'
    };

    return displayNames[provider] || provider;
  }

  /**
   * Test provider connection
   */
  async testProvider(provider) {
    try {
      const testMessages = [
        { role: 'user', content: 'Hello, this is a test message.' }
      ];

      await this.generateResponse(testMessages, { 
        provider, 
        maxTokens: 10 
      });

      return { success: true, message: 'Provider is working' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get provider status
   */
  getProviderStatus() {
    const status = {};
    
    Object.keys(this.providers).forEach(provider => {
      status[provider] = {
        configured: !!this.providers[provider],
        displayName: this.getProviderDisplayName(provider),
        defaultModel: this.getDefaultModel(provider)
      };
    });

    return status;
  }
}

// Create singleton instance
const llmService = new LLMService();

module.exports = llmService;
