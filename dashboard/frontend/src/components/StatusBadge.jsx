import React from 'react';
import { getImpact, getStatusLabel, getCategoryVertical, formatCategory, formatAssignmentPriority } from '../utils/snagHelpers';

/** Status pill with colored dot — matches reference .status-pill */
export function StatusPill({ displayStatus }) {
  const classMap = {
    open: 's-open',
    in_progress: 's-progress',
    in_review: 's-review',
    closed: 's-closed',
  };
  const cls = classMap[displayStatus] || 's-open';
  const label = getStatusLabel(displayStatus);
  return (
    <span className={`status-pill ${cls}`}>
      <span className="sdot" />
      {label}
    </span>
  );
}

/** Impact badge (renamed from PriorityBadge) — auto-derived from category */
export function ImpactBadge({ category }) {
  const impact = getImpact(category);
  return (
    <span className={`prio-badge prio-${impact}`}>
      <svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
      {impact.toUpperCase()}
    </span>
  );
}

/** Backward compat alias */
export const PriorityBadge = ImpactBadge;

/** Assignment priority badge — set by assigner (low/medium/high/urgent) */
export function AssignmentPriorityBadge({ priority }) {
  if (!priority) return null;
  const label = formatAssignmentPriority(priority);
  const colorMap = {
    low: 'var(--blue, #3498db)',
    medium: 'var(--ink-600, #666)',
    high: 'var(--amber, #f39c12)',
    urgent: 'var(--brand-red, #e74c3c)',
  };
  const color = colorMap[priority.toLowerCase()] || 'var(--ink-400)';
  return (
    <span className="assignment-priority-badge" style={{ color, borderColor: color, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '1px 6px', border: '1px solid', borderRadius: '4px' }}>
      {label}
    </span>
  );
}

/** Category tag — matches reference .tag */
export function CategoryTag({ category }) {
  const vertical = getCategoryVertical(category);
  return (
    <span className={`tag tag-${vertical}`}>
      {formatCategory(category)}
    </span>
  );
}

// Keep backwards compat exports
export function StatusBadge({ status, acknowledged_at }) {
  // Map old-style params to new display status
  let displayStatus = 'open';
  if (status === 'resolved') displayStatus = 'closed';
  else if (status === 'pending' && acknowledged_at) displayStatus = 'in_progress';
  return <StatusPill displayStatus={displayStatus} />;
}

export function CategoryBadge({ category }) {
  return <CategoryTag category={category} />;
}

/** Revision tag — amber badge when rejection count > 0 */
export function RevisionTag({ rejectionCount }) {
  if (!rejectionCount) return null;
  return <span className="tag tag-revision">Revision needed</span>;
}
