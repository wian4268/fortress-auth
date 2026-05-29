import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';

const TwoFactorSetup = () => {
  const { setupTwoFactor, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    
    try {
      const data = await setupTwoFactor();
      setQrCode(data.qrCode);
      setBackupCodes(data.backupCodes);
      setStep(2);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await verifyTwoFactor(verificationCode);
      setStep(3);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px',
    },
    card: {
      background: 'white',
      borderRadius: '10px',
      padding: '40px',
      width: '100%',
      maxWidth: '500px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    },
    title: {
      textAlign: 'center',
      color: '#333',
      marginBottom: '30px',
      fontSize: '24px',
      fontWeight: 'bold',
    },
    button: {
      width: '100%',
      padding: '12px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '5px',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      marginTop: '20px',
    },
    error: {
      background: '#fee',
      color: '#c33',
      padding: '10px',
      borderRadius: '5px',
      marginBottom: '20px',
      fontSize: '14px',
    },
    input: {
      width: '100%',
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '5px',
      fontSize: '16px',
      boxSizing: 'border-box',
      textAlign: 'center',
      letterSpacing: '5px',
    },
    qrContainer: {
      textAlign: 'center',
      marginBottom: '20px',
    },
    qrImage: {
      maxWidth: '200px',
      height: 'auto',
    },
    backupCodes: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '10px',
      marginTop: '20px',
    },
    backupCode: {
      background: '#f7f8fc',
      padding: '10px',
      borderRadius: '5px',
      textAlign: 'center',
      fontFamily: 'monospace',
      fontSize: '14px',
    },
    success: {
      textAlign: 'center',
      color: '#28a745',
      fontSize: '48px',
      marginBottom: '20px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Two-Factor Authentication Setup</h2>
        
        {error && <div style={styles.error}>{error}</div>}
        
        {step === 1 && (
          <div>
            <p style={{ color: '#555', marginBottom: '20px', textAlign: 'center' }}>
              Add an extra layer of security to your account by enabling 
              two-factor authentication.
            </p>
            <button
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
              }}
              onClick={handleSetup}
              disabled={loading}
            >
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          </div>
        )}
        
        {step === 2 && (
          <div>
            <div style={styles.qrContainer}>
              <h3 style={{ color: '#333', marginBottom: '15px' }}>Scan QR Code</h3>
              <img src={qrCode} alt="QR Code" style={styles.qrImage} />
              <p style={{ color: '#777', fontSize: '14px', marginTop: '10px' }}>
                Scan this QR code with Google Authenticator or any TOTP app
              </p>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', color: '#555' }}>
                Enter the 6-digit code from your app
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={styles.input}
                placeholder="000000"
                maxLength={6}
              />
            </div>
            
            <button
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
              }}
              onClick={handleVerify}
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify and Enable'}
            </button>
          </div>
        )}
        
        {step === 3 && (
          <div>
            <div style={styles.success}>✓</div>
            <h3 style={{ textAlign: 'center', color: '#333', marginBottom: '10px' }}>
              2FA Enabled Successfully!
            </h3>
            <p style={{ textAlign: 'center', color: '#777', marginBottom: '20px' }}>
              Save these backup codes in a safe place. You can use them if you lose access to your authenticator app.
            </p>
            
            <div style={styles.backupCodes}>
              {backupCodes.map((code, index) => (
                <div key={index} style={styles.backupCode}>
                  {code}
                </div>
              ))}
            </div>
            
            <button
              style={styles.button}
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoFactorSetup;