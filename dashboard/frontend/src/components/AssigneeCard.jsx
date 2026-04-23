import React from 'react';
import { StatusPill, ImpactBadge, CategoryTag, RevisionTag, AssignmentPriorityBadge } from './StatusBadge';
import SnagDetailSection from './card-sections/SnagDetailSection';
import AudioReportSection from './card-sections/AudioReportSection';
import ResolutionSection from './card-sections/ResolutionSection';
import {
  getImpact,
  formatSnagId,
  getCategoryVertical,
  formatCategory,
  getAssignmentDisplayStatus,
} from '../utils/snagHelpers';

/**
 * AssigneeCard — used in "My Jobs" tab of Job Zone.
 * Shows snag details with solution/proof submission flow.
 * NO Assignment section.
 */
export default function AssigneeCard({
  job,
  displayStatus,
  solutionText = '',
  proofPreview,
  proofFileName,
  onSolutionChange,
  onProofChange,
  onSetDueDate,
  onSubmitProof,
  isHighlighted = false,
  uploadingProof = false,
  apiCall,
  apiBase,
}) {
  const snag = job.snag || {};
  const impact = snag.category ? getImpact(snag.category) : 'low';
  const vertical = getCategoryVertical(snag.category);
  const snagId = formatSnagId(job.snag_id);

  // Build a snag-like object for the shared sections
  const snagData = {
    ...snag,
    id: job.snag_id,
    site: job.site,
    created_at: job.assigned_at,
    reporter_name: job.site?.site_manager || '—',
  };

  const canSubmitProof = job.due_date && (solutionText?.trim() || proofPreview);

  return (
    <div
      id={`job-card-${job.assignment_id}`}
      className={`snag-card priority-${impact}${isHighlighted ? ' snag-highlighted' : ''}`}
    >
      <div className="card-accent" />

      {/* Card Header */}
      <div className="card-header">
        <div className="card-header-left">
          <div className="card-snag-id">
            <span className="id-num">{snagId}</span>
            {snag.category && <CategoryTag category={snag.category} />}
          </div>
          <div className="card-title">{snag.feedback || 'Assigned Job'}</div>
          <div className="card-meta-row">
            <ImpactBadge category={snag.category} />
            {job.priority && (
              <>
                <span className="meta-dot">&middot;</span>
                <AssignmentPriorityBadge priority={job.priority} />
              </>
            )}
            <span className="meta-dot">&middot;</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{job.site?.site_name || '—'}</span>
            <span className="meta-dot">&middot;</span>
            <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{job.site?.site_manager || '—'}</span>
          </div>
        </div>
        <div className="card-header-right">
          <StatusPill displayStatus={displayStatus} />
          {job.rejection_count > 0 && <RevisionTag rejectionCount={job.rejection_count} />}
        </div>
      </div>

      {/* Card Body */}
      <div className="card-body">
        <SnagDetailSection snag={snagData} apiCall={apiCall} apiBase={apiBase} defaultOpen={false} />
        <AudioReportSection snag={snagData} apiCall={apiCall} apiBase={apiBase} defaultOpen={false} />
        <ResolutionSection
          mode="assignee"
          assignment={job}
          snag={snag}
          onSetDueDate={(date) => onSetDueDate?.(job.assignment_id, date)}
          onSolutionChange={onSolutionChange}
          onProofChange={onProofChange}
          solutionText={solutionText}
          proofPreview={proofPreview}
          proofFileName={proofFileName}
          defaultOpen={true}
          apiCall={apiCall}
          apiBase={apiBase}
        />

        {/* Assignment notes & rejection remarks */}
        {(job.assigner_remarks || job.rejection_remarks) && (
          <div style={{ padding: '0 16px 12px' }}>
            {job.assigner_remarks && (
              <div className="suggestion-box" style={{ marginTop: '8px' }}>
                <div className="suggestion-header">
                  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                  <span className="suggestion-header-label">Assignment Notes</span>
                </div>
                <div className="suggestion-text">{job.assigner_remarks}</div>
              </div>
            )}
            {job.rejection_remarks && (
              <div className="suggestion-box" style={{ marginTop: '8px', borderColor: 'var(--red, #e74c3c)' }}>
                <div className="suggestion-header" style={{ color: 'var(--red, #e74c3c)' }}>
                  <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  <span className="suggestion-header-label">Rejection Remarks</span>
                </div>
                <div className="suggestion-text">{job.rejection_remarks}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="card-footer">
        <div className="card-footer-meta">
          <span className="footer-meta-item">
            <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
            Assigned <strong>{new Date(job.assigned_at).toLocaleDateString('en-GB')}</strong>
          </span>
          {job.resolved_at && (
            <span className="footer-meta-item">
              Resolved <strong>{new Date(job.resolved_at).toLocaleDateString('en-GB')}</strong>
            </span>
          )}
        </div>
        <div className="card-footer-actions">
          {/* Submit Proof — only when due date set and solution/proof provided */}
          {(displayStatus === 'in_progress') && canSubmitProof && (
            <button
              className="footer-btn close-btn"
              onClick={() => onSubmitProof?.(job.assignment_id)}
              disabled={uploadingProof}
            >
              <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              {uploadingProof ? 'Uploading…' : 'Submit Proof'}
            </button>
          )}
          {displayStatus === 'closed' && (
            <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Completed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
