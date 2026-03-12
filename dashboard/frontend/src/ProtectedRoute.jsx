import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children, requireAuth = true, requireAdmin = false, requireSuperAdmin = false }) {
  const { isAuthenticated, isAdmin, isSuperAdmin, loading } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin()) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <h2>Access Denied</h2>
        <p>You need admin privileges to access this page.</p>
        <button 
          onClick={() => window.history.back()}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--primary-500)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  // Check super admin requirement
  if (requireSuperAdmin && !isSuperAdmin()) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <h2>Access Denied</h2>
        <p>You need super admin privileges to access this page.</p>
        <button 
          onClick={() => window.history.back()}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--primary-500)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return children;
}
