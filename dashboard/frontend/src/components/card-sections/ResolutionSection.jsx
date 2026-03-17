import React from 'react';
import { CollapsibleSection } from '../CollapsibleSection';
import ProofImage from '../ProofImage';

const ICON_RESOLUTION = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>';

/**
 * ResolutionSection — adaptive based on mode.
 *
 * Assigner mode: read-only view of solution/proof/suggestion.
 * Assignee mode: interactive — set due date, then solution + proof upload.
 */
export default function ResolutionSection({
  mode = 'assigner',
  assignment,
  snag,
  // Assignee-mode callbacks & state
  onSetDueDate,
  onSolutionChange,
  onProofChange,
  solutionText = '',
  proofPreview,
  proofFileName,
  defaultOpen = false,
  apiCall,
  apiBase,
}) {
  const hasSolution = assignment?.solution;
  const hasProof = assignment?.proof;
  const displayStatus = assignment?.status || 'open';

  // Badge logic
  let badgeText, badgeCls;
  if (hasSolution) {
    badgeText = 'Solution filed';
    badgeCls = 'has-content';
  } else if (displayStatus === 'in_review') {
    badgeText = 'Pending review';
    badgeCls = 'pending';
  } else {
    badgeText = 'Awaiting';
    badgeCls = '';
  }

  return (
    <CollapsibleSection
      title="Resolution"
      icon={ICON_RESOLUTION}
      badge={badgeText}
      badgeClass={badgeCls}
      defaultOpen={defaultOpen}
    >
      {mode === 'assigner' ? (
        <AssignerResolution assignment={assignment} snag={snag} apiCall={apiCall} apiBase={apiBase} />
      ) : (
        <AssigneeResolution
          assignment={assignment}
          snag={snag}
          onSetDueDate={onSetDueDate}
          onSolutionChange={onSolutionChange}
          onProofChange={onProofChange}
          solutionText={solutionText}
          proofPreview={proofPreview}
          proofFileName={proofFileName}
          apiCall={apiCall}
          apiBase={apiBase}
        />
      )}
    </CollapsibleSection>
  );
}

function AssignerResolution({ assignment, snag, apiCall, apiBase }) {
  const hasSolution = assignment?.solution;

  if (hasSolution) {
    return (
      <>
        <div className="solution-box">
          <div className="solution-header">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            <span className="solution-header-label">Solution Delivered</span>
          </div>
          <div className="solution-text">{assignment.solution}</div>
          <div className="solution-submitted-by">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            Filed by {assignment.username || 'Unknown'}
          </div>
        </div>
        {assignment.proof && apiCall && (
          <ProofImage proofKey={assignment.proof} apiCall={apiCall} apiBase={apiBase} />
        )}
      </>
    );
  }

  if (snag?.suggestion) {
    return (
      <>
        <div className="suggestion-box">
          <div className="suggestion-header">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <span className="suggestion-header-label">Suggested Resolution</span>
          </div>
          <div className="suggestion-text">{snag.suggestion}</div>
        </div>
        <div className="no-solution">
          <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
          Solution not yet filed by engineer
        </div>
      </>
    );
  }

  return (
    <div className="no-solution">
      <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
      No solution or suggestion recorded yet
    </div>
  );
}

function AssigneeResolution({
  assignment,
  snag,
  onSetDueDate,
  onSolutionChange,
  onProofChange,
  solutionText,
  proofPreview,
  proofFileName,
  apiCall,
  apiBase,
}) {
  const hasDueDate = !!assignment?.due_date;
  const hasSolution = !!assignment?.solution;
  const status = assignment?.status || 'open';

  // Already resolved — show solution read-only
  if (status === 'resolved' || status === 'in_review') {
    return (
      <>
        {assignment?.solution && (
          <div className="solution-box">
            <div className="solution-header">
              <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              <span className="solution-header-label">Solution Filed</span>
            </div>
            <div className="solution-text">{assignment.solution}</div>
          </div>
        )}
        {assignment?.proof && apiCall && (
          <ProofImage proofKey={assignment.proof} apiCall={apiCall} apiBase={apiBase} />
        )}
      </>
    );
  }

  // Step 1: No due date — show date picker
  if (!hasDueDate) {
    return (
      <div className="resolution-step">
        <div className="resolution-step-label">
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'var(--ink-400)' }}>
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
          </svg>
          Set your expected completion date
        </div>
        <input
          type="date"
          className="assign-notes-input"
          style={{ padding: '8px 12px', fontSize: '13px', width: '200px', marginTop: '8px' }}
          min={new Date().toISOString().split('T')[0]}
          onChange={(e) => onSetDueDate?.(e.target.value)}
        />
      </div>
    );
  }

  // Step 2: Has due date — show solution + proof upload
  return (
    <div className="resolution-step">
      <div className="resolution-step-label" style={{ marginBottom: '8px' }}>
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'var(--green, #27ae60)' }}>
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        Due: {new Date(assignment.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>

      <textarea
        className="assign-notes-input"
        placeholder="Describe the solution implemented…"
        value={solutionText}
        onChange={(e) => onSolutionChange?.(e.target.value)}
        rows="2"
      />

      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '12px', cursor: 'pointer', padding: '4px 10px', border: '1px solid var(--rule)', borderRadius: '6px', background: 'var(--brand-white)' }}>
          <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'currentColor', verticalAlign: 'middle', marginRight: 4 }}>
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
          Attach Proof
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => onProofChange?.(e.target.files[0])}
          />
        </label>
        {proofFileName && (
          <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{proofFileName}</span>
        )}
      </div>
      {proofPreview && (
        <div style={{ marginTop: '6px' }}>
          <img
            src={proofPreview}
            alt="Proof preview"
            style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '6px', border: '1px solid var(--rule)' }}
          />
        </div>
      )}
    </div>
  );
}
