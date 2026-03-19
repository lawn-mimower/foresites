import React, { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { showToast } from "./Toast";
import { useAuth } from "./AuthContext";
import { API_BASE, BASE_URL } from "./config/api";
import { Lightbox } from "./components/Lightbox";
import AssignerCard from "./components/AssignerCard";
import AssignModal from "./components/AssignModal";
import RejectModal from "./components/RejectModal";
import EscalateModal from "./components/EscalateModal";
import ReassignConfirmModal from "./components/ReassignConfirmModal";
import { StatusPill, CategoryTag, ImpactBadge } from "./components/StatusBadge";
import {
  getImpact,
  formatCategory,
  formatSnagId,
  deriveSnagDisplayStatus,
} from "./utils/snagHelpers";
import { cachedFetch, invalidate } from "./utils/dataCache";
import { useDataFreshness } from "./hooks/useDataFreshness";
import "./css/allfb.css";

const SEARCH_CHIPS = [
  "Show all critical safety snags",
  "Which snags are overdue?",
  "Show snags pending review",
  "Open snags summary",
];

export function AllFeedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  // eslint-disable-next-line no-unused-vars
  const [editingId, setEditingId] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [editValues, setEditValues] = useState({ feedback: "", suggestion: "" });
  const [loadingReport, setLoadingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // View & filters
  const [viewMode, setViewMode] = useState("grid");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSite, setFilterSite] = useState("all");
  const [filterImpact, setFilterImpact] = useState("all");

  // Search
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchResult, setAiSearchResult] = useState("");
  const [aiSearching, setAiSearching] = useState(false);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState(null);

  // Data
  const [sites, setSites] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState({});

  // Highlight snag navigated from dashboard
  const location = useLocation();
  const [highlightId] = useState(location.state?.highlightSnagId || null);

  // Action modals
  const [assignModalSnag, setAssignModalSnag] = useState(null);
  const [rejectModalAssignment, setRejectModalAssignment] = useState(null);
  const [escalateModalAssignment, setEscalateModalAssignment] = useState(null);
  const [reassignConfirm, setReassignConfirm] = useState(null); // { snag, assignment }
  const [detailModalSnag, setDetailModalSnag] = useState(null);

  const { apiCall, isAdmin, user } = useAuth();
  const API = API_BASE;
  const BASE = BASE_URL;

  // ── Fetch all data in parallel + cache ──
  const fetchAllData = async (bustCache = false) => {
    try {
      setRefreshing(true);
      if (bustCache) {
        invalidate(''); // bust all caches
      }
      const [fbData, assignData, sitesData] = await Promise.all([
        cachedFetch('feedbacks', () => apiCall(`${API}/dashboard/feedbacks`)),
        cachedFetch('assignments', () => apiCall(`${API}/snag-assignments/assignments`)),
        cachedFetch('sites', () => apiCall(`${API}/sites`), 120_000),
      ]);

      if (!fbData || fbData.error) setFeedbacks([]);
      else setFeedbacks(Array.isArray(fbData) ? fbData : []);

      if (assignData && !assignData.error) {
        const assignments = Array.isArray(assignData) ? assignData : [];
        const assignedBySnag = {};
        assignments.forEach((a) => {
          if (!assignedBySnag[a.snag_id]) assignedBySnag[a.snag_id] = [];
          assignedBySnag[a.snag_id].push({
            assignment_id: a.assignment_id,
            username: a.username || "Unknown",
            role: a.assigned_role || "",
            status: a.status,
            assigner_remarks: a.assigner_remarks || a.description || "",
            solution: a.solution || "",
            proof: a.proof || null,
            due_date: a.due_date || null,
            priority: a.priority || null,
            rejection_count: a.rejection_count || 0,
            rejection_remarks: a.rejection_remarks || "",
          });
        });
        setAssignedUsers(assignedBySnag);
      }

      if (Array.isArray(sitesData)) setSites(sitesData);

      if (bustCache) showToast("Data refreshed", "success");
    } catch (err) {
      console.error("Error fetching data:", err);
      setFeedbacks([]);
    } finally {
      setRefreshing(false);
    }
  };

  // Keep fetchAssignments for modal callbacks
  const fetchAssignments = async () => {
    invalidate(''); // bust all caches (assignments, myJobs, assignedByMe, metrics, etc.)
    try {
      const data = await apiCall(`${API}/snag-assignments/assignments`);
      if (!data || data.error) return;
      const assignments = Array.isArray(data) ? data : [];
      const assignedBySnag = {};
      assignments.forEach((a) => {
        if (!assignedBySnag[a.snag_id]) assignedBySnag[a.snag_id] = [];
        assignedBySnag[a.snag_id].push({
          assignment_id: a.assignment_id,
          username: a.username || "Unknown",
          role: a.assigned_role || "",
          status: a.status,
          assigner_remarks: a.assigner_remarks || a.description || "",
          solution: a.solution || "",
          proof: a.proof || null,
          due_date: a.due_date || null,
          priority: a.priority || null,
          rejection_count: a.rejection_count || 0,
          rejection_remarks: a.rejection_remarks || "",
        });
      });
      setAssignedUsers(assignedBySnag);
    } catch (err) { console.error("Error fetching assignments:", err); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onRefreshForFreshness = useCallback(() => fetchAllData(true), [apiCall]);
  useDataFreshness(onRefreshForFreshness);

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiCall]);

  // Scroll to highlighted snag once feedbacks load
  useEffect(() => {
    if (!highlightId || feedbacks.length === 0) return;
    const el = document.getElementById(`snag-card-${highlightId}`);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [highlightId, feedbacks]);

  // ── AI Search ──
  function beautifyResponse(text) {
    if (!text) return "";
    text = text.replace(/([a-z])_([a-z])/gi, (m, a, b) => a + " " + b.toUpperCase());
    text = text.replace(/\*\s+/g, "• ");
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.*?)\*:/g, "<h4>$1</h4>");
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
    text = text.replace(/\n+/g, "<br/>");
    return text;
  }

  const handleAiSearch = async () => {
    const q = aiSearchQuery.trim();
    if (!q) return;
    setAiSearching(true);
    setAiSearchResult("");
    try {
      const data = await apiCall(`${API}/chat/message`, {
        method: "POST",
        body: JSON.stringify({ message: q }),
      });
      const text = data?.response || data?.reply || data?.error || "No response.";
      setAiSearchResult(beautifyResponse(text));
    } catch (err) {
      setAiSearchResult("Search failed. Please try again.");
    } finally { setAiSearching(false); }
  };

  const applyChip = (q) => {
    setAiSearchQuery(q);
    setTimeout(() => handleAiSearch(), 0);
  };

  // ── Report ──
  const downloadReport = async () => {
    try {
      setLoadingReport(true);
      const res = await fetch(`${BASE}/api/report/generate-report`, { method: "GET" });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "construction_site_report.pdf";
      document.body.appendChild(link); link.click(); link.remove();
      showToast("Report generated!", "success");
    } catch (err) { showToast("Failed to generate report", "error"); }
    finally { setLoadingReport(false); }
  };

  // ── Toggle status (close/reopen) ──
  const toggleTodo = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
      const response = await apiCall(`${API}/dashboard/feedbacks/${id}/resolve`, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
      if (response && response.updated) {
        invalidate(''); // bust all caches so Job Zone + Dashboard stay in sync
        setFeedbacks((prev) => prev.map((f) => (f.id === id ? response.updated : f)));
        showToast(newStatus === 'resolved' ? "Marked as resolved" : "Reopened", "success");

        if (newStatus === 'resolved') {
          const primaryAssignment = getPrimaryAssignment(id);
          if (primaryAssignment?.assignment_id) {
            apiCall(`${API}/snag-assignments/notify`, {
              method: 'POST',
              body: JSON.stringify({ assignment_id: primaryAssignment.assignment_id, type: 'approve' }),
            }).catch(() => {});
          }
        }
      }
    } catch (err) { showToast("Failed to update status", "error"); }
  };

  // ── Helpers ──
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

  const getPrimaryAssignment = (snagId) => {
    const assignments = assignedUsers[snagId] || [];
    return assignments[0] || null;
  };

  const getDisplayStatus = (fb) => {
    return deriveSnagDisplayStatus(fb.status, assignedUsers[fb.id] || []);
  };

  // ── Reassign flow ──
  const handleReassignClick = (snag, assignment) => {
    setReassignConfirm({ snag, assignment });
  };

  const handleReassignConfirmed = () => {
    const { snag, assignment } = reassignConfirm;
    setReassignConfirm(null);
    setAssignModalSnag({
      id: snag.id,
      site_id: snag.site_id || user?.site_id,
      currentAssignment: assignment,
    });
  };

  // ── Filtering & Sorting ──
  let displayed = [...feedbacks].filter(f => f);

  if (filterStatus !== "all") {
    displayed = displayed.filter(f => {
      const ds = deriveSnagDisplayStatus(f.status, assignedUsers[f.id] || []);
      if (filterStatus === "open") return ds === 'open';
      if (filterStatus === "in_progress") return ds === 'in_progress';
      if (filterStatus === "in_review") return ds === 'in_review';
      if (filterStatus === "closed") return ds === 'closed';
      return true;
    });
  }

  if (filterCategory !== "all") displayed = displayed.filter(f => f.category === filterCategory);
  if (filterSite !== "all") displayed = displayed.filter(f => f.site?.site_name === filterSite);
  if (filterImpact !== "all") displayed = displayed.filter(f => getImpact(f.category) === filterImpact);

  if (sortBy === "resolved") displayed = displayed.filter(f => f.status === 'resolved');
  if (sortBy === "unresolved") displayed = displayed.filter(f => f.status === 'pending');
  displayed.sort((a, b) =>
    sortBy === "oldest" ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at)
  );

  const openCount = feedbacks.filter(f => f && f.status === 'pending').length;
  const criticalCount = feedbacks.filter(f => f && getImpact(f.category) === 'critical').length;
  const categories = [...new Set(feedbacks.filter(f => f && f.category).map(f => f.category))];

  // ── RENDER ──
  return (
    <div className="all-snags-page">
      {lightboxImage && <Lightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}

      {/* ── PAGE HEADER ── */}
      <div className="page-header">
        <div className="page-title-block">
          <div className="page-eyebrow">Site-wide record</div>
          <div className="page-title">All <span>Snags</span></div>
          <div className="page-meta">
            {displayed.length} snags displayed &middot; {openCount} open &middot; {criticalCount} critical
          </div>
        </div>
        <div className="page-header-right">
          <button className="footer-btn" onClick={() => fetchAllData(true)} disabled={refreshing} style={{ padding: '8px 16px', fontSize: '12px' }}>
            <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            {refreshing ? <><span className="btn-spinner btn-spinner--sm" /> Refreshing</> : "Refresh"}
          </button>
          <button className="footer-btn" onClick={downloadReport} disabled={loadingReport} style={{ padding: '8px 16px', fontSize: '12px' }}>
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>
            {loadingReport ? <><span className="btn-spinner btn-spinner--sm" /> Generating</> : "Report"}
          </button>
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div className="search-section">
        <div className="search-bar-wrapper">
          <div className="search-prefix">
            <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          </div>
          <input
            className="search-input"
            type="text"
            value={aiSearchQuery}
            onChange={(e) => setAiSearchQuery(e.target.value)}
            placeholder="Ask anything — 'Show me overdue safety snags' or 'What was reported last week?'"
            onKeyDown={(e) => e.key === 'Enter' && handleAiSearch()}
          />
          <button className="search-submit" onClick={handleAiSearch} disabled={aiSearching}>
            {aiSearching ? <><span className="btn-spinner btn-spinner--sm" /> Searching</> : "Ask"}
          </button>
        </div>
        <div className="search-chips">
          <span className="chips-label">Try:</span>
          {SEARCH_CHIPS.map((chip, i) => (
            <span key={i} className="chip" onClick={() => applyChip(chip)}>{chip}</span>
          ))}
        </div>
        {aiSearchResult && (
          <div className="search-answer">
            <div className="answer-tag">Response</div>
            <div className="answer-body" dangerouslySetInnerHTML={{ __html: aiSearchResult }} />
          </div>
        )}
      </div>

      {/* ── FILTER BAR ── */}
      <div className="filter-bar">
        <span className="filter-label">Filter</span>
        <select className="filter-sel" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="closed">Closed</option>
        </select>
        <select className="filter-sel" value={filterImpact} onChange={(e) => setFilterImpact(e.target.value)}>
          <option value="all">All Impact</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="filter-sel" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
        </select>
        <select className="filter-sel" value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
          <option value="all">All Sites</option>
          {sites.map(s => <option key={s.id} value={s.site_name}>{s.site_name}</option>)}
        </select>
        <select className="filter-sel" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>
        <div className="filter-divider" />
        <div className="view-toggle">
          <button className={`view-opt${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">
            <svg viewBox="0 0 24 24"><path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/></svg>
          </button>
          <button className={`view-opt${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')} title="List view">
            <svg viewBox="0 0 24 24"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
          </button>
        </div>
        <div className="results-count">{displayed.length} snag{displayed.length !== 1 ? 's' : ''}</div>
      </div>

      {/* ── CARDS / LIST ── */}
      {viewMode === 'list' ? (
        <div className="snag-list-wrap">
          <table className="snag-list-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Description</th>
                <th>Category</th>
                <th>Impact</th>
                <th>Assigned To</th>
                <th>Site</th>
                <th>Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-400)' }}>No snags match your filters</td></tr>
              )}
              {displayed.map((fb) => {
                const displayStatus = getDisplayStatus(fb);
                const primaryAssignment = getPrimaryAssignment(fb.id);
                const dueDate = primaryAssignment?.due_date;
                return (
                  <tr key={fb.id} onClick={() => setDetailModalSnag(fb)} style={{ cursor: 'pointer' }}>
                    <td className="list-snag-id">{formatSnagId(fb.id)}</td>
                    <td><div className="list-snag-title">{fb.feedback || (fb.feedback_type === 'voice' ? 'Voice Feedback' : 'No feedback')}</div></td>
                    <td><CategoryTag category={fb.category} /></td>
                    <td><ImpactBadge category={fb.category} /></td>
                    <td style={{ fontSize: 13 }}>{primaryAssignment?.username || 'Unassigned'}</td>
                    <td style={{ fontSize: 12, color: 'var(--ink-400)' }}>{fb.site?.site_name || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <span className={getDueClass(dueDate)}>{formatDue(dueDate)}</span>
                    </td>
                    <td><StatusPill displayStatus={displayStatus} /></td>
                    <td><span className="ss-view-all">View &rarr;</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cards-grid">
          {displayed.length === 0 && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              <div className="empty-state-title">No snags match your filters</div>
              <div className="empty-state-sub">Try adjusting the filters above or clear the search</div>
            </div>
          )}

          {displayed.map((fb) => {
            const displayStatus = getDisplayStatus(fb);
            const primaryAssignment = getPrimaryAssignment(fb.id);

            return (
              <AssignerCard
                key={fb.id}
                snag={fb}
                assignment={primaryAssignment}
                displayStatus={displayStatus}
                onImageClick={setLightboxImage}
                onAssign={() => setAssignModalSnag({ id: fb.id, site_id: fb.site_id || user?.site_id })}
                onReassign={() => handleReassignClick(fb, primaryAssignment)}
                onReject={() => setRejectModalAssignment(primaryAssignment?.assignment_id)}
                onEscalate={() => setEscalateModalAssignment(primaryAssignment?.assignment_id)}
                onClose={() => toggleTodo(fb.id, fb.status)}
                isAdmin={isAdmin()}
                isHighlighted={highlightId === fb.id}
                viewMode="grid"
                getDueClass={getDueClass}
                formatDue={formatDue}
                apiCall={apiCall}
                apiBase={API}
              />
            );
          })}
        </div>
      )}

      {/* Snag Detail Modal (from list view click) */}
      {detailModalSnag && (
        <div className="snag-detail-overlay" onClick={(e) => e.target === e.currentTarget && setDetailModalSnag(null)}>
          <div className="snag-detail-modal">
            <button className="snag-detail-close" onClick={() => setDetailModalSnag(null)}>&times;</button>
            <AssignerCard
              snag={detailModalSnag}
              assignment={getPrimaryAssignment(detailModalSnag.id)}
              displayStatus={getDisplayStatus(detailModalSnag)}
              onImageClick={setLightboxImage}
              onAssign={() => { setAssignModalSnag({ id: detailModalSnag.id, site_id: detailModalSnag.site_id || user?.site_id }); setDetailModalSnag(null); }}
              onReassign={() => { handleReassignClick(detailModalSnag, getPrimaryAssignment(detailModalSnag.id)); setDetailModalSnag(null); }}
              onReject={() => { setRejectModalAssignment(getPrimaryAssignment(detailModalSnag.id)?.assignment_id); setDetailModalSnag(null); }}
              onEscalate={() => { setEscalateModalAssignment(getPrimaryAssignment(detailModalSnag.id)?.assignment_id); setDetailModalSnag(null); }}
              onClose={() => { toggleTodo(detailModalSnag.id, detailModalSnag.status); setDetailModalSnag(null); }}
              isAdmin={isAdmin()}
              viewMode="grid"
              getDueClass={getDueClass}
              formatDue={formatDue}
              apiCall={apiCall}
              apiBase={API}
            />
          </div>
        </div>
      )}

      {/* Action Modals */}
      <AssignModal
        isOpen={!!assignModalSnag}
        onClose={() => setAssignModalSnag(null)}
        snagId={assignModalSnag?.id}
        siteId={assignModalSnag?.site_id}
        currentAssignment={assignModalSnag?.currentAssignment}
        onAssigned={() => { fetchAllData(true); setAssignModalSnag(null); }}
      />
      <RejectModal
        isOpen={!!rejectModalAssignment}
        onClose={() => setRejectModalAssignment(null)}
        assignmentId={rejectModalAssignment}
        onRejected={() => { fetchAllData(true); setRejectModalAssignment(null); }}
      />
      <EscalateModal
        isOpen={!!escalateModalAssignment}
        onClose={() => setEscalateModalAssignment(null)}
        assignmentId={escalateModalAssignment}
        onEscalated={() => { fetchAllData(true); setEscalateModalAssignment(null); }}
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
