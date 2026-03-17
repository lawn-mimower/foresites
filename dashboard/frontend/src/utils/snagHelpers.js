/**
 * Dynamic impact map — populated from DB via setImpactMap().
 * Falls back to hardcoded logic on first render before fetch completes.
 */
let _impactMap = null;
export function setImpactMap(map) { _impactMap = map; }

/**
 * Derive impact from category (renamed from "priority").
 * Impact = how bad the snag is for the project (auto-derived from category).
 * Uses DB-backed mapping if loaded, otherwise falls back to hardcoded defaults.
 */
export function getImpact(category) {
  if (!category) return 'low';
  if (_impactMap && _impactMap[category]) return _impactMap[category];
  // Hardcoded fallback for first render / before DB mapping loads
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
    rejected: 'in_progress',
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

/** CSS class suffix for impact badge */
export function getImpactBadgeClass(category) {
  return getImpact(category);
}

// Backward compat alias
export const getPriorityBadgeClass = getImpactBadgeClass;

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

/** Impact colors for inline use */
export function getImpactColor(category) {
  const p = getImpact(category);
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

// Backward compat aliases
export const getPriority = getImpact;
export const getPriorityColor = getImpactColor;

/**
 * Format assigner-set priority (Low/Medium/High/Urgent).
 * This is DIFFERENT from impact — priority = how urgently the assigner wants it fixed.
 */
export function formatAssignmentPriority(priority) {
  if (!priority) return null;
  const map = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
  return map[priority.toLowerCase()] || priority;
}

/** Compute the "worst" assignment status for a snag from its assignments array */
export function deriveSnagDisplayStatus(snagStatus, assignments) {
  if (snagStatus === 'resolved') return 'closed';
  if (!assignments || assignments.length === 0) return 'open';
  // Priority: in_review > in_progress/rejected > open
  const statuses = assignments.map(a => a.status);
  if (statuses.includes('in_review')) return 'in_review';
  if (statuses.includes('in_progress') || statuses.includes('rejected')) return 'in_progress';
  if (statuses.some(s => s !== 'open')) return 'in_progress';
  return 'open';
}
