import React, { useEffect } from 'react';
import '../css/action-modals.css';

/**
 * Base modal shell — overlay + card with header, body slot, and action buttons.
 * Props:
 *   isOpen, onClose, title, children,
 *   actions: [{ label, onClick, variant: 'primary'|'danger'|'ghost', disabled, loading }]
 */
export default function ActionModal({ isOpen, onClose, title, children, actions = [] }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="action-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="action-modal-card">
        <div className="action-modal-header">
          <div className="action-modal-title">{title}</div>
          <button className="action-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="action-modal-body">
          {children}
        </div>
        {actions.length > 0 && (
          <div className="action-modal-footer">
            {actions.map((a, i) => (
              <button
                key={i}
                className={`am-btn am-btn-${a.variant || 'primary'}`}
                onClick={a.onClick}
                disabled={a.disabled || a.loading}
              >
                {a.loading ? <><span className="btn-spinner btn-spinner--sm" /> {a.label}</> : a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
