/**
 * Derive priority from category.
 * safety_compliance → critical, design_conflicts/resource_blockers → high,
 * workflow_issues → medium, everything else → low
 */
export function getPriority(category) {
  if (!category) return 'low';
  const c = category.toLowerCase();
  if (c.includes('safety')) return 'critical';
  if (c.includes('design') || c.includes('resource')) return 'high';
  if (c.includes('workflow')) return 'medium';
  return 'low';
}

/**
 * Derive display status from the snag's own status field
 * plus any assignment data. The snag table has pending/resolved.
 * We check assignment statuses to derive in_progress/in_review.
 */
export function getStatus(snagStatus, assignmentStatus) {
  if (snagStatus === 'resolved') return 'closed';
  // If we have assignment-level status info
  if (assignmentStatus === 'in_review') return 'in_review';
  if (assignmentStatus === 'in_progress') return 'in_progress';
  if (assignmentStatus === 'open' && snagStatus === 'pending') return 'open';
  // Fallback: use acknowledged_at for backward compat
  return 'open';
}

/** Map assignment status directly */
export function getAssignmentDisplayStatus(assignmentStatus) {
  const map = {
    open: 'open',
    in_progress: 'in_progress',
    in_review: 'in_review',
    resolved: 'closed',
  };
  return map[assignmentStatus] || 'open';
}

/** Human-readable status label */
export function getStatusLabel(status) {
  const map = {
    open: 'Open',
    in_progress: 'In Progress',
    in_review: 'In Review',
    closed: 'Closed',
  };
  return map[status] || 'Open';
}

/** CSS class suffix for badge */
export function getStatusBadgeClass(status) {
  return status || 'open';
}

/** CSS class suffix for priority badge */
export function getPriorityBadgeClass(category) {
  return getPriority(category);
}

/** Human-readable category */
export function formatCategory(category) {
  if (!category) return 'Uncategorized';
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Map category to a "vertical" label like the reference */
export function getCategoryVertical(category) {
  if (!category) return 'other';
  const c = category.toLowerCase();
  if (c.includes('safety')) return 'safety';
  if (c.includes('design')) return 'design';
  if (c.includes('resource')) return 'inventory';
  if (c.includes('workflow')) return 'quality';
  return 'other';
}

/** Priority colors for inline use */
export function getPriorityColor(category) {
  const p = getPriority(category);
  const map = {
    critical: 'var(--brand-red)',
    high: 'var(--amber)',
    medium: 'var(--blue)',
    low: 'var(--ink-400)'
  };
  return map[p] || map.low;
}

/** Format a snag ID nicely like "SNG-0042" */
export function formatSnagId(id) {
  if (!id) return 'SNG-????';
  // If it's a UUID, take last 4 chars
  const str = String(id);
  if (str.length > 8) {
    const num = parseInt(str.replace(/-/g, '').slice(-6), 16) % 10000;
    return `SNG-${String(num).padStart(4, '0')}`;
  }
  return `SNG-${String(id).padStart(4, '0')}`;
}

/** Time-of-day greeting */
export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Compute the "worst" assignment status for a snag from its assignments array */
export function deriveSnagDisplayStatus(snagStatus, assignments) {
  if (snagStatus === 'resolved') return 'closed';
  if (!assignments || assignments.length === 0) return 'open';
  // Priority: in_review > in_progress > open
  const statuses = assignments.map(a => a.status);
  if (statuses.includes('in_review')) return 'in_review';
  if (statuses.includes('in_progress')) return 'in_progress';
  if (statuses.some(s => s !== 'open')) return 'in_progress';
  return 'open';
}
