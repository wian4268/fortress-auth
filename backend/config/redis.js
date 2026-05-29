const { createClient } = require('redis');

let redisClient = null;
let isConnected = false;

/**
 * Connect to Redis
 */
const connectRedis = async () => {
  try {
    // Check if Redis URL is provided
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    console.log('📡 Connecting to Redis...');
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          // Maximum retry delay of 10 seconds
          return Math.min(retries * 100, 10000);
        },
        connectTimeout: 10000,
      },
      // Enable legacy mode for compatibility with older packages
      legacyMode: false,
    });

    // Event handlers
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('🟢 Redis connected');
      isConnected = true;
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis ready');
    });

    redisClient.on('end', () => {
      console.log('🔴 Redis connection ended');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    
    return redisClient;
  } catch (error) {
    console.warn('⚠️  Redis connection failed. Continuing without Redis:', error.message);
    console.warn('   Session store will fall back to memory storage');
    isConnected = false;
    return null;
  }
};

/**
 * Get Redis client instance
 */
const getRedisClient = () => {
  return redisClient;
};

/**
 * Check if Redis is connected
 */
const isRedisConnected = () => {
  return isConnected && redisClient && redisClient.isOpen;
};

/**
 * Set a key in Redis with optional expiry
 */
const setCache = async (key, value, expiryInSeconds = 3600) => {
  try {
    if (!isRedisConnected()) return false;
    
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
    await redisClient.set(key, stringValue, {
      EX: expiryInSeconds,
    });
    return true;
  } catch (error) {
    console.error('Redis set error:', error.message);
    return false;
  }
};

/**
 * Get a key from Redis
 */
const getCache = async (key) => {
  try {
    if (!isRedisConnected()) return null;
    
    const value = await redisClient.get(key);
    
    if (!value) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error('Redis get error:', error.message);
    return null;
  }
};

/**
 * Delete a key from Redis
 */
const deleteCache = async (key) => {
  try {
    if (!isRedisConnected()) return false;
    
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Redis delete error:', error.message);
    return false;
  }
};

/**
 * Increment a counter in Redis
 */
const incrementCounter = async (key, expiryInSeconds = 3600) => {
  try {
    if (!isRedisConnected()) return 0;
    
    const value = await redisClient.incr(key);
    
    // Set expiry on first increment
    if (value === 1) {
      await redisClient.expire(key, expiryInSeconds);
    }
    
    return value;
  } catch (error) {
    console.error('Redis increment error:', error.message);
    return 0;
  }
};

/**
 * Gracefully shutdown Redis connection
 */
const disconnectRedis = async () => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      console.log('Redis disconnected gracefully');
    }
  } catch (error) {
    console.error('Redis disconnect error:', error.message);
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  isRedisConnected,
  setCache,
  getCache,
  deleteCache,
  incrementCounter,
  disconnectRedis,
};