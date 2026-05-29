const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');
const TwoFactorService = require('../services/TwoFactorService');
const SessionManager = require('../services/SessionManager');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const user = await AuthService.register({ email, username, password });
    
    res.status(201).json({
      message: 'Registration successful',
      user
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    
    const result = await AuthService.login({
      email,
      password,
      twoFactorToken,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    if (result.requiresTwoFactor) {
      return res.json({ requiresTwoFactor: true });
    }
    
    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json({
      message: 'Login successful',
      accessToken: result.accessToken,
      user: result.user
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Refresh access token
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }
    
    const session = await SessionManager.verifyRefreshToken(refreshToken);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const user = await User.findById(session.user_id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const accessToken = AuthService.generateAccessToken(user);
    
    res.json({ accessToken });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (refreshToken) {
      await SessionManager.revokeSession(refreshToken);
    }
    
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Setup 2FA
router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }
    
    const secret = TwoFactorService.generateSecret(user.username);
    const qrCode = await TwoFactorService.generateQRCode(secret.otpauth_url);
    const backupCodes = TwoFactorService.generateBackupCodes();
    
    // Store temporarily in session
    req.session.tempTwoFactorSecret = secret.base32;
    req.session.tempBackupCodes = backupCodes;
    
    res.json({
      qrCode,
      backupCodes,
      secret: secret.base32
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Verify and enable 2FA
router.post('/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body;
    const secret = req.session.tempTwoFactorSecret;
    const backupCodes = req.session.tempBackupCodes;
    
    if (!secret || !backupCodes) {
      return res.status(400).json({ error: '2FA setup not initiated' });
    }
    
    const isValid = TwoFactorService.verifyToken(token, secret);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    await TwoFactorService.setupTwoFactor(req.user.id, secret, backupCodes);
    
    // Clear temporary session data
    delete req.session.tempTwoFactorSecret;
    delete req.session.tempBackupCodes;
    
    res.json({
      message: '2FA enabled successfully',
      backupCodes: backupCodes
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// Disable 2FA
router.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    
    // Verify password before disabling
    const user = await User.findByEmail(req.user.email);
    const isValidPassword = await User.verifyPassword(user, password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    await TwoFactorService.disableTwoFactor(req.user.id);
    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Verify current password
    const user = await User.findByEmail(req.user.email);
    const isValid = await User.verifyPassword(user, currentPassword);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    
    await User.updatePassword(req.user.id, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get active sessions
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await SessionManager.getActiveSessions(req.user.id);
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

module.exports = router;