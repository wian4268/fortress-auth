import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const { data } = await api.post('/auth/refresh-token');
        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }
      
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      localStorage.removeItem('accessToken');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);
  
  const login = async ({ email, password, twoFactorToken }) => {
    setError(null);
    
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password,
        twoFactorToken,
      });
      
      if (data.requiresTwoFactor) {
        return { requiresTwoFactor: true };
      }
      
      localStorage.setItem('accessToken', data.accessToken);
      setUser(data.user);
      
      return data;
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };
  
  const register = async ({ email, username, password }) => {
    setError(null);
    
    try {
      const { data } = await api.post('/auth/register', {
        email,
        username,
        password,
      });
      
      return data;
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };
  
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
    }
  };
  
  const setupTwoFactor = async () => {
    try {
      const { data } = await api.post('/auth/2fa/setup');
      return data;
    } catch (error) {
      const message = error.response?.data?.error || '2FA setup failed';
      throw new Error(message);
    }
  };
  
  const verifyTwoFactor = async (token) => {
    try {
      const { data } = await api.post('/auth/2fa/verify', { token });
      return data;
    } catch (error) {
      const message = error.response?.data?.error || '2FA verification failed';
      throw new Error(message);
    }
  };
  
  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    setupTwoFactor,
    verifyTwoFactor,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { api };