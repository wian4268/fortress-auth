const { body, validationResult } = require('express-validator');

// Registration validation rules
const validateRegistration = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email address is too long'),
  
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
    .custom(value => {
      const reservedWords = ['admin', 'root', 'system', 'moderator', 'support', 'help'];
      if (reservedWords.includes(value.toLowerCase())) {
        throw new Error('This username is reserved');
      }
      return true;
    })
    .escape(),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .custom(value => {
      // Check for common passwords
      const commonPasswords = [
        'password123', 'Password123', 'admin123', 'Admin123',
        '12345678', 'qwerty123', 'letmein123', 'welcome123',
        'Password1', 'Adminadmin1', 'Testtest1'
      ];
      
      if (commonPasswords.includes(value)) {
        throw new Error('This password is too common. Please choose a stronger password');
      }
      
      // Check for sequential characters
      const sequential = 'abcdefghijklmnopqrstuvwxyz0123456789';
      for (let i = 0; i < value.length - 2; i++) {
        const substr = value.substring(i, i + 3).toLowerCase();
        if (sequential.includes(substr) || 
            sequential.split('').reverse().join('').includes(substr)) {
          throw new Error('Password contains sequential characters');
        }
      }
      
      // Check for repeated characters
      if (/(.)\1{2,}/.test(value)) {
        throw new Error('Password contains repeated characters');
      }
      
      // Check for keyboard patterns
      const keyboardPatterns = ['qwerty', 'asdfgh', 'zxcvbn', 'qazwsx'];
      if (keyboardPatterns.some(pattern => value.toLowerCase().includes(pattern))) {
        throw new Error('Password contains keyboard patterns');
      }
      
      return true;
    }),
];

// Login validation rules
const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password is too long'),
  
  body('twoFactorToken')
    .optional()
    .trim()
    .isLength({ min: 6, max: 8 })
    .withMessage('Invalid 2FA code format')
    .matches(/^[0-9a-zA-Z]+$/)
    .withMessage('2FA code can only contain numbers and letters'),
];

// Password change validation
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('New password must contain at least one number')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
];

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Log validation errors for security monitoring
    console.warn('Validation errors:', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value ? '[REDACTED]' : undefined
      }))
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  
  next();
};

// SQL Injection prevention sanitizer
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove SQL injection patterns
  const sanitized = input
    .replace(/'/g, "''")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "")
    .replace(/xp_/gi, "")
    .replace(/sp_/gi, "")
    .replace(/exec\s*\(/gi, "")
    .replace(/execute\s*\(/gi, "")
    .replace(/union\s+select/gi, "")
    .replace(/select\s+\*/gi, "")
    .replace(/drop\s+table/gi, "")
    .replace(/alter\s+table/gi, "")
    .replace(/create\s+table/gi, "")
    .replace(/insert\s+into/gi, "")
    .replace(/update\s+\w+\s+set/gi, "")
    .replace(/delete\s+from/gi, "");
  
  return sanitized.trim();
};

// XSS prevention sanitizer for output
const sanitizeOutput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;');
};

// HTML sanitizer middleware
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  next();
};

// Rate limit helper
const getRateLimitKey = (req) => {
  return `${req.ip}_${(req.user?.id || 'anonymous')}_${req.path}`;
};

// Security headers helper
const securityHeaders = (req, res, next) => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validatePasswordChange,
  handleValidationErrors,
  sanitizeInput,
  sanitizeOutput,
  sanitizeBody,
  getRateLimitKey,
  securityHeaders,
};