import React, { useState, useEffect } from 'react';
import ActionModal from './ActionModal';
import { useAuth } from '../AuthContext';
import { showToast } from '../Toast';

const API = 'http://localhost:9999/api';

export default function AssignModal({ isOpen, onClose, snagId, siteId, onAssigned }) {
  const { apiCall } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [remarks, setRemarks] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !siteId) return;
    (async () => {
      try {
        const data = await apiCall(`${API}/snag-assignments/site/${siteId}/users`);
        if (Array.isArray(data)) setUsers(data);
      } catch { setUsers([]); }
    })();
  }, [isOpen, siteId, apiCall]);

  const handleSubmit = async () => {
    if (!selectedUser) { showToast('Please select a team member', 'warning'); return; }
    setSubmitting(true);
    try {
      const body = {
        snag_id: snagId,
        site_id: siteId,
        assigned_user_id: selectedUser,
        assigner_remarks: remarks,
      };
      if (dueDate) body.due_date = new Date(dueDate).toISOString();

      const res = await apiCall(`${API}/snag-assignments/assignments`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res && !res.error) {
        // Fire notify stub
        await apiCall(`${API}/snag-assignments/notify`, {
          method: 'POST',
          body: JSON.stringify({ assignment_id: res.assignment?.assignment_id, type: 'assign' }),
        });
        showToast('Task assigned!', 'success');
        onAssigned?.();
        handleClose();
      } else {
        showToast(res?.error || 'Failed to assign', 'error');
      }
    } catch { showToast('Error assigning task', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleClose = () => {
    setSelectedUser('');
    setRemarks('');
    setDueDate('');
    onClose();
  };

  return (
    <ActionModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Assign Snag"
      actions={[
        { label: 'Cancel', onClick: handleClose, variant: 'ghost' },
        { label: 'Assign & Notify', onClick: handleSubmit, variant: 'primary', disabled: !selectedUser, loading: submitting },
      ]}
    >
      <div className="action-modal-field">
        <label>Assign To</label>
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
          <option value="">— Select engineer —</option>
          {users.map(u => (
            <option key={u.user_id} value={u.user_id}>{u.username} ({u.role})</option>
          ))}
        </select>
      </div>
      <div className="action-modal-field">
        <label>Remarks</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Instructions or context for the assignee..."
        />
      </div>
      <div className="action-modal-field">
        <label>Due Date</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
    </ActionModal>
  );
}
