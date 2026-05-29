const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { pool } = require('../config/database');

class TwoFactorService {
  static generateSecret(username) {
    const secret = speakeasy.generateSecret({
      name: `FortressAuth:${username}`,
      length: 20
    });
    
    return {
      base32: secret.base32,
      otpauth_url: secret.otpauth_url
    };
  }
  
  static async generateQRCode(otpauthUrl) {
    try {
      return await QRCode.toDataURL(otpauthUrl);
    } catch (error) {
      console.error('QR Code generation failed:', error);
      throw error;
    }
  }
  
  static generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }
  
  static async hashBackupCodes(codes) {
    const hashedCodes = [];
    for (const code of codes) {
      const hash = await bcrypt.hash(code, 10);
      hashedCodes.push(hash);
    }
    return hashedCodes;
  }
  
  static verifyToken(token, secret) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1
    });
  }
  
  static async verifyBackupCode(hashedCodes, code) {
    for (const hashedCode of hashedCodes) {
      if (await bcrypt.compare(code, hashedCode)) {
        return true;
      }
    }
    return false;
  }
  
  static async setupTwoFactor(userId, secret, backupCodes) {
    const hashedBackupCodes = await this.hashBackupCodes(backupCodes);
    
    await pool.query(
      `UPDATE users 
       SET two_factor_secret = $1, 
           two_factor_enabled = true, 
           two_factor_backup_codes = $2 
       WHERE id = $3`,
      [secret, hashedBackupCodes, userId]
    );
  }
  
  static async disableTwoFactor(userId) {
    await pool.query(
      `UPDATE users 
       SET two_factor_secret = NULL, 
           two_factor_enabled = false, 
           two_factor_backup_codes = NULL 
       WHERE id = $1`,
      [userId]
    );
  }
}

module.exports = TwoFactorService;