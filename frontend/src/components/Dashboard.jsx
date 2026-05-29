import React, { useState } from 'react';
import { useAuth } from './AuthProvider';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSetup2FA = () => {
    navigate('/setup-2fa');
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
      maxWidth: '600px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '30px',
    },
    title: {
      color: '#333',
      fontSize: '28px',
      fontWeight: 'bold',
      margin: 0,
    },
    welcome: {
      color: '#667eea',
      fontSize: '20px',
      marginBottom: '20px',
    },
    info: {
      background: '#f7f8fc',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
    },
    infoItem: {
      marginBottom: '10px',
      color: '#555',
    },
    label: {
      fontWeight: 'bold',
      color: '#333',
    },
    button: {
      padding: '12px 24px',
      border: 'none',
      borderRadius: '5px',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      marginRight: '10px',
    },
    primaryButton: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
    },
    dangerButton: {
      background: '#e74c3c',
      color: 'white',
    },
    message: {
      background: '#d4edda',
      color: '#155724',
      padding: '10px',
      borderRadius: '5px',
      marginBottom: '20px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.title}>Dashboard</h2>
          <button
            style={{ ...styles.button, ...styles.dangerButton }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>

        {message && <div style={styles.message}>{message}</div>}

        <div style={styles.welcome}>
          Welcome, {user?.username}!
        </div>

        <div style={styles.info}>
          <div style={styles.infoItem}>
            <span style={styles.label}>Email:</span> {user?.email}
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>User ID:</span> {user?.id}
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>2FA Status:</span>{' '}
            {user?.twoFactorEnabled ? (
              <span style={{ color: 'green' }}>Enabled ✓</span>
            ) : (
              <span style={{ color: 'orange' }}>Not Enabled ✗</span>
            )}
          </div>
          <div style={styles.infoItem}>
            <span style={styles.label}>Last Login:</span>{' '}
            {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'First login'}
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          {!user?.twoFactorEnabled && (
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={handleSetup2FA}
            >
              Enable Two-Factor Authentication
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;