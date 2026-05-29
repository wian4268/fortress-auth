const { pool } = require('../config/database');
const crypto = require('crypto');

class SessionManager {
  static async createSession({ userId, refreshToken, ipAddress, userAgent }) {
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    
    await pool.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [userId, refreshTokenHash, ipAddress, userAgent]
    );
  }
  
  static async verifyRefreshToken(refreshToken) {
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    
    const result = await pool.query(
      `SELECT user_id FROM sessions 
       WHERE refresh_token_hash = $1 AND revoked = false AND expires_at > NOW()`,
      [refreshTokenHash]
    );
    
    return result.rows[0] || null;
  }
  
  static async revokeSession(refreshToken) {
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    
    await pool.query(
      'UPDATE sessions SET revoked = true WHERE refresh_token_hash = $1',
      [refreshTokenHash]
    );
  }
  
  static async getActiveSessions(userId) {
    const result = await pool.query(
      `SELECT id, ip_address, user_agent, created_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND revoked = false AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }
}

module.exports = SessionManager;