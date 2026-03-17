import React from 'react';
import { CollapsibleSection } from '../CollapsibleSection';

const ICON_DETAIL = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z"/></svg>';

export default function SnagDetailSection({ snag, onImageClick, defaultOpen = false }) {
  const hasImage = !!snag.image_url;
  const reportedDate = new Date(snag.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <CollapsibleSection
      title="Snag Detail"
      icon={ICON_DETAIL}
      badge={`Reported ${reportedDate}`}
      badgeClass="has-content"
      defaultOpen={defaultOpen}
    >
      {hasImage ? (
        <div className="snag-image-thumb" onClick={() => onImageClick?.(snag.image_url)}>
          <img src={snag.image_url} alt="Snag" />
          <span className="image-expand-hint">View full</span>
        </div>
      ) : (
        <div className="snag-image-thumb">
          <div className="snag-image-placeholder">
            <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
            <span>No photo attached</span>
          </div>
        </div>
      )}

      <div className="snag-detail-grid">
        <div>
          <div className="detail-label">Site</div>
          <div className="detail-value">{snag.site?.site_name || '—'}</div>
        </div>
        <div>
          <div className="detail-label">Reporter</div>
          <div className="detail-value">{snag.reporter_name || '—'}</div>
        </div>
        <div>
          <div className="detail-label">Date Reported</div>
          <div className="detail-value mono">{new Date(snag.created_at).toLocaleDateString('en-GB')}</div>
        </div>
        <div>
          <div className="detail-label">Type</div>
          <div className="detail-value">{snag.feedback_type || 'text'}</div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
