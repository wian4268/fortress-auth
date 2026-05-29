const rateLimit = require('express-rate-limit');

/**
 * Create a rate limiter with customizable options
 */
const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
    max: options.max || 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000 / 60),
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: (req) => {
      // Use combination of IP and user ID for better rate limiting
      const userId = req.user?.id || 'anonymous';
      return `${req.ip}_${userId}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks and trusted IPs
      if (req.path === '/health') return true;
      if (req.ip === '127.0.0.1' || req.ip === '::1') return true;
      return false;
    },
    handler: (req, res) => {
      console.warn('Rate limit exceeded:', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000 / 60) || 15,
      });
    },
  });
};

/**
 * Strict rate limiter for login attempts
 */
const createLoginLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many login attempts. Please try again after 15 minutes.',
    },
    keyGenerator: (req) => {
      // Rate limit by IP and email combination
      const email = req.body?.email || 'unknown';
      return `${req.ip}_${email.toLowerCase()}`;
    },
    handler: (req, res) => {
      console.warn('Login rate limit exceeded:', {
        ip: req.ip,
        email: req.body?.email ? '[REDACTED]' : undefined,
      });
      
      res.status(429).json({
        error: 'Too many login attempts. Account temporarily locked for 15 minutes.',
        retryAfter: 15,
      });
    },
  });
};

/**
 * Rate limiter for registration endpoint
 */
const createRegistrationLimiter = () => {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many registration attempts. Please try again later.',
    },
    keyGenerator: (req) => {
      return req.ip;
    },
    skipSuccessfulRequests: false,
  });
};

/**
 * API rate limiter for general endpoints
 */
const createApiLimiter = () => {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'API rate limit exceeded. Please slow down.',
    },
  });
};

/**
 * Rate limiter for 2FA attempts
 */
const createTwoFactorLimiter = () => {
  return rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3, // 3 attempts per 5 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'Too many 2FA attempts. Please try again in 5 minutes.',
    },
    keyGenerator: (req) => {
      return `${req.ip}_2fa`;
    },
  });
};

module.exports = {
  createRateLimiter,
  createLoginLimiter,
  createRegistrationLimiter,
  createApiLimiter,
  createTwoFactorLimiter,
};