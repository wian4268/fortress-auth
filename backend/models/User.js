const { pool } = require('../config/database');
const argon2 = require('argon2');

class User {
  static async create({ email, username, password }) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Hash password with Argon2id
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      
      // Insert user
      const result = await client.query(
        `INSERT INTO users (email, username, password_hash) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, username, created_at`,
        [email.toLowerCase().trim(), username.trim(), passwordHash]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') {
        throw new Error('Email or username already exists');
      }
      throw error;
    } finally {
      client.release();
    }
  }
  
  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }
  
  static async findById(id) {
    const result = await pool.query(
      'SELECT id, email, username, two_factor_enabled, last_login, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
  
  static async verifyPassword(user, password) {
    try {
      return await argon2.verify(user.password_hash, password);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }
  
  static async recordLoginAttempt(userId, ipAddress, userAgent, success, failureReason = null) {
    try {
      await pool.query(
        `INSERT INTO login_history (user_id, ip_address, user_agent, success, failure_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, ipAddress, userAgent, success, failureReason]
      );
      
      if (success) {
        await pool.query(
          'UPDATE users SET failed_login_attempts = 0, last_login = NOW() WHERE id = $1',
          [userId]
        );
      } else {
        await pool.query(
          `UPDATE users 
           SET failed_login_attempts = failed_login_attempts + 1,
               account_locked_until = CASE 
                 WHEN failed_login_attempts + 1 >= 5 
                 THEN NOW() + INTERVAL '15 minutes'
                 ELSE account_locked_until 
               END
           WHERE id = $1`,
          [userId]
        );
      }
    } catch (error) {
      console.error('Failed to record login attempt:', error);
    }
  }
  
  static async isAccountLocked(user) {
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      return true;
    }
    return false;
  }
  
  static async updatePassword(userId, newPassword) {
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    
    // Invalidate all existing sessions
    await pool.query(
      'UPDATE sessions SET revoked = true WHERE user_id = $1 AND revoked = false',
      [userId]
    );
    
    return await pool.query(
      'UPDATE users SET password_hash = $1, last_password_change = NOW() WHERE id = $2',
      [passwordHash, userId]
    );
  }
}

module.exports = User;