import React from 'react';
import { getPriority, getStatusLabel, getCategoryVertical, formatCategory } from '../utils/snagHelpers';

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

/** Priority badge with triangle icon — matches reference .prio-badge */
export function PriorityBadge({ category }) {
  const priority = getPriority(category);
  return (
    <span className={`prio-badge prio-${priority}`}>
      <svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
      {priority.toUpperCase()}
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
