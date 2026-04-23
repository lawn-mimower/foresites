import React, { useState } from 'react';
import { StatusPill, ImpactBadge, CategoryTag, RevisionTag, AssignmentPriorityBadge } from './StatusBadge';
import SnagDetailSection from './card-sections/SnagDetailSection';
import AudioReportSection from './card-sections/AudioReportSection';
import ResolutionSection from './card-sections/ResolutionSection';
import AssignmentSection from './card-sections/AssignmentSection';
import {
  getImpact,
  formatSnagId,
  getCategoryVertical,
  formatCategory,
} from '../utils/snagHelpers';

/**
 * AssignerCard — used in All Snags page and "Jobs I Assigned" tab.
 * Shows snag details with assign/escalate/reject/close actions.
 *
 * Supports grid and list view modes.
 */
export default function AssignerCard({
  snag,
  assignment,
  displayStatus,
  onImageClick,
  onAssign,
  onReassign,
  onReject,
  onEscalate,
  onClose,
  isAdmin = false,
  isHighlighted = false,
  viewMode = 'grid',
  getDueClass,
  formatDue,
  apiCall,
  apiBase,
}) {
  const [listExpanded, setListExpanded] = useState(false);
  const impact = getImpact(snag.category);
  const vertical = getCategoryVertical(snag.category);
  const snagId = formatSnagId(snag.id);
  const dueDate = assignment?.due_date || null;

  if (viewMode === 'list' && !listExpanded) {
    // Compact list row
    return (
      <div
        id={`snag-card-${snag.id}`}
        className={`snag-card priority-${impact}${isHighlighted ? ' snag-highlighted' : ''}`}
        onClick={() => setListExpanded(true)}
        style={{ cursor: 'pointer' }}
      >
        <div className="card-accent" />
        <div className="card-body-list">
          <div className="list-col list-col-id">
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-400)' }}>
              <span style={{ color: 'var(--ink-600)', fontWeight: 500 }}>{snagId}</span>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-black)', marginTop: '2px', lineHeight: 1.3 }}>
              {snag.feedback || (snag.feedback_type === 'voice' ? 'Voice Feedback' : 'No feedback')}
            </div>
          </div>
          <div className="list-col list-col-tags">
            <CategoryTag category={snag.category} />
            <ImpactBadge category={snag.category} />
          </div>
          <div className="list-col list-col-assign">
            <div style={{ fontSize: '12px', fontWeight: 600, color: assignment ? 'var(--brand-black)' : 'var(--ink-400)' }}>
              {assignment ? assignment.username : 'Unassigned'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{snag.site?.site_name || '—'}</div>
          </div>
          <div className="list-col list-col-due">
            <div className={`due-cell ${getDueClass?.(dueDate) || 'due-ok'}`}>{formatDue?.(dueDate) || '—'}</div>
          </div>
          <div className="list-col list-col-actions" style={{ display: 'flex', gap: '4px' }}>
            <StatusPill displayStatus={displayStatus} />
          </div>
        </div>
      </div>
    );
  }

  // Grid view (or expanded list view)
  return (
    <div
      id={`snag-card-${snag.id}`}
      className={`snag-card priority-${impact}${isHighlighted ? ' snag-highlighted' : ''}`}
    >
      <div className="card-accent" />

      {/* Collapse button for expanded list items */}
      {viewMode === 'list' && listExpanded && (
        <button
          className="list-collapse-btn"
          onClick={() => setListExpanded(false)}
          style={{
            position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: '18px', color: 'var(--ink-400)', zIndex: 1,
          }}
          title="Collapse"
        >
          &times;
        </button>
      )}

      {/* Card Header */}
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-snag-id">
            <span className="id-num">{snagId}</span>
            <span className={`tag tag-${vertical}`}>{formatCategory(snag.category)}</span>
          </div>
          <div className="card-title">
            {snag.feedback || (snag.feedback_type === 'voice' ? 'Voice Feedback' : 'No feedback')}
          </div>
          <div className="card-meta-row">
            <ImpactBadge category={snag.category} />
            {assignment?.priority && (
              <>
                <span className="meta-dot">&middot;</span>
                <AssignmentPriorityBadge priority={assignment.priority} />
              </>
            )}
            <span className="meta-dot">&middot;</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{snag.site?.site_name || '—'}</span>
            <span className="meta-dot">&middot;</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{snag.reporter_name || '—'}</span>
          </div>
        </div>
        <div className="card-header-right">
          <StatusPill displayStatus={displayStatus} />
          <RevisionTag rejectionCount={assignment?.rejection_count} />
        </div>
      </div>

      {/* Card Body — Collapsible Sections */}
      <div className="card-body">
        <SnagDetailSection snag={snag} onImageClick={onImageClick} apiCall={apiCall} apiBase={apiBase} defaultOpen={false} />
        <AudioReportSection snag={snag} apiCall={apiCall} apiBase={apiBase} defaultOpen={false} />
        <ResolutionSection
          mode="assigner"
          assignment={assignment}
          snag={snag}
          defaultOpen={false}
          apiCall={apiCall}
          apiBase={apiBase}
        />
        <AssignmentSection
          assignment={assignment}
          snag={snag}
          dueDate={dueDate}
          onAssign={onAssign}
          onReassign={onReassign}
          isAdmin={isAdmin}
          defaultOpen={false}
          getDueClass={getDueClass}
          formatDue={formatDue}
        />
      </div>

      {/* Card Footer */}
      <div className="card-footer">
        <div className="card-footer-meta">
          {dueDate && getDueClass && formatDue && (
            <span className="footer-meta-item">
              <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
              Due <strong className={getDueClass(dueDate)}>{formatDue(dueDate)}</strong>
            </span>
          )}
          <span className="footer-meta-item">
            <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <strong>{snag.site?.site_name || '—'}</strong>
          </span>
        </div>
        <div className="card-footer-actions">
          {/* Open/unassigned → Assign */}
          {displayStatus === 'open' && !assignment && isAdmin && (
            <button className="footer-btn" onClick={onAssign}>
              <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              Assign
            </button>
          )}
          {/* In Progress → Escalate */}
          {displayStatus === 'in_progress' && assignment && (
            <button className="footer-btn flag-btn" onClick={onEscalate}>
              <svg viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
              Escalate
            </button>
          )}
          {/* In Review → Reject + Close */}
          {displayStatus === 'in_review' && assignment && (
            <>
              <button className="footer-btn flag-btn" onClick={onReject}>
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                Reject
              </button>
              <button className="footer-btn close-btn" onClick={onClose}>
                <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                Close Snag
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
