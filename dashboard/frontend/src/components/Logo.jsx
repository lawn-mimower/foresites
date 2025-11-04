import React from 'react';
import './Logo.css';

export function Logo({ size = 'medium', showText = true, className = '' }) {
  const sizeClasses = {
    small: 'logo-small',
    medium: 'logo-medium', 
    large: 'logo-large'
  };

  return (
    <div className={`logo-container ${sizeClasses[size]} ${className}`}>
      <div className="logo-image">
        <img 
          src="/logo.png" 
          alt="OMNIFEED Logo" 
          className="logo-img"
          onError={(e) => {
            // Fallback to a placeholder if logo doesn't exist
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="logo-placeholder" style={{ display: 'none' }}>
          <span className="logo-text">OMNI</span>
        </div>
      </div>
      {showText && (
        <div className="logo-text-container">
          <span className="logo-brand">Foresites - MD Consultants</span>
          
        </div>
      )}
    </div>
  );
}
