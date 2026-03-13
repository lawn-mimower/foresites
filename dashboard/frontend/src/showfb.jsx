import React, { useEffect, useState, useRef } from "react";
import { showToast } from "./Toast";
import { useAuth } from "./AuthContext";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { Lightbox } from "./components/Lightbox";
import { StatusPill, PriorityBadge, CategoryTag } from "./components/StatusBadge";
import {
  getPriority,
  formatSnagId,
  getCategoryVertical,
  formatCategory,
  deriveSnagDisplayStatus,
} from "./utils/snagHelpers";
import "./css/allfb.css";

// SVG icon strings for collapsible section headers
const ICON_DETAIL = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5z"/></svg>';
const ICON_AUDIO = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>';
const ICON_RESOLUTION = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>';
const ICON_ASSIGN = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

const SEARCH_CHIPS = [
  "Show all critical safety snags",
  "Which snags are overdue?",
  "Show snags pending review",
  "Open snags summary",
];

// Waveform bar heights for fake audio player
const WAVE_HEIGHTS = [30,50,70,40,80,60,90,45,70,55,80,65,35,75,50,85,40,60,70,50,40,65,80,30];

export function AllFeedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [sortBy, setSortBy] = useState("newest");
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ feedback: "", suggestion: "" });
  const [loadingReport, setLoadingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // View & filters
  const [viewMode, setViewMode] = useState("grid");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSite, setFilterSite] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  // Search
  const [aiSearchQuery, setAiSearchQuery] = useState("");
  const [aiSearchResult, setAiSearchResult] = useState("");
  const [aiSearching, setAiSearching] = useState(false);

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState(null);

  // Data
  const [sites, setSites] = useState([]);
  const [siteUsers, setSiteUsers] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({});
  const [assignedUsers, setAssignedUsers] = useState({});
  const [assigningId, setAssigningId] = useState(null);

  // Audio refs
  const audioRefs = useRef({});

  const { apiCall, isAdmin, user } = useAuth();
  const API = "http://localhost:9999/api";
  const BASE_URL = "http://localhost:9999";

  // ── Fetch assignable users (site-scoped if possible, otherwise all) ──
  const fetchSiteUsers = async () => {
    try {
      const url = user?.site_id
        ? `${API}/snag-assignments/site/${user.site_id}/users`
        : `${API}/snag-assignments/users/all`;
      const data = await apiCall(url);
      if (!data || data.error) { setSiteUsers([]); return; }
      setSiteUsers(Array.isArray(data) ? data : []);
    } catch (err) { setSiteUsers([]); }
  };

  // ── Fetch assignments (backend now joins username) ──
  const fetchAssignments = async () => {
    try {
      const data = await apiCall(`${API}/snag-assignments/assignments`);
      if (!data || data.error) return;
      const assignments = Array.isArray(data) ? data : [];
      const assignedBySnag = {};
      assignments.forEach((a) => {
        if (!assignedBySnag[a.snag_id]) assignedBySnag[a.snag_id] = [];
        assignedBySnag[a.snag_id].push({
          username: a.username || "Unknown",
          role: a.assigned_role || "",
          status: a.status,
          assigner_remarks: a.assigner_remarks || a.description || "",
          solution: a.solution || "",
          due_date: a.due_date || null,
        });
      });
      setAssignedUsers(assignedBySnag);
    } catch (err) { console.error("Error fetching assignments:", err); }
  };

  // ── Fetch feedbacks ──
  const fetchFeedbacks = async () => {
    try {
      setRefreshing(true);
      const data = await apiCall(`${API}/dashboard/feedbacks`);
      if (!data || data.error) return setFeedbacks([]);
      setFeedbacks(Array.isArray(data) ? data : []);

      // Fetch assignments (backend joins usernames) and site users for the assign dropdown
      fetchAssignments();
      fetchSiteUsers();
      showToast("Data refreshed", "success");
    } catch (err) {
      console.error("Error fetching feedbacks:", err);
      setFeedbacks([]);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchSites = async () => {
    try {
      const data = await apiCall(`${API}/sites`);
      if (Array.isArray(data)) setSites(data);
    } catch (err) { console.error("Error fetching sites:", err); }
  };

  useEffect(() => {
    fetchFeedbacks();
    fetchSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiCall]);

  // ── Assign snag ──
  const handleAssignSnag = async (snagId, snagSiteId) => {
    const selectedUserId = assignmentForm[`${snagId}_user`];
    const remarks = assignmentForm[`${snagId}_remarks`];
    const dueDate = assignmentForm[`${snagId}_due`];
    if (!selectedUserId) { showToast("Please select a team member", "warning"); return; }
    setAssigningId(snagId);
    try {
      const body = {
        snag_id: snagId,
        site_id: user?.site_id || snagSiteId,
        assigned_user_id: selectedUserId,
        assigner_remarks: remarks || "",
      };
      if (dueDate) body.due_date = new Date(dueDate).toISOString();

      const response = await apiCall(`${API}/snag-assignments/assignments`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (response && !response.error) {
        showToast("Task assigned!", "success");
        setAssignmentForm({ ...assignmentForm, [`${snagId}_user`]: "", [`${snagId}_remarks`]: "", [`${snagId}_due`]: "" });
        fetchAssignments();
      } else { showToast("Failed to assign", "error"); }
    } catch (err) { showToast("Error assigning task", "error"); }
    finally { setAssigningId(null); }
  };

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
    setTimeout(() => {
      handleAiSearch();
    }, 0);
  };

  // ── Report ──
  const downloadReport = async () => {
    try {
      setLoadingReport(true);
      const res = await fetch(`${BASE_URL}/api/report/generate-report`, { method: "GET" });
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

  // ── Toggle status ──
  const toggleTodo = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
      const response = await apiCall(`${API}/dashboard/feedbacks/${id}/resolve`, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
      if (response && response.updated) {
        setFeedbacks((prev) => prev.map((f) => (f.id === id ? response.updated : f)));
        showToast(newStatus === 'resolved' ? "Marked as resolved" : "Reopened", "success");
      }
    } catch (err) { showToast("Failed to update status", "error"); }
  };

  // ── Edit ──
  const editFeedback = (fb) => { setEditingId(fb.id); setEditValues({ feedback: fb.feedback || "", suggestion: fb.suggestion || "" }); };
  const saveEdit = async (id) => {
    try {
      const response = await apiCall(`${API}/dashboard/feedbacks/${id}`, { method: "PUT", body: JSON.stringify(editValues) });
      if (response && response.id) { setFeedbacks((prev) => prev.map((f) => (f.id === id ? response : f))); showToast("Updated", "success"); setEditingId(null); }
    } catch (err) { showToast("Failed to update", "error"); }
  };
  const deleteFeedback = async (id) => {
    try { await apiCall(`${API}/dashboard/feedbacks/${id}`, { method: "DELETE" }); setFeedbacks((prev) => prev.filter((f) => f && f.id !== id)); showToast("Deleted", "success"); }
    catch (err) { showToast("Failed to delete", "error"); }
  };

  // ── Audio playback ──
  const playAudio = (snagId) => {
    const audio = audioRefs.current[snagId];
    if (!audio) return;
    if (audio.paused) { audio.play(); } else { audio.pause(); }
  };

  // ── Filtering & Sorting ──
  let displayed = [...feedbacks].filter(f => f);

  if (filterStatus === "open") displayed = displayed.filter(f => f.status === 'pending' && !f.acknowledged_at);
  else if (filterStatus === "in_progress") displayed = displayed.filter(f => f.status === 'pending' && f.acknowledged_at);
  else if (filterStatus === "in_review") {
    displayed = displayed.filter(f => {
      const assignments = assignedUsers[f.id] || [];
      return assignments.some(a => a.status === 'in_review');
    });
  }
  else if (filterStatus === "closed") displayed = displayed.filter(f => f.status === 'resolved');

  if (filterCategory !== "all") displayed = displayed.filter(f => f.category === filterCategory);
  if (filterSite !== "all") displayed = displayed.filter(f => f.site?.site_name === filterSite);
  if (filterPriority !== "all") displayed = displayed.filter(f => getPriority(f.category) === filterPriority);

  if (sortBy === "resolved") displayed = displayed.filter(f => f.status === 'resolved');
  if (sortBy === "unresolved") displayed = displayed.filter(f => f.status === 'pending');
  displayed.sort((a, b) =>
    sortBy === "oldest" ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at)
  );

  const total = feedbacks.filter(f => f).length;
  const resolved = feedbacks.filter(f => f && f.status === 'resolved').length;
  const openCount = feedbacks.filter(f => f && f.status === 'pending').length;
  const criticalCount = feedbacks.filter(f => f && getPriority(f.category) === 'critical').length;
  const categories = [...new Set(feedbacks.filter(f => f && f.category).map(f => f.category))];

  // ── Due date helper ──
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

  // ── Get primary assignment for a snag ──
  const getPrimaryAssignment = (snagId) => {
    const assignments = assignedUsers[snagId] || [];
    return assignments[0] || null;
  };

  // ── Derive display status for a snag ──
  const getDisplayStatus = (fb) => {
    return deriveSnagDisplayStatus(fb.status, assignedUsers[fb.id] || []);
  };

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
          <button className="footer-btn" onClick={fetchFeedbacks} disabled={refreshing} style={{ padding: '8px 16px', fontSize: '12px' }}>
            <svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="footer-btn" onClick={downloadReport} disabled={loadingReport} style={{ padding: '8px 16px', fontSize: '12px' }}>
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5z"/></svg>
            {loadingReport ? "Generating…" : "Report"}
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
            {aiSearching ? "Searching…" : "Ask"}
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
        <select className="filter-sel" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="all">All Priorities</option>
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

      {/* ── CARDS GRID ── */}
      <div className={`cards-grid${viewMode === 'list' ? ' list-view' : ''}`}>
        {displayed.length === 0 && (
          <div className="empty-state">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            <div className="empty-state-title">No snags match your filters</div>
            <div className="empty-state-sub">Try adjusting the filters above or clear the search</div>
          </div>
        )}

        {displayed.map((fb) => {
          const priority = getPriority(fb.category);
          const vertical = getCategoryVertical(fb.category);
          const snagId = formatSnagId(fb.id);
          const displayStatus = getDisplayStatus(fb);
          const primaryAssignment = getPrimaryAssignment(fb.id);
          const assignments = assignedUsers[fb.id] || [];
          const hasAudio = fb.feedback_type === 'voice' && fb.voice_url;
          const hasImage = !!fb.image_url;

          // Solution badge logic
          const hasSolution = assignments.some(a => a.solution);
          const solutionBadge = hasSolution
            ? { text: 'Solution filed', cls: 'has-content' }
            : displayStatus === 'in_review'
            ? { text: 'Pending review', cls: 'pending' }
            : { text: 'Awaiting', cls: '' };

          // Audio badge
          const audioBadge = hasAudio
            ? { text: 'Recording available', cls: 'has-content' }
            : { text: 'No recording', cls: '' };

          // Assignment badge
          const assignBadge = primaryAssignment
            ? { text: primaryAssignment.username, cls: 'has-content' }
            : { text: 'Unassigned', cls: '' };

          // Due date from primary assignment
          const dueDate = primaryAssignment?.due_date || null;

          if (viewMode === 'list') {
            // ── LIST VIEW ROW ──
            return (
              <div key={fb.id} className={`snag-card priority-${priority}`}>
                <div className="card-accent" />
                <div className="card-body-list">
                  <div className="list-col list-col-id">
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-400)' }}>
                      <span style={{ color: 'var(--ink-600)', fontWeight: 500 }}>{snagId}</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-black)', marginTop: '2px', lineHeight: 1.3 }}>
                      {fb.feedback || (fb.feedback_type === "voice" ? "Voice Feedback" : "No feedback")}
                    </div>
                  </div>
                  <div className="list-col list-col-tags">
                    <CategoryTag category={fb.category} />
                    <PriorityBadge category={fb.category} />
                  </div>
                  <div className="list-col list-col-assign">
                    <div style={{ fontSize: '12px', fontWeight: 600, color: primaryAssignment ? 'var(--brand-black)' : 'var(--ink-400)' }}>
                      {primaryAssignment ? primaryAssignment.username : 'Unassigned'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{fb.site?.site_name || '—'}</div>
                  </div>
                  <div className="list-col list-col-due">
                    <div className={`due-cell ${getDueClass(dueDate)}`}>{formatDue(dueDate)}</div>
                  </div>
                  <div className="list-col list-col-actions" style={{ display: 'flex', gap: '4px' }}>
                    <StatusPill displayStatus={displayStatus} />
                  </div>
                </div>
              </div>
            );
          }

          // ── GRID VIEW CARD ──
          return (
            <div key={fb.id} className={`snag-card priority-${priority}`}>
              <div className="card-accent" />

              {/* Card Header */}
              <div className="card-header">
                <div className="card-header-left">
                  <div className="card-snag-id">
                    <span className="id-num">{snagId}</span>
                    <span className={`tag tag-${vertical}`}>{formatCategory(fb.category)}</span>
                  </div>
                  <div className="card-title">
                    {fb.feedback || (fb.feedback_type === "voice" ? "Voice Feedback" : "No feedback")}
                  </div>
                  <div className="card-meta-row">
                    <PriorityBadge category={fb.category} />
                    <span className="meta-dot">&middot;</span>
                    <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{fb.site?.site_name || '—'}</span>
                    <span className="meta-dot">&middot;</span>
                    <span style={{ fontSize: '11px', color: 'var(--ink-400)' }}>{fb.reporter_name || '—'}</span>
                  </div>
                </div>
                <div className="card-header-right">
                  <StatusPill displayStatus={displayStatus} />
                </div>
              </div>

              {/* Card Body */}
              <div className="card-body">

                {/* ── SNAG DETAIL SECTION ── */}
                <CollapsibleSection
                  title="Snag Detail"
                  icon={ICON_DETAIL}
                  badge={`Reported ${new Date(fb.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                  badgeClass="has-content"
                  defaultOpen={false}
                >
                  {/* Image */}
                  {hasImage ? (
                    <div className="snag-image-thumb" onClick={() => setLightboxImage(fb.image_url)}>
                      <img src={fb.image_url} alt="Snag" />
                      <span className="image-expand-hint">View full</span>
                    </div>
                  ) : (
                    <div className="snag-image-thumb">
                      <div className="snag-image-placeholder">
                        <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                        <span>No photo attached</span>
                      </div>
                    </div>
                  )}

                  {/* Detail Grid */}
                  <div className="snag-detail-grid">
                    <div>
                      <div className="detail-label">Site</div>
                      <div className="detail-value">{fb.site?.site_name || '—'}</div>
                    </div>
                    <div>
                      <div className="detail-label">Reporter</div>
                      <div className="detail-value">{fb.reporter_name || '—'}</div>
                    </div>
                    <div>
                      <div className="detail-label">Date Reported</div>
                      <div className="detail-value mono">{new Date(fb.created_at).toLocaleDateString('en-GB')}</div>
                    </div>
                    <div>
                      <div className="detail-label">Type</div>
                      <div className="detail-value">{fb.feedback_type || 'text'}</div>
                    </div>
                  </div>

                  {/* Inline edit */}
                  {editingId === fb.id && (
                    <div className="edit-inline">
                      <input
                        value={editValues.feedback}
                        onChange={(e) => setEditValues(v => ({ ...v, feedback: e.target.value }))}
                        placeholder="Feedback text"
                      />
                      <input
                        value={editValues.suggestion}
                        onChange={(e) => setEditValues(v => ({ ...v, suggestion: e.target.value }))}
                        placeholder="Suggestion"
                      />
                      <div className="edit-inline-btns">
                        <button className="footer-btn close-btn" onClick={() => saveEdit(fb.id)}>Save</button>
                        <button className="footer-btn" onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </CollapsibleSection>

                {/* ── AUDIO / TRANSCRIPTION SECTION ── */}
                <CollapsibleSection
                  title="Audio Report"
                  icon={ICON_AUDIO}
                  badge={audioBadge.text}
                  badgeClass={audioBadge.cls}
                >
                  {hasAudio ? (
                    <>
                      <div className="audio-player">
                        <button className="audio-play-btn" onClick={() => playAudio(fb.id)}>
                          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                        <div className="audio-waveform">
                          {WAVE_HEIGHTS.map((h, i) => (
                            <div key={i} className={`wave-bar${i < 8 ? ' played' : ''}`} style={{ height: `${h}%` }} />
                          ))}
                        </div>
                        <span className="audio-dur">—:——</span>
                      </div>
                      <audio ref={el => { audioRefs.current[fb.id] = el; }} src={fb.voice_url} preload="none" />
                      {fb.transcription ? (
                        <div className="transcription-box">{fb.transcription}</div>
                      ) : (
                        <div className="transcription-box none">Transcription processing…</div>
                      )}
                    </>
                  ) : (
                    <div className="audio-none">
                      <svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                      No audio recorded
                    </div>
                  )}
                </CollapsibleSection>

                {/* ── RESOLUTION SECTION ── */}
                <CollapsibleSection
                  title="Resolution"
                  icon={ICON_RESOLUTION}
                  badge={solutionBadge.text}
                  badgeClass={solutionBadge.cls}
                >
                  {/* Show solution if any assignment has one */}
                  {hasSolution ? (
                    <div className="solution-box">
                      <div className="solution-header">
                        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                        <span className="solution-header-label">Solution Delivered</span>
                      </div>
                      <div className="solution-text">
                        {assignments.find(a => a.solution)?.solution}
                      </div>
                      <div className="solution-submitted-by">
                        <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        Filed by {assignments.find(a => a.solution)?.username || 'Unknown'}
                      </div>
                    </div>
                  ) : fb.suggestion ? (
                    <>
                      <div className="suggestion-box">
                        <div className="suggestion-header">
                          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                          <span className="suggestion-header-label">Suggested Resolution</span>
                        </div>
                        <div className="suggestion-text">{fb.suggestion}</div>
                      </div>
                      <div className="no-solution">
                        <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                        Solution not yet filed by engineer
                      </div>
                    </>
                  ) : (
                    <div className="no-solution">
                      <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                      No solution or suggestion recorded yet
                    </div>
                  )}
                </CollapsibleSection>

                {/* ── ASSIGNMENT SECTION (visible to all) ── */}
                <CollapsibleSection
                  title="Assignment"
                  icon={ICON_ASSIGN}
                  badge={assignBadge.text}
                  badgeClass={assignBadge.cls}
                >
                  <div className="assignment-block">
                    {/* Current assignment display */}
                    {primaryAssignment ? (
                      <div className="assignment-current">
                        <div className="assign-avatar">
                          {primaryAssignment.username.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        <div className="assign-info">
                          <div className="assign-name">{primaryAssignment.username}</div>
                          <div className="assign-sub">{primaryAssignment.role || 'Team member'} &middot; {fb.site?.site_name || '—'}</div>
                        </div>
                        {dueDate && (
                          <div className="assign-eta">
                            <div className="assign-eta-label">Est. completion</div>
                            <span className={getDueClass(dueDate)}>{formatDue(dueDate)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="assignment-current">
                        <div className="assign-avatar unassigned">
                          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: '#9A9A9A' }}><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        </div>
                        <div className="assign-info">
                          <div className="assign-name unassigned">Unassigned</div>
                        </div>
                      </div>
                    )}

                    {/* Additional assignments */}
                    {assignments.length > 1 && assignments.slice(1).map((a, idx) => (
                      <div key={idx} className="assignment-current" style={{ marginTop: '4px' }}>
                        <div className="assign-avatar">
                          {a.username.split(' ').map(n => n[0]).join('').slice(0,2)}
                        </div>
                        <div className="assign-info">
                          <div className="assign-name">{a.username}</div>
                          <div className="assign-sub">{a.status}</div>
                        </div>
                      </div>
                    ))}

                    {/* Assign / reassign form */}
                    {siteUsers.length > 0 && (
                      <div className="assign-row" style={{ marginTop: '8px' }}>
                        <select
                          className="assign-select"
                          value={assignmentForm[`${fb.id}_user`] || ""}
                          onChange={(e) => setAssignmentForm({ ...assignmentForm, [`${fb.id}_user`]: e.target.value })}
                          disabled={assigningId === fb.id}
                        >
                          <option value="">— Assign to engineer —</option>
                          {siteUsers.map((u) => (
                            <option key={u.user_id} value={u.user_id}>{u.username}</option>
                          ))}
                        </select>
                        <button
                          className="assign-btn"
                          onClick={() => handleAssignSnag(fb.id, fb.site_id)}
                          disabled={assigningId === fb.id || !assignmentForm[`${fb.id}_user`]}
                        >
                          Assign
                        </button>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </div>

              {/* ── Card Footer ── */}
              <div className="card-footer">
                <div className="card-footer-meta">
                  {dueDate && (
                    <span className="footer-meta-item">
                      <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
                      Due <strong className={getDueClass(dueDate)}>{formatDue(dueDate)}</strong>
                    </span>
                  )}
                  <span className="footer-meta-item">
                    <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    <strong>{fb.site?.site_name || '—'}</strong>
                  </span>
                </div>
                <div className="card-footer-actions">
                  <button className="footer-btn flag-btn" onClick={() => showToast(`Escalation sent for ${snagId}`, 'success')}>
                    <svg viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>
                    Escalate
                  </button>
                  {displayStatus === 'in_review' && (
                    <button className="footer-btn close-btn" onClick={() => toggleTodo(fb.id, fb.status)}>
                      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                      Close Snag
                    </button>
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
