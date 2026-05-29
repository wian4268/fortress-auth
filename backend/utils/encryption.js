const crypto = require('crypto');
const argon2 = require('argon2');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 64;
    this.iterations = 100000;
    this.digest = 'sha512';
  }

  /**
   * Get or generate encryption key
   */
  getEncryptionKey() {
    const envKey = process.env.ENCRYPTION_KEY;
    
    if (!envKey) {
      console.warn('⚠️  ENCRYPTION_KEY not set. Using generated key (not persistent!)');
      // Generate a temporary key (will change on server restart)
      return crypto.randomBytes(this.keyLength);
    }
    
    // Derive a proper key from the environment variable
    return crypto.scryptSync(envKey, 'fortress-auth-salt', this.keyLength);
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(text) {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return JSON.stringify({
        encrypted: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        algorithm: this.algorithm,
        version: 1
      });
    } catch (error) {
      console.error('Encryption failed:', error.message);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData) {
    try {
      const data = JSON.parse(encryptedData);
      const key = this.getEncryptionKey();
      
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        key,
        Buffer.from(data.iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
      
      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate a secure hash using Argon2id
   */
  async hashPassword(password) {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,       // 3 iterations
        parallelism: 4,    // 4 threads
        hashLength: 32,    // 32 bytes output
      });
    } catch (error) {
      console.error('Password hashing failed:', error.message);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(hash, password) {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      console.error('Password verification failed:', error.message);
      return false;
    }
  }

  /**
   * Generate a random token
   */
  generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a random code (for 2FA backup codes)
   */
  generateRandomCode(length = 8) {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length)
      .toUpperCase();
  }

  /**
   * Hash data with salt using PBKDF2
   */
  hashWithSalt(data, salt) {
    if (!salt) {
      salt = crypto.randomBytes(this.saltLength).toString('hex');
    }
    
    const hash = crypto.pbkdf2Sync(
      data,
      salt,
      this.iterations,
      64,
      this.digest
    ).toString('hex');
    
    return { hash, salt };
  }

  /**
   * Timing-safe string comparison
   */
  timingSafeEqual(a, b) {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a, 'utf8'),
        Buffer.from(b, 'utf8')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a UUID v4
   */
  generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Create a secure JWT secret
   */
  generateJWTSecret(length = 64) {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * Encrypt sensitive data for storage
   */
  encryptSensitiveData(data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }
    return this.encrypt(data);
  }

  /**
   * Decrypt sensitive data from storage
   */
  decryptSensitiveData(encryptedData) {
    const decrypted = this.decrypt(encryptedData);
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  }

  /**
   * Generate a secure session ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Create HMAC signature
   */
  createHMAC(data, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifyHMAC(data, secret, signature) {
    const expectedSignature = this.createHMAC(data, secret);
    return this.timingSafeEqual(expectedSignature, signature);
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

module.exports = encryptionService;