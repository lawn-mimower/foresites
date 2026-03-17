import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE, BASE_URL } from './config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Check for existing authentication on app load
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('userData');

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
        
        // Verify token is still valid
        verifyToken(storedToken);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        clearAuth();
      }
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify) => {
    try {
      const response = await fetch(`${API_BASE}/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update user data with fresh data from server
        const updatedUser = {
          ...JSON.parse(localStorage.getItem('userData')),
          ...data.user
        };
        setUser(updatedUser);
        setToken(tokenToVerify);
        localStorage.setItem('userData', JSON.stringify(updatedUser));
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Login response:', data);
        console.log('📌 User data received:', data.user);
        console.log('📌 Site ID:', data.user.site_id);
        
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  // Helper function to make authenticated API calls
  const apiCall = async (url, options = {}) => {
    const token = localStorage.getItem('authToken');
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method: 'GET', // default method
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

    try {
      const response = await fetch(fullUrl, config);
      
      // If token is invalid or expired, clear auth and redirect to login
      if (response.status === 401 || response.status === 403) {
        clearAuth();
        window.location.href = '/login';
        return { error: 'Authentication required' };
      }

      // Parse and return JSON for all successful responses
      if (response.ok) {
        return await response.json();
      }

      // For error responses, try to parse error message
      try {
        const errorData = await response.json();
        return { error: errorData.error || `HTTP ${response.status}` };
      } catch {
        return { error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.log('Server logout failed, but continuing with client logout');
    } finally {
      clearAuth();
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('userData', JSON.stringify(updatedUser));
  };

  const isAuthenticated = () => {
    return !!user && !!token;
  };

  const isAdmin = () => {
    // Super admin level (Super admin, Sr. engineer, or old admin/super_admin)
    return user && (user.role === 'Super admin' || user.role === 'Sr. engineer' || user.role === 'admin' || user.role === 'super_admin');
  };

  const isSuperAdmin = () => {
    // Only Super admin role (new or old format)
    return user && (user.role === 'Super admin' || user.role === 'super_admin');
  };

  const isSuperAdminOrSrEngineer = () => {
    // Superadmin (new or old format) or Sr. Engineer (for critical operations like Access Points management)
    return user && (user.role === 'Super admin' || user.role === 'super_admin' || user.role === 'Sr. engineer');
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isSuperAdminOrSrEngineer,
    verifyToken,
    apiCall
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
