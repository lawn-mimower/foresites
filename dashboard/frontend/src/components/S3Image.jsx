import React, { useState, useEffect } from 'react';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

/**
 * S3Image — single component for all S3-hosted image rendering.
 *
 * Handles: S3 keys, full S3 URLs, pre-signed URLs, and plain http URLs.
 * Shows a placeholder while resolving, an error state on failure.
 * Never uses display:none — always shows *something*.
 *
 * Props:
 *   src        — S3 key ("images/abc.jpg") or full URL
 *   apiCall    — from useAuth()
 *   apiBase    — API base URL
 *   alt        — alt text (default: "Image")
 *   className  — wrapper class (default: "snag-image-thumb")
 *   onClick    — called with resolved URL when image is clicked
 *   label      — optional label above the image (e.g., "Proof Submitted")
 */
export default function S3Image({ src, apiCall, apiBase, alt = 'Image', className = 'snag-image-thumb', onClick, label }) {
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    if (!src) { setStatus('error'); return; }

    // Non-S3 http URL — use directly
    if ((src.startsWith('http://') || src.startsWith('https://')) &&
        !src.includes('.s3.') && !src.includes('amazonaws.com')) {
      setResolvedUrl(src);
      setStatus('ready');
      return;
    }

    // S3 key or S3 URL — needs resolution via backend for signed URL
    if (!apiCall || !apiBase) { setStatus('error'); return; }

    setStatus('loading');
    resolveMediaUrl(src, apiCall, apiBase)
      .then(url => {
        if (url) {
          setResolvedUrl(url);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [src, apiCall, apiBase]);

  const handleClick = () => {
    if (onClick && resolvedUrl) onClick(resolvedUrl);
  };

  return (
    <>
      {label && <div className="detail-label" style={{ marginBottom: '4px' }}>{label}</div>}
      <div className={className} onClick={handleClick} style={onClick ? { cursor: 'pointer' } : undefined}>
        {status === 'ready' && (
          <>
            <img
              src={resolvedUrl}
              alt={alt}
              onError={() => setStatus('error')}
            />
            {onClick && <span className="image-expand-hint">View full</span>}
          </>
        )}

        {status === 'loading' && (
          <div className="snag-image-placeholder">
            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, fill: 'currentColor', opacity: 0.4 }}>
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
            <span>Loading...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="snag-image-placeholder">
            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, fill: 'currentColor', opacity: 0.4 }}>
              <path d="M21 5v6.59l-3-3.01-4 4.01-4-4-4 4-3-3.01V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2zm-3 6.42l3 3.01V19c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2v-6.58l3 2.99 4-4 4 4 4-3.99z"/>
            </svg>
            <span>Image unavailable</span>
          </div>
        )}
      </div>
    </>
  );
}
