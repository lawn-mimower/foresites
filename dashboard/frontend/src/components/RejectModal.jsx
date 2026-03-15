import React, { useState } from 'react';
import ActionModal from './ActionModal';
import { useAuth } from '../AuthContext';
import { showToast } from '../Toast';

const API = 'http://localhost:9999/api';

export default function RejectModal({ isOpen, onClose, assignmentId, onRejected }) {
  const { apiCall } = useAuth();
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!remarks.trim()) { showToast('Please provide rejection remarks', 'warning'); return; }
    setSubmitting(true);
    try {
      const res = await apiCall(`${API}/snag-assignments/assignments/${assignmentId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'in_progress', rejection_remarks: remarks }),
      });
      if (res && !res.error) {
        await apiCall(`${API}/snag-assignments/notify`, {
          method: 'POST',
          body: JSON.stringify({ assignment_id: assignmentId, type: 'reject' }),
        });
        showToast('Snag rejected — sent back for revision', 'success');
        onRejected?.();
        handleClose();
      } else {
        showToast(res?.error || 'Failed to reject', 'error');
      }
    } catch { showToast('Error rejecting snag', 'error'); }
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
      title="Reject & Reassign"
      actions={[
        { label: 'Cancel', onClick: handleClose, variant: 'ghost' },
        { label: 'Reject & Reassign', onClick: handleSubmit, variant: 'danger', disabled: !remarks.trim(), loading: submitting },
      ]}
    >
      <div className="action-modal-field">
        <label>Rejection Remarks (required)</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Explain what needs to be corrected before this can be closed..."
        />
      </div>
    </ActionModal>
  );
}
