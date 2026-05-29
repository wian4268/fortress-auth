const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const TwoFactorService = require('./TwoFactorService');
const SessionManager = require('./SessionManager');

class AuthService {
  static async register({ email, username, password }) {
    // Validate input
    this.validateRegistration({ email, username, password });
    
    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }
    
    // Create user
    const user = await User.create({ email, username, password });
    return { id: user.id, email: user.email, username: user.username };
  }
  
  static async login({ email, password, twoFactorToken, ip_address, user_agent }) {
    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    // Check if account is locked
    if (await User.isAccountLocked(user)) {
      throw new Error('Account is temporarily locked. Please try again later.');
    }
    
    // Verify password
    const isValidPassword = await User.verifyPassword(user, password);
    if (!isValidPassword) {
      await User.recordLoginAttempt(user.id, ip_address, user_agent, false, 'Invalid password');
      throw new Error('Invalid credentials');
    }
    
    // Check 2FA if enabled
    if (user.two_factor_enabled) {
      if (!twoFactorToken) {
        return { requiresTwoFactor: true };
      }
      
      let isValidTwoFactor = TwoFactorService.verifyToken(twoFactorToken, user.two_factor_secret);
      
      if (!isValidTwoFactor && user.two_factor_backup_codes) {
        isValidTwoFactor = await TwoFactorService.verifyBackupCode(
          user.two_factor_backup_codes,
          twoFactorToken
        );
      }
      
      if (!isValidTwoFactor) {
        await User.recordLoginAttempt(user.id, ip_address, user_agent, false, 'Invalid 2FA');
        throw new Error('Invalid two-factor code');
      }
    }
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    // Create session
    await SessionManager.createSession({
      userId: user.id,
      refreshToken,
      ipAddress: ip_address,
      userAgent: user_agent
    });
    
    // Record successful login
    await User.recordLoginAttempt(user.id, ip_address, user_agent, true);
    
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        twoFactorEnabled: user.two_factor_enabled
      }
    };
  }
  
  static generateAccessToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }
  
  static validateRegistration({ email, username, password }) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Invalid email format');
    }
    
    if (!username || username.length < 3 || username.length > 30) {
      throw new Error('Username must be between 3 and 30 characters');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }
    
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('Password must contain uppercase, lowercase, and numbers');
    }
  }
}

module.exports = AuthService;