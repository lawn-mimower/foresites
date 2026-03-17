import React, { useState, useEffect } from "react";
import { useAuth } from "../AuthContext";
import { showToast } from "../Toast";
import { API_BASE } from "../config/api";
import { setImpactMap } from "../utils/snagHelpers";

const IMPACT_LEVELS = ['low', 'medium', 'high', 'critical'];

const IMPACT_COLORS = {
  low: 'var(--ink-400)',
  medium: 'var(--blue)',
  high: 'var(--amber)',
  critical: 'var(--brand-red)',
};

function formatCategory(cat) {
  if (!cat) return '';
  return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ImpactMappingPanel() {
  const { apiCall } = useAuth();
  const [mappings, setMappings] = useState([]);
  const [remaining, setRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingChanges, setPendingChanges] = useState({});
  const [confirmModal, setConfirmModal] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mappingsData, remainingData] = await Promise.all([
        apiCall(`${API_BASE}/impact-mapping`),
        apiCall(`${API_BASE}/impact-mapping/remaining`),
      ]);
      if (Array.isArray(mappingsData)) setMappings(mappingsData);
      if (remainingData && !remainingData.error) setRemaining(remainingData.remaining);
    } catch (err) {
      showToast('Failed to load impact mappings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (category, newLevel) => {
    const current = mappings.find(m => m.category === category);
    if (current && current.impact_level === newLevel) {
      setPendingChanges(prev => { const n = { ...prev }; delete n[category]; return n; });
    } else {
      setPendingChanges(prev => ({ ...prev, [category]: newLevel }));
    }
  };

  const handleSaveClick = (category) => {
    const newLevel = pendingChanges[category];
    if (!newLevel) return;
    setConfirmModal({ category, newLevel });
  };

  const handleConfirm = async () => {
    if (!confirmModal) return;
    setSaving(true);
    try {
      const res = await apiCall(`${API_BASE}/impact-mapping`, {
        method: 'PUT',
        body: JSON.stringify({ category: confirmModal.category, impact_level: confirmModal.newLevel }),
      });
      if (res && res.success) {
        showToast(`Updated ${formatCategory(confirmModal.category)} to ${confirmModal.newLevel}`, 'success');
        setRemaining(res.remaining);
        setPendingChanges(prev => { const n = { ...prev }; delete n[confirmModal.category]; return n; });
        // Refresh mappings and update runtime map
        const data = await apiCall(`${API_BASE}/impact-mapping`);
        if (Array.isArray(data)) {
          setMappings(data);
          const map = {};
          data.forEach(r => { map[r.category] = r.impact_level; });
          setImpactMap(map);
        }
      } else {
        showToast(res?.error || 'Failed to update mapping', 'error');
      }
    } catch (err) {
      showToast('Error updating mapping', 'error');
    } finally {
      setSaving(false);
      setConfirmModal(null);
    }
  };

  if (loading) {
    return <div className="loading">Loading impact mappings...</div>;
  }

  return (
    <div className="impact-mapping-section">
      <div className="impact-mapping-header">
        <h2>Impact Mapping</h2>
        <div className="remaining-badge">
          {remaining !== null && (
            <span style={{
              padding: '4px 12px',
              background: remaining === 0 ? 'var(--brand-red)' : 'var(--ink-900)',
              color: 'white',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {remaining} change{remaining !== 1 ? 's' : ''} remaining today
            </span>
          )}
        </div>
      </div>

      <div className="table-container">
        <table className="impact-mapping-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Current Impact</th>
              <th>New Impact</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map(m => {
              const pending = pendingChanges[m.category];
              const hasChange = !!pending;
              return (
                <tr key={m.category}>
                  <td style={{ fontWeight: 600 }}>{formatCategory(m.category)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      border: `1px solid ${IMPACT_COLORS[m.impact_level]}`,
                      color: IMPACT_COLORS[m.impact_level],
                      background: `${IMPACT_COLORS[m.impact_level]}15`,
                    }}>
                      {m.impact_level}
                    </span>
                  </td>
                  <td>
                    <select
                      value={pending || m.impact_level}
                      onChange={(e) => handleSelectChange(m.category, e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '13px', border: '1px solid var(--ink-200)' }}
                    >
                      {IMPACT_LEVELS.map(lvl => (
                        <option key={lvl} value={lvl}>
                          {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      onClick={() => handleSaveClick(m.category)}
                      disabled={!hasChange || remaining === 0}
                      style={{
                        padding: '6px 14px',
                        border: 'none',
                        background: hasChange ? 'var(--brand-red)' : 'var(--ink-200)',
                        color: hasChange ? 'white' : 'var(--ink-400)',
                        fontWeight: 700,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        cursor: hasChange && remaining > 0 ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>Confirm Change</h2>
              <button className="close-btn" onClick={() => setConfirmModal(null)}>X</button>
            </div>
            <div style={{ padding: 'var(--space-5)' }}>
              <p style={{ fontSize: '14px', color: 'var(--ink-700)', margin: '0 0 16px 0' }}>
                Change <strong>{formatCategory(confirmModal.category)}</strong> impact
                from <strong>{mappings.find(m => m.category === confirmModal.category)?.impact_level}</strong> to <strong>{confirmModal.newLevel}</strong>?
              </p>
              <p style={{ fontSize: '13px', color: 'var(--ink-500)', margin: 0 }}>
                You have <strong>{remaining}</strong> change{remaining !== 1 ? 's' : ''} left today.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', padding: '0 var(--space-5) var(--space-5)' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{ padding: '8px 16px', border: 'none', background: 'var(--ink-200)', color: 'var(--ink-700)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                style={{ padding: '8px 16px', border: 'none', background: 'var(--brand-red)', color: 'white', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
