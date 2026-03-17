import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "./Toast";
import { API_BASE } from "./config/api";

export function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    const logout = async () => {
      try {
        const token = localStorage.getItem('authToken');
        
        if (token) {
          // Call logout endpoint (optional - for server-side session cleanup)
          try {
            await fetch(`${API_BASE}/auth/logout`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
          } catch (error) {
            console.log('Server logout failed, but continuing with client logout');
          }
        }

        // Clear local storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        
        showToast('You have been logged out successfully', 'success');
        
        // Redirect to login page
        navigate('/login');
      } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout completed', 'success');
        navigate('/login');
      }
    };

    logout();
  }, [navigate]);

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
      <p>Logging out...</p>
    </div>
  );
}