import React, { useState, useEffect } from 'react';

export default function ProofImage({ proofKey, apiCall, apiBase }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!proofKey) return;
    if (proofKey.startsWith('http')) { setUrl(proofKey); return; }
    apiCall(`${apiBase}/dashboard/media-url?path=${encodeURIComponent(proofKey)}`)
      .then(data => { if (data?.url) setUrl(data.url); })
      .catch(() => {});
  }, [proofKey, apiCall, apiBase]);

  if (!url) return null;

  return (
    <div style={{ marginTop: '8px' }}>
      <div className="detail-label" style={{ marginBottom: '4px' }}>Proof Submitted</div>
      <div className="snag-image-thumb" onClick={() => window.open(url, "_blank")}>
        <img src={url} alt="Proof" onError={(e) => { e.target.style.display = 'none'; }} />
        <span className="image-expand-hint">View proof</span>
      </div>
    </div>
  );
}
