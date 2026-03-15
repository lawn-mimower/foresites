import React, { useState } from 'react';
import ActionModal from './ActionModal';
import { useAuth } from '../AuthContext';
import { showToast } from '../Toast';

const API = 'http://localhost:9999/api';

export default function EscalateModal({ isOpen, onClose, assignmentId, onEscalated }) {
  const { apiCall } = useAuth();
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!remarks.trim()) { showToast('Please provide escalation remarks', 'warning'); return; }
    setSubmitting(true);
    try {
      const res = await apiCall(`${API}/snag-assignments/escalate`, {
        method: 'POST',
        body: JSON.stringify({ assignment_id: assignmentId, escalation_remarks: remarks }),
      });
      if (res && !res.error) {
        showToast('Snag escalated — reminder sent', 'success');
        onEscalated?.();
        handleClose();
      } else {
        showToast(res?.error || 'Failed to escalate', 'error');
      }
    } catch { showToast('Error escalating snag', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleClose = () => {
    setRemarks('');
    onClose();
  };

  return (
    <ActionModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Escalate Snag"
      actions={[
        { label: 'Cancel', onClick: handleClose, variant: 'ghost' },
        { label: 'Escalate & Remind', onClick: handleSubmit, variant: 'primary', disabled: !remarks.trim(), loading: submitting },
      ]}
    >
      <div className="action-modal-field">
        <label>Escalation Remarks (required)</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Why is this being escalated? Include urgency and any blockers..."
        />
      </div>
    </ActionModal>
  );
}
