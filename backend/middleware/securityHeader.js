const helmet = require('helmet');

/**
 * Apply comprehensive security headers
 */
const applySecurityHeaders = (app) => {
  // Basic security headers with Helmet
  app.use(helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https:", "data:"],
        connectSrc: ["'self'", "http://localhost:3000", "http://localhost:5000"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        manifestSrc: ["'self'"],
      },
    },
    
    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false,
    },
    
    // Frameguard - Prevent clickjacking
    frameguard: {
      action: 'deny',
    },
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
    
    // HSTS - HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    
    // IE No Open
    ieNoOpen: true,
    
    // NoSniff - Prevent MIME type sniffing
    noSniff: true,
    
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    
    // XSS Filter
    xssFilter: true,
  }));

  // Additional custom security headers
  app.use((req, res, next) => {
    // Prevent browsers from incorrectly detecting non-scripts as scripts
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable browser XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Disable MIME type sniffing
    res.setHeader('X-Download-Options', 'noopen');
    
    // Control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader('Permissions-Policy', [
      'accelerometer=()',
      'autoplay=()',
      'camera=()',
      'document-domain=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=()',
      'sync-xhr=(self)',
      'usb=()',
      'xr-spatial-tracking=()',
    ].join(', '));
    
    // Cache Control
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Remove sensitive headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    res.removeHeader('X-Runtime');
    res.removeHeader('X-Version');
    
    next();
  });
};

/**
 * Security middleware for API routes
 */
const apiSecurityHeaders = (req, res, next) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
};

/**
 * Rate limit headers helper
 */
const addRateLimitHeaders = (req, res, next) => {
  // If rate limit headers are set by express-rate-limit, preserve them
  // Otherwise, they'll be set by the rate limiter middleware
  next();
};

module.exports = {
  applySecurityHeaders,
  apiSecurityHeaders,
  addRateLimitHeaders,
};