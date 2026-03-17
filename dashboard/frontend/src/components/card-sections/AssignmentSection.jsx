import React from 'react';
import { CollapsibleSection } from '../CollapsibleSection';

const ICON_ASSIGN = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

/**
 * AssignmentSection — shows current assignee with reassign option.
 * Only used in AssignerCard (not AssigneeCard).
 */
export default function AssignmentSection({
  assignment,
  snag,
  dueDate,
  onAssign,
  onReassign,
  isAdmin = false,
  defaultOpen = false,
  getDueClass,
  formatDue,
}) {
  const assignBadge = assignment
    ? { text: assignment.username, cls: 'has-content' }
    : { text: 'Unassigned', cls: '' };

  return (
    <CollapsibleSection
      title="Assignment"
      icon={ICON_ASSIGN}
      badge={assignBadge.text}
      badgeClass={assignBadge.cls}
      defaultOpen={defaultOpen}
    >
      <div className="assignment-block">
        {assignment ? (
          <div className="assignment-current">
            <div className="assign-avatar">
              {assignment.username.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div className="assign-info">
              <div className="assign-name">{assignment.username}</div>
              <div className="assign-sub">{assignment.role || 'Team member'} &middot; {snag?.site?.site_name || '—'}</div>
            </div>
            {dueDate && getDueClass && formatDue && (
              <div className="assign-eta">
                <div className="assign-eta-label">Est. completion</div>
                <span className={getDueClass(dueDate)}>{formatDue(dueDate)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="assignment-current">
            <div className="assign-avatar unassigned">
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#9A9A9A' }}>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div className="assign-info">
              <div className="assign-name unassigned">Unassigned</div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="assign-row" style={{ marginTop: '8px' }}>
            <button
              className="assign-btn"
              onClick={() => assignment ? onReassign?.() : onAssign?.()}
            >
              {assignment ? 'Reassign' : 'Assign'}
            </button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
