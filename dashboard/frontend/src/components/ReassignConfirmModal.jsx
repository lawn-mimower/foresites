import React from 'react';
import ActionModal from './ActionModal';

/**
 * Confirmation dialog before reassignment.
 * "This job is assigned to [X]. Confirm transfer to a new assignee?"
 */
export default function ReassignConfirmModal({ isOpen, onClose, currentAssigneeName, onConfirm }) {
  if (!isOpen) return null;

  return (
    <ActionModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Reassignment"
      actions={[
        { label: 'Cancel', onClick: onClose, variant: 'ghost' },
        { label: 'Confirm & Reassign', onClick: onConfirm, variant: 'primary' },
      ]}
    >
      <div style={{ padding: '8px 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--ink-600)' }}>
        This job is currently assigned to <strong>{currentAssigneeName || 'Unknown'}</strong>.
        <br />
        Do you want to transfer it to a new assignee?
      </div>
    </ActionModal>
  );
}
