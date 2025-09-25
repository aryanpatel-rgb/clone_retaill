const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class ElevenLabsService {
  constructor() {
    this.apiKey = config.get('elevenlabs.apiKey');
    this.voiceId = config.get('elevenlabs.voiceId');
    this.model = config.get('elevenlabs.model');
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.ttsCache = new Map(); // Cache for common TTS responses
    
    // Pre-warm cache with most common responses
    this.preWarmCache();
  }

  async getVoices() {
    try {
      const response = await axios.get(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });
      
      logger.info('Retrieved available voices', { count: response.data.voices.length });
      return response.data.voices;
    } catch (error) {
      logger.error('Error fetching voices from ElevenLabs', error.message);
      throw new Error('Failed to fetch voices');
    }
  }

  async generateSpeech(text, voiceId = null, options = {}) {
    try {
      const targetVoiceId = voiceId || this.voiceId;
      
      const requestData = {
        text: text,
        model_id: options.model || this.model,
        voice_settings: {
          stability: options.stability || 0.25,  // Lower for faster generation
          similarity_boost: options.similarityBoost || 0.75,  // Lower for faster processing
          style: options.style || 0.60,  // Optimized for speed
          use_speaker_boost: options.useSpeakerBoost || true
        }
      };

      logger.info('Generating speech', { 
        textLength: text.length, 
        voiceId: targetVoiceId,
        model: requestData.model_id 
      });

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${targetVoiceId}`,
        requestData,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'arraybuffer',
          timeout: 4000 // 4 second timeout for faster responses
        }
      );

      logger.info('Speech generated successfully', { 
        audioSize: response.data.byteLength 
      });

      return response.data;
    } catch (error) {
      logger.error('Error generating speech with ElevenLabs', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      throw new Error('Failed to generate speech');
    }
  }

  async generateSpeechStream(text, voiceId = null, options = {}) {
    try {
      const targetVoiceId = voiceId || this.voiceId;
      
      const requestData = {
        text: text,
        model_id: options.model || this.model,
        voice_settings: {
          stability: options.stability || 0.25,  // Lower for faster generation
          similarity_boost: options.similarityBoost || 0.75,  // Lower for faster processing
          style: options.style || 0.60,  // Optimized for speed
          use_speaker_boost: options.useSpeakerBoost || true
        }
      };

      logger.info('Generating speech stream', { 
        textLength: text.length, 
        voiceId: targetVoiceId 
      });

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${targetVoiceId}/stream`,
        requestData,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          },
          responseType: 'stream',
          timeout: 4000 // 4 second timeout for faster responses
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error generating speech stream with ElevenLabs', {
        error: error.message,
        status: error.response?.status
      });
      throw new Error('Failed to generate speech stream');
    }
  }

  async getVoiceSettings(voiceId = null) {
    try {
      const targetVoiceId = voiceId || this.voiceId;
      
      const response = await axios.get(
        `${this.baseUrl}/voices/${targetVoiceId}/settings`,
        {
          headers: {
            'xi-api-key': this.apiKey
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error fetching voice settings', error.message);
      throw new Error('Failed to fetch voice settings');
    }
  }

  async updateVoiceSettings(voiceId = null, settings = {}) {
    try {
      const targetVoiceId = voiceId || this.voiceId;
      
      const response = await axios.post(
        `${this.baseUrl}/voices/${targetVoiceId}/settings/edit`,
        settings,
        {
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error updating voice settings', error.message);
      throw new Error('Failed to update voice settings');
    }
  }

  // ULTRA-FAST method for instant phone speech
  async generatePhoneSpeech(text, options = {}) {
    const phoneOptimizedOptions = {
      stability: 0.20,          // Very low for fastest generation
      similarityBoost: 0.65,    // Lower for speed
      style: 0.50,              // Moderate for balance of quality and speed
      useSpeakerBoost: true,    // Better for phone audio
      model: 'eleven_turbo_v2', // Fastest model
      optimize_streaming_latency: 4, // Maximum speed optimization
      ...options
    };

    return this.generateSpeechStream(text, null, phoneOptimizedOptions);
  }

  // Ultra-fast streaming for real-time responses
  async generateInstantSpeech(text, options = {}) {
    try {
      // Start performance monitoring
      // Performance tracking removed for simplicity
      
      // Check cache first for common responses
      const cacheKey = this.generateTtsCacheKey(text, options);
      const cachedAudio = this.ttsCache.get(cacheKey);
      if (cachedAudio && (Date.now() - cachedAudio.timestamp) < 1200000) { // 20 min cache for better performance
        logger.info('Using cached TTS', { textLength: text.length, cacheKey });
        // Performance tracking removed
        return this.createStreamFromBuffer(cachedAudio.buffer);
      }

      // ULTRA-FAST voice settings for instant responses
      const optimizedOptions = {
        stability: 0.20,          // Very low for fastest generation
        similarityBoost: 0.65,    // Lower for maximum speed
        style: 0.50,              // Moderate for speed/quality balance
        useSpeakerBoost: true,    // Better clarity for phone audio
        model: 'eleven_turbo_v2', // Fastest model for real-time responses
        optimize_streaming_latency: 4, // Maximum optimization for instant responses
        ...options
      };

      // Add timeout to prevent hanging - very short for speed
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TTS timeout')), 2000)
      );

      const streamPromise = this.generateSpeechStream(text, null, optimizedOptions);
      
      const stream = await Promise.race([streamPromise, timeoutPromise]);
      
      // Cache the audio for common responses
      if (this.shouldCacheTts(text)) {
        this.cacheTtsResponse(cacheKey, stream);
      }
      
      // End performance tracking
      // Performance tracking removed
      
      return stream;
    } catch (error) {
      logger.error('Instant speech generation failed', { error: error.message });
      // Performance tracking removed
      throw error;
    }
  }

  // Check API usage and limits
  async getApiUsage() {
    try {
      const response = await axios.get(`${this.baseUrl}/user/subscription`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Error fetching API usage', error.message);
      throw new Error('Failed to fetch API usage');
    }
  }

  // TTS Cache management methods
  generateTtsCacheKey(text, options = {}) {
    const normalizedText = text.toLowerCase().trim();
    const optionsKey = JSON.stringify({
      voiceId: options.voiceId || this.voiceId,
      model: options.model || 'eleven_turbo_v2'
    });
    return `${normalizedText}_${optionsKey}`;
  }

  shouldCacheTts(text) {
    // Cache common responses that are likely to be repeated
    const commonResponses = [
      'hi! what\'s your name?',
      'perfect. what date and time work for you?',
      'what date and time work for you?',
      'thank you, have a great day!',
      'say that again?',
      'is that correct?',
      'what\'s your correct name and phone number?',
      'please wait, we\'re booking your slot...',
      'perfect!',
      'awesome!',
      'fantastic!',
      'wonderful!',
      'would you like me to book it?',
      'should i book that for you?',
      'is now a good time to talk?',
      'your appointment is confirmed',
      'what time tomorrow works best',
      'that\'s totally fine!',
      'what other date works for you?',
      'morning or afternoon slots'
    ];
    
    const normalizedText = text.toLowerCase().trim();
    return commonResponses.some(response => 
      normalizedText.includes(response) || response.includes(normalizedText)
    );
  }

  async cacheTtsResponse(cacheKey, stream) {
    try {
      // Convert stream to buffer for caching
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      
      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      const buffer = Buffer.concat(chunks);
      
      this.ttsCache.set(cacheKey, {
        buffer,
        timestamp: Date.now()
      });
      
      // Clean old cache entries (keep more for better performance)
      if (this.ttsCache.size > 150) {
        const entries = Array.from(this.ttsCache.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        this.ttsCache.clear();
        entries.slice(0, 100).forEach(([key, value]) => {
          this.ttsCache.set(key, value);
        });
      }
    } catch (error) {
      logger.error('Error caching TTS response', { error: error.message });
    }
  }

  createStreamFromBuffer(buffer) {
    const { Readable } = require('stream');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

  /**
   * Pre-warm cache with most common responses for instant delivery
   */
  async preWarmCache() {
    try {
      logger.info('Pre-warming TTS cache for instant responses');
      
      const commonPhrases = [
        'Perfect!',
        'Awesome!',
        'Fantastic!',
        'Would you like me to book it?',
        'Should I book that for you?',
        'What date and time work best for you?',
        'That\'s totally fine!',
        'Your appointment is confirmed',
        'Is now a good time to talk?'
      ];
      
      // Pre-warm in background after 3 seconds
      setTimeout(async () => {
        for (const phrase of commonPhrases) {
          try {
            await this.generateInstantSpeech(phrase);
            // Very small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (error) {
            logger.warn('Failed to pre-warm phrase', { phrase, error: error.message });
          }
        }
        logger.info('TTS cache pre-warming completed', { phrases: commonPhrases.length });
      }, 3000);
      
    } catch (error) {
      logger.error('Pre-warming error', { error: error.message });
    }
  }
}

module.exports = new ElevenLabsService();
