import React, { useState } from 'react';

export function CollapsibleSection({ title, icon, badge, badgeClass, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card-section">
      <button className={`section-toggle${open ? ' open' : ''}`} onClick={() => setOpen(!open)}>
        <span className="section-toggle-label">
          {icon && <span dangerouslySetInnerHTML={{ __html: icon }} />}
          {title}
        </span>
        <div className="section-toggle-meta">
          {badge && (
            <span className={`section-badge${badgeClass ? ' ' + badgeClass : ''}`}>{badge}</span>
          )}
          <svg className="chevron" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
        </div>
      </button>
      <div className={`section-content${open ? ' open' : ''}`}>
        {children}
      </div>
    </div>
  );
}
