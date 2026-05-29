const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 * Uses Double Submit Cookie Pattern with token rotation
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for safe methods
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  
  if (safeMethods.includes(req.method)) {
    // Generate new CSRF token if not exists
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    
    // Set CSRF token in response header for client to use
    res.setHeader('X-CSRF-Token', req.session.csrfToken);
    
    // Also set as cookie for double submit pattern
    res.cookie('XSRF-TOKEN', req.session.csrfToken, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
    
    return next();
  }
  
  // Validate CSRF token for state-changing methods
  const tokenFromHeader = req.headers['x-csrf-token'];
  const tokenFromCookie = req.cookies?.['XSRF-TOKEN'];
  const tokenFromBody = req.body?._csrf;
  
  const providedToken = tokenFromHeader || tokenFromBody;
  
  // Check if token is provided
  if (!providedToken) {
    console.warn('CSRF token missing:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    
    return res.status(403).json({
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING',
    });
  }
  
  // Verify token matches session token
  if (providedToken !== req.session.csrfToken) {
    console.warn('CSRF token mismatch:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      expected: req.session.csrfToken?.substring(0, 8) + '...',
      received: providedToken.substring(0, 8) + '...',
    });
    
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID',
    });
  }
  
  // Verify double submit cookie if available
  if (tokenFromCookie && tokenFromCookie !== providedToken) {
    console.warn('CSRF double submit mismatch:', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    
    return res.status(403).json({
      error: 'CSRF validation failed',
      code: 'CSRF_VALIDATION_FAILED',
    });
  }
  
  // Token is valid, rotate for next request
  req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  
  // Set new token in response
  res.setHeader('X-CSRF-Token', req.session.csrfToken);
  res.cookie('XSRF-TOKEN', req.session.csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  
  next();
};

/**
 * Generate CSRF token middleware
 */
const generateCsrfToken = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

/**
 * Exempt paths from CSRF protection
 */
const csrfExemptPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh-token',
  '/api/webhook',
];

const conditionalCsrfProtection = (req, res, next) => {
  // Skip CSRF for exempt paths
  if (csrfExemptPaths.includes(req.path)) {
    return next();
  }
  
  return csrfProtection(req, res, next);
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
  conditionalCsrfProtection,
};