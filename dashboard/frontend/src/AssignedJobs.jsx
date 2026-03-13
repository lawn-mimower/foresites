import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import { getPriority, formatCategory, formatSnagId, getAssignmentDisplayStatus, getStatusLabel } from "./utils/snagHelpers";
import { StatusPill, PriorityBadge, CategoryTag } from "./components/StatusBadge";
import "./css/allfb.css";

export function AssignedJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [solutionInputs, setSolutionInputs] = useState({});
  const { apiCall } = useAuth();

  const API = "http://localhost:9999/api";

  useEffect(() => {
    fetchAssignedJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiCall]);

  const fetchAssignedJobs = async () => {
    setLoading(true);
    try {
      const data = await apiCall(`${API}/snag-assignments/user/assigned-jobs`);
      if (!data || data.error) {
        setJobs([]);
        showToast("Failed to load assigned jobs", "error");
        return;
      }
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching assigned jobs:", err);
      setJobs([]);
      showToast("Error loading assigned jobs", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (assignmentId, newStatus, solution) => {
    try {
      const body = { status: newStatus };
      if (solution) body.solution = solution;

      const response = await apiCall(
        `${API}/snag-assignments/assignments/${assignmentId}`,
        { method: "PUT", body: JSON.stringify(body) }
      );

      if (response && !response.error) {
        setJobs((prev) =>
          prev.map((job) =>
            job.assignment_id === assignmentId
              ? {
                  ...job,
                  status: newStatus,
                  solution: solution || job.solution,
                  resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
                }
              : job
          )
        );
        showToast(`Job status updated to ${getStatusLabel(getAssignmentDisplayStatus(newStatus))}`, "success");
      }
    } catch (err) {
      console.error("Error updating job:", err);
      showToast("Error updating job status", "error");
    }
  };

  const filteredJobs = () => {
    if (filter === "resolved") return jobs.filter((job) => job.status === "resolved");
    if (filter === "open") return jobs.filter((job) => job.status === "open");
    if (filter === "in_progress") return jobs.filter((job) => job.status === "in_progress");
    if (filter === "in_review") return jobs.filter((job) => job.status === "in_review");
    return jobs;
  };

  const total = jobs.length;
  const resolved = jobs.filter((job) => job.status === "resolved").length;
  const openCount = jobs.filter((job) => job.status === "open").length;
  const inProgressCount = jobs.filter((job) => job.status === "in_progress").length;
  const displayJobs = filteredJobs();

  const getDueClass = (dueDate) => {
    if (!dueDate) return 'due-ok';
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(dueDate).toISOString().split('T')[0];
    if (due < today) return 'due-over';
    if (due === today) return 'due-today';
    return 'due-ok';
  };

  return (
    <div className="all-snags-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-block">
          <div className="page-eyebrow">Your assignments</div>
          <div className="page-title">Assigned <span>Jobs</span></div>
          <div className="page-meta">
            {total} total &middot; {openCount} open &middot; {inProgressCount} in progress &middot; {resolved} resolved
          </div>
        </div>
        <div className="page-header-right">
          <button className="footer-btn" onClick={fetchAssignedJobs} disabled={loading} style={{ padding: '8px 16px', fontSize: '12px' }}>
            <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <span className="filter-label">Filter</span>
        {[
          { key: "all", label: `All (${total})` },
          { key: "open", label: `Open (${openCount})` },
          { key: "in_progress", label: `In Progress (${inProgressCount})` },
          { key: "resolved", label: `Resolved (${resolved})` },
        ].map(f => (
          <button
            key={f.key}
            className={`footer-btn${filter === f.key ? '' : ''}`}
            onClick={() => setFilter(f.key)}
            style={{
              background: filter === f.key ? 'var(--brand-black)' : 'var(--brand-white)',
              color: filter === f.key ? 'var(--brand-white)' : 'var(--ink-800)',
              borderColor: filter === f.key ? 'var(--brand-black)' : 'var(--rule)',
            }}
          >
            {f.label}
          </button>
        ))}
        <div className="results-count">{displayJobs.length} job{displayJobs.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Job Cards */}
      <div className="cards-grid" style={{ gridTemplateColumns: '1fr' }}>
        {loading && (
          <div className="empty-state">
            <div className="empty-state-title">Loading…</div>
          </div>
        )}

        {!loading && displayJobs.length === 0 && (
          <div className="empty-state">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <div className="empty-state-title">
              {filter === "all" ? "No assigned jobs yet" : `No ${filter.replace('_', ' ')} jobs`}
            </div>
            <div className="empty-state-sub">Jobs assigned to you will appear here</div>
          </div>
        )}

        {!loading && displayJobs.map((job) => {
          const priority = job.snag?.category ? getPriority(job.snag.category) : "low";
          const displayStatus = getAssignmentDisplayStatus(job.status);
          const snagId = formatSnagId(job.snag_id);

          return (
            <div key={job.assignment_id} className={`snag-card priority-${priority}`}>
              <div className="card-accent" />

              <div className="card-header">
                <div className="card-header-left">
                  <div className="card-snag-id">
                    <span className="id-num">{snagId}</span>
                    {job.snag?.category && <CategoryTag category={job.snag.category} />}
                  </div>
                  <div className="card-title">{job.snag?.feedback || "Assigned Job"}</div>
                  <div className="card-meta-row">
                    <PriorityBadge category={job.snag?.category} />
                    <span className="meta-dot">&middot;</span>
                    <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{job.site?.site_name || '—'}</span>
                    <span className="meta-dot">&middot;</span>
                    <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{job.site?.site_manager || '—'}</span>
                  </div>
                </div>
                <div className="card-header-right">
                  <StatusPill displayStatus={displayStatus} />
                </div>
              </div>

              <div className="card-body">
                {/* Assignment details */}
                <div className="card-section">
                  <div className="section-content open" style={{ paddingTop: '14px' }}>
                    <div className="snag-detail-grid">
                      <div>
                        <div className="detail-label">Site</div>
                        <div className="detail-value">{job.site?.site_name || '—'}</div>
                      </div>
                      <div>
                        <div className="detail-label">Manager</div>
                        <div className="detail-value">{job.site?.site_manager || '—'}</div>
                      </div>
                      <div>
                        <div className="detail-label">Assigned</div>
                        <div className="detail-value mono">{new Date(job.assigned_at).toLocaleDateString('en-GB')}</div>
                      </div>
                      {job.due_date && (
                        <div>
                          <div className="detail-label">Due Date</div>
                          <div className={`detail-value mono ${getDueClass(job.due_date)}`}>
                            {new Date(job.due_date).toLocaleDateString('en-GB')}
                          </div>
                        </div>
                      )}
                    </div>

                    {(job.assigner_remarks || job.description) && (
                      <div className="suggestion-box" style={{ marginTop: '8px' }}>
                        <div className="suggestion-header">
                          <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                          <span className="suggestion-header-label">Assignment Notes</span>
                        </div>
                        <div className="suggestion-text">{job.assigner_remarks || job.description}</div>
                      </div>
                    )}

                    {job.snag?.image_url && (
                      <div className="snag-image-thumb" onClick={() => window.open(job.snag.image_url, "_blank")} style={{ marginTop: '8px' }}>
                        <img src={job.snag.image_url} alt="Snag attachment" />
                        <span className="image-expand-hint">View full</span>
                      </div>
                    )}

                    {job.snag?.transcription && (
                      <div className="transcription-box" style={{ marginTop: '8px' }}>{job.snag.transcription}</div>
                    )}

                    {/* Solution input for in_progress jobs */}
                    {(job.status === 'in_progress' || job.status === 'open') && (
                      <div style={{ marginTop: '10px' }}>
                        <textarea
                          className="assign-notes-input"
                          placeholder="Describe the solution implemented…"
                          value={solutionInputs[job.assignment_id] || ""}
                          onChange={(e) => setSolutionInputs({ ...solutionInputs, [job.assignment_id]: e.target.value })}
                          rows="2"
                        />
                      </div>
                    )}

                    {job.solution && (
                      <div className="solution-box" style={{ marginTop: '8px' }}>
                        <div className="solution-header">
                          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                          <span className="solution-header-label">Solution Filed</span>
                        </div>
                        <div className="solution-text">{job.solution}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                  {job.status === 'open' && (
                    <button className="footer-btn" onClick={() => updateJobStatus(job.assignment_id, 'in_progress')}>
                      Start Work
                    </button>
                  )}
                  {job.status === 'in_progress' && (
                    <button
                      className="footer-btn close-btn"
                      onClick={() => updateJobStatus(job.assignment_id, 'in_review', solutionInputs[job.assignment_id])}
                    >
                      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      Submit for Review
                    </button>
                  )}
                  {job.status === 'resolved' && (
                    <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Completed
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
