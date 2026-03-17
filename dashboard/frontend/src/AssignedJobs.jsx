import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import { API_BASE } from "./config/api";
import { getAssignmentDisplayStatus } from "./utils/snagHelpers";
import AssigneeCard from "./components/AssigneeCard";
import AssignerCard from "./components/AssignerCard";
import AssignModal from "./components/AssignModal";
import RejectModal from "./components/RejectModal";
import EscalateModal from "./components/EscalateModal";
import ReassignConfirmModal from "./components/ReassignConfirmModal";
import { Lightbox } from "./components/Lightbox";
import { deriveSnagDisplayStatus } from "./utils/snagHelpers";
import { cachedFetch, invalidate } from "./utils/dataCache";
import { useDataFreshness } from "./hooks/useDataFreshness";
import "./css/allfb.css";

export function AssignedJobs() {
  const [jobs, setJobs] = useState([]);
  const [assignedByMe, setAssignedByMe] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [solutionInputs, setSolutionInputs] = useState({});
  const [proofFiles, setProofFiles] = useState({});
  const [proofPreviews, setProofPreviews] = useState({});
  const [uploadingProof, setUploadingProof] = useState({});
  const { apiCall, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(isAdmin() ? "assigned-by-me" : "my-jobs");
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const scrolledRef = useRef(false);

  // Action modals (for "Jobs I Assigned" tab)
  const [assignModalSnag, setAssignModalSnag] = useState(null);
  const [rejectModalAssignment, setRejectModalAssignment] = useState(null);
  const [escalateModalAssignment, setEscalateModalAssignment] = useState(null);
  const [reassignConfirm, setReassignConfirm] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  const API = API_BASE;

  const onRefreshForFreshness = useCallback(() => {
    fetchAssignedJobs(true);
    if (isAdmin()) fetchAssignedByMe(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiCall]);
  useDataFreshness(onRefreshForFreshness);

  useEffect(() => {
    fetchAssignedJobs();
    if (isAdmin()) fetchAssignedByMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiCall]);

  useEffect(() => {
    if (!highlightId || jobs.length === 0 || scrolledRef.current) return;
    const el = document.getElementById(`job-card-${highlightId}`);
    if (el) {
      scrolledRef.current = true;
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, jobs]);

  const fetchAssignedJobs = async (bustCache = false) => {
    setLoading(true);
    try {
      if (bustCache) invalidate('myJobs');
      const data = await cachedFetch('myJobs', () => apiCall(`${API}/snag-assignments/user/assigned-jobs`));
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

  const fetchAssignedByMe = async (bustCache = false) => {
    try {
      if (bustCache) invalidate('assignedByMe');
      const data = await cachedFetch('assignedByMe', () => apiCall(`${API}/snag-assignments/assignments/assigned-by-me`));
      if (!data || data.error) {
        setAssignedByMe([]);
        return;
      }
      setAssignedByMe(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching assigned-by-me:", err);
      setAssignedByMe([]);
    }
  };

  const updateDueDate = async (assignmentId, dueDate) => {
    try {
      const response = await apiCall(
        `${API}/snag-assignments/assignments/${assignmentId}`,
        { method: "PUT", body: JSON.stringify({ due_date: dueDate ? new Date(dueDate).toISOString() : null }) }
      );
      if (response && !response.error) {
        invalidate(''); // bust all caches
        setJobs((prev) =>
          prev.map((job) =>
            job.assignment_id === assignmentId ? { ...job, due_date: dueDate || null } : job
          )
        );
        showToast("Due date set", "success");
      }
    } catch (err) {
      showToast("Failed to update due date", "error");
    }
  };

  const handleProofFileChange = (assignmentId, file) => {
    if (!file) return;
    setProofFiles(prev => ({ ...prev, [assignmentId]: file }));
    const url = URL.createObjectURL(file);
    setProofPreviews(prev => ({ ...prev, [assignmentId]: url }));
  };

  const uploadProof = async (assignmentId) => {
    const file = proofFiles[assignmentId];
    if (!file) return;

    setUploadingProof(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const formData = new FormData();
      formData.append('proof', file);

      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API}/snag-assignments/assignments/${assignmentId}/upload-proof`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.s3Key) {
        invalidate(''); // bust all caches so assigner's view updates
        setJobs(prev => prev.map(job =>
          job.assignment_id === assignmentId ? { ...job, proof: data.s3Key, status: 'in_review' } : job
        ));
        setProofFiles(prev => { const n = { ...prev }; delete n[assignmentId]; return n; });
        setProofPreviews(prev => { const n = { ...prev }; delete n[assignmentId]; return n; });
        showToast("Proof uploaded", "success");
      } else {
        showToast(data.error || "Failed to upload proof", "error");
      }
    } catch (err) {
      showToast("Error uploading proof", "error");
    } finally {
      setUploadingProof(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  const handleSubmitForReview = async (assignmentId) => {
    const solution = solutionInputs[assignmentId];
    setUploadingProof(prev => ({ ...prev, [assignmentId]: true }));

    try {
      // Upload proof first if present
      if (proofFiles[assignmentId]) {
        await uploadProof(assignmentId);
      }

      // Update status to in_review with solution
      const body = { status: 'in_review' };
      if (solution) body.solution = solution;

      const response = await apiCall(
        `${API}/snag-assignments/assignments/${assignmentId}`,
        { method: "PUT", body: JSON.stringify(body) }
      );

      if (response && !response.error) {
        invalidate(''); // bust all caches so assigner's view updates
        setJobs((prev) =>
          prev.map((job) =>
            job.assignment_id === assignmentId
              ? { ...job, status: 'in_review', solution: solution || job.solution }
              : job
          )
        );
        showToast("Submitted for review", "success");
      }
    } catch (err) {
      showToast("Error submitting for review", "error");
    } finally {
      setUploadingProof(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  // ── Helpers for AssignerCard in "Jobs I Assigned" tab ──
  const getDueClass = (dueDate) => {
    if (!dueDate) return 'due-ok';
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(dueDate).toISOString().split('T')[0];
    if (due < today) return 'due-over';
    if (due === today) return 'due-today';
    return 'due-ok';
  };

  const formatDue = (dueDate) => {
    if (!dueDate) return '—';
    return new Date(dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const toggleTodo = async (snagId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
      const response = await apiCall(`${API}/dashboard/feedbacks/${snagId}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (response && response.updated) {
        showToast(newStatus === 'resolved' ? "Marked as resolved" : "Reopened", "success");
        invalidate(''); // bust all caches so Dashboard + All Snags stay in sync
        fetchAssignedByMe(true);

        // Send WhatsApp approval notification on close
        if (newStatus === 'resolved') {
          const job = assignedByMe.find(j => j.snag_id === snagId);
          if (job?.assignment_id) {
            apiCall(`${API}/snag-assignments/notify`, {
              method: 'POST',
              body: JSON.stringify({ assignment_id: job.assignment_id, type: 'approve' }),
            }).catch(() => {});
          }
        }
      }
    } catch (err) { showToast("Failed to update status", "error"); }
  };

  const handleReassignClick = (snagData, assignment) => {
    setReassignConfirm({ snag: snagData, assignment });
  };

  const handleReassignConfirmed = () => {
    const { snag, assignment } = reassignConfirm;
    setReassignConfirm(null);
    setAssignModalSnag({
      id: snag.id,
      site_id: snag.site_id,
      currentAssignment: assignment,
    });
  };

  // ── Filtering ──
  const filteredJobs = () => {
    const source = activeTab === "my-jobs" ? jobs : assignedByMe;
    if (filter === "resolved") return source.filter((job) => job.status === "resolved");
    if (filter === "open") return source.filter((job) => job.status === "open");
    if (filter === "in_progress") return source.filter((job) => job.status === "in_progress");
    if (filter === "in_review") return source.filter((job) => job.status === "in_review");
    return source;
  };

  const currentSource = activeTab === "my-jobs" ? jobs : assignedByMe;
  const total = currentSource.length;
  const resolved = currentSource.filter((job) => job.status === "resolved").length;
  const openCount = currentSource.filter((job) => job.status === "open").length;
  const inProgressCount = currentSource.filter((job) => job.status === "in_progress").length;
  const inReviewCount = currentSource.filter((job) => job.status === "in_review").length;
  const displayJobs = filteredJobs();

  return (
    <div className="all-snags-page">
      {lightboxImage && <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}

      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-block">
          <div className="page-eyebrow">{activeTab === "my-jobs" ? "Your assignments" : "Assignments you created"}</div>
          <div className="page-title">Job <span>Zone</span></div>
          <div className="page-meta">
            {total} total &middot; {openCount} open &middot; {inProgressCount} in progress &middot; {inReviewCount} in review &middot; {resolved} resolved
          </div>
        </div>
        <div className="page-header-right">
          <button className="footer-btn" onClick={() => { fetchAssignedJobs(true); if (isAdmin()) fetchAssignedByMe(true); }} disabled={loading} style={{ padding: '8px 16px', fontSize: '12px' }}>
            <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            {loading ? "Loading\u2026" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      {isAdmin() && (
        <div className="filter-bar" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>
          <button
            className="footer-btn"
            onClick={() => { setActiveTab("my-jobs"); setFilter("all"); }}
            style={{
              background: activeTab === "my-jobs" ? 'var(--brand-black)' : 'var(--brand-white)',
              color: activeTab === "my-jobs" ? 'var(--brand-white)' : 'var(--ink-800)',
              borderColor: activeTab === "my-jobs" ? 'var(--brand-black)' : 'var(--rule)',
            }}
          >
            My Jobs
          </button>
          <button
            className="footer-btn"
            onClick={() => { setActiveTab("assigned-by-me"); setFilter("all"); }}
            style={{
              background: activeTab === "assigned-by-me" ? 'var(--brand-black)' : 'var(--brand-white)',
              color: activeTab === "assigned-by-me" ? 'var(--brand-white)' : 'var(--ink-800)',
              borderColor: activeTab === "assigned-by-me" ? 'var(--brand-black)' : 'var(--rule)',
            }}
          >
            Jobs I Assigned
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <span className="filter-label">Filter</span>
        {[
          { key: "all", label: `All (${total})` },
          { key: "open", label: `Open (${openCount})` },
          { key: "in_progress", label: `In Progress (${inProgressCount})` },
          { key: "in_review", label: `In Review (${inReviewCount})` },
          { key: "resolved", label: `Resolved (${resolved})` },
        ].map(f => (
          <button
            key={f.key}
            className="footer-btn"
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
            <div className="empty-state-title">Loading\u2026</div>
          </div>
        )}

        {!loading && displayJobs.length === 0 && (
          <div className="empty-state">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <div className="empty-state-title">
              {filter === "all" ? "No assigned jobs yet" : `No ${filter.replace('_', ' ')} jobs`}
            </div>
            <div className="empty-state-sub">
              {activeTab === "my-jobs" ? "Jobs assigned to you will appear here" : "Jobs you've assigned to others will appear here"}
            </div>
          </div>
        )}

        {!loading && displayJobs.map((job) => {
          const displayStatus = getAssignmentDisplayStatus(job.status);
          const isHighlighted = highlightId === job.assignment_id;

          if (activeTab === "my-jobs") {
            // AssigneeCard for "My Jobs"
            return (
              <AssigneeCard
                key={job.assignment_id}
                job={job}
                displayStatus={displayStatus}
                solutionText={solutionInputs[job.assignment_id] || ''}
                proofPreview={proofPreviews[job.assignment_id]}
                proofFileName={proofFiles[job.assignment_id]?.name}
                onSolutionChange={(text) => setSolutionInputs(prev => ({ ...prev, [job.assignment_id]: text }))}
                onProofChange={(file) => handleProofFileChange(job.assignment_id, file)}
                onSetDueDate={(assignmentId, date) => updateDueDate(assignmentId, date)}
                onSubmitProof={(assignmentId) => handleSubmitForReview(assignmentId)}
                isHighlighted={isHighlighted}
                uploadingProof={!!uploadingProof[job.assignment_id]}
                apiCall={apiCall}
                apiBase={API}
              />
            );
          }

          // AssignerCard for "Jobs I Assigned"
          // Build a snag-like object from the joined data
          const snagData = {
            id: job.snag_id,
            feedback: job.snag?.feedback,
            feedback_type: job.snag?.feedback_type,
            category: job.snag?.category,
            image_url: job.snag?.image_url,
            transcription: job.snag?.transcription,
            voice_url: null,
            site: job.site,
            site_id: job.site_id,
            reporter_name: job.site?.site_manager || '—',
            created_at: job.assigned_at,
            status: job.snag?.status || 'pending',
            suggestion: null,
          };

          const assignmentData = {
            assignment_id: job.assignment_id,
            username: job.assigned_username || 'Unknown',
            role: job.assigned_role || '',
            status: job.status,
            assigner_remarks: job.assigner_remarks || '',
            solution: job.solution || '',
            proof: job.proof || null,
            due_date: job.due_date || null,
            priority: job.priority || null,
            rejection_count: job.rejection_count || 0,
            rejection_remarks: job.rejection_remarks || '',
          };

          const snagDisplayStatus = deriveSnagDisplayStatus(snagData.status, [assignmentData]);

          return (
            <AssignerCard
              key={job.assignment_id}
              snag={snagData}
              assignment={assignmentData}
              displayStatus={snagDisplayStatus}
              onImageClick={setLightboxImage}
              onAssign={() => setAssignModalSnag({ id: job.snag_id, site_id: job.site_id })}
              onReassign={() => handleReassignClick(snagData, assignmentData)}
              onReject={() => setRejectModalAssignment(job.assignment_id)}
              onEscalate={() => setEscalateModalAssignment(job.assignment_id)}
              onClose={() => toggleTodo(job.snag_id, snagData.status)}
              isAdmin={true}
              isHighlighted={isHighlighted}
              viewMode="grid"
              getDueClass={getDueClass}
              formatDue={formatDue}
              apiCall={apiCall}
              apiBase={API}
            />
          );
        })}
      </div>

      {/* Action Modals (for Jobs I Assigned tab) */}
      <AssignModal
        isOpen={!!assignModalSnag}
        onClose={() => setAssignModalSnag(null)}
        snagId={assignModalSnag?.id}
        siteId={assignModalSnag?.site_id}
        currentAssignment={assignModalSnag?.currentAssignment}
        onAssigned={() => { invalidate(''); fetchAssignedByMe(true); fetchAssignedJobs(true); setAssignModalSnag(null); }}
      />
      <RejectModal
        isOpen={!!rejectModalAssignment}
        onClose={() => setRejectModalAssignment(null)}
        assignmentId={rejectModalAssignment}
        onRejected={() => { invalidate(''); fetchAssignedByMe(true); setRejectModalAssignment(null); }}
      />
      <EscalateModal
        isOpen={!!escalateModalAssignment}
        onClose={() => setEscalateModalAssignment(null)}
        assignmentId={escalateModalAssignment}
        onEscalated={() => { invalidate(''); fetchAssignedByMe(true); setEscalateModalAssignment(null); }}
      />
      <ReassignConfirmModal
        isOpen={!!reassignConfirm}
        onClose={() => setReassignConfirm(null)}
        currentAssigneeName={reassignConfirm?.assignment?.username}
        onConfirm={handleReassignConfirmed}
      />
    </div>
  );
}
