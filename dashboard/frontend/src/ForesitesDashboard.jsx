import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import { StatusPill, CategoryTag, RevisionTag } from "./components/StatusBadge";
import AssignModal from "./components/AssignModal";
import {
  formatSnagId,
  formatCategory,
  getCategoryVertical,
  getPriority,
  deriveSnagDisplayStatus,
  getGreeting,
} from "./utils/snagHelpers";
import { cachedFetch, invalidate } from "./utils/dataCache";
import "./css/dashboard.css";

const API = "http://localhost:9999/api";

/* ─── SVG ICONS ──────────────────────────────────────────── */
const IconSearch = () => <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>;
const IconWarn = () => <svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>;
const IconCheck = () => <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>;
const IconPlus = () => <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>;

const VERTICALS = [
  { key: "safety", catMatch: "safety", label: "Safety",
    icon: <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l5 2.18V11c0 3.5-2.33 6.79-5 7.93-2.67-1.14-5-4.43-5-7.93V7.18L12 5zm-1 10h2v2h-2zm0-8h2v6h-2z"/></svg> },
  { key: "design", catMatch: "design", label: "Design",
    icon: <svg viewBox="0 0 24 24"><path d="M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41zM7 14a3 3 0 0 0-3 3 1 1 0 0 1-1 1 1 1 0 0 0 0 2 3 3 0 0 0 3-3 1 1 0 0 1 1-1 1 1 0 0 0 0-2z"/></svg> },
  { key: "inventory", catMatch: "resource", label: "Inventory",
    icon: <svg viewBox="0 0 24 24"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg> },
  { key: "quality", catMatch: "workflow", label: "Quality",
    icon: <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> },
];

const SEARCH_CHIPS = [
  "Which snags are overdue this week?",
  "Show me all critical safety issues",
  "What did the team complete yesterday?",
  "Who has the highest open snag count?",
];

/* ─── SPARKLINE ──────────────────────────────────────────── */
function Sparkline({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div className="ss-sparkline">
      {data.map((v, i) => {
        const pct = Math.round((v / max) * 100);
        const barCls = i === data.length - 1 ? "last" : v > max * 0.7 ? "hi" : "";
        return <div key={i} className={`ss-spark ${barCls}`} style={{ height: `${pct}%` }} />;
      })}
    </div>
  );
}

/* ─── ANIMATED COUNTER ───────────────────────────────────── */
function useAnimatedCount(target) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let cur = 0;
    const steps = 20, interval = 600 / steps, inc = target / steps;
    const t = setInterval(() => {
      cur = Math.min(cur + inc, target);
      setVal(Math.round(cur));
      if (cur >= target) clearInterval(t);
    }, interval);
    return () => clearInterval(t);
  }, [target]);
  return val;
}

/* ─── METRIC CARD ────────────────────────────────────────── */
function MetricCard({ accentCls, label, value, unit, desc, sparkData }) {
  const animated = useAnimatedCount(value);
  return (
    <div className={`ss-mcard ${accentCls}`}>
      <div className="ss-mcard-top">
        <div className="ss-mlabel">{label}</div>
      </div>
      <div className="ss-mvalue">
        {animated}{unit && <span className="ss-munit">{unit}</span>}
      </div>
      <div className="ss-mdesc">{desc}</div>
      {sparkData && <Sparkline data={sparkData} />}
    </div>
  );
}

/* ─── RAISE SNAG MODAL ───────────────────────────────────── */
function RaiseModal({ onClose, onSubmit, siteUsers, sites, userSiteId }) {
  const [form, setForm] = useState({
    feedback: "", category: "safety_compliance", site_id: userSiteId || "",
    feedback_type: "text",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="ss-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ss-modal">
        <div className="ss-modal-head">
          <div className="ss-modal-title">Raise New Snag</div>
          <button className="ss-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="ss-modal-body">
          <div className="ss-mfield">
            <label>Snag Description</label>
            <textarea value={form.feedback} onChange={(e) => set("feedback", e.target.value)} placeholder="Describe the issue in detail..." />
          </div>
          <div className="ss-mrow">
            <div className="ss-mfield">
              <label>Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                <option value="safety_compliance">Safety Compliance</option>
                <option value="design_quality">Design Quality</option>
                <option value="resource_availability">Resource Availability</option>
                <option value="workflow_efficiency">Workflow Efficiency</option>
              </select>
            </div>
            <div className="ss-mfield">
              <label>Site</label>
              <select value={form.site_id} onChange={(e) => set("site_id", e.target.value)}>
                <option value="">— Select site —</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="ss-modal-foot">
          <button className="ss-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="ss-btn-confirm" onClick={() => onSubmit(form)} disabled={!form.feedback.trim() || !form.site_id}>
            Raise Snag
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function ForesitesDashboard() {
  const { user, apiCall, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  // Data
  const [metrics, setMetrics] = useState(null);
  const [snags, setSnags] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [sites, setSites] = useState([]);
  const [siteUsers, setSiteUsers] = useState([]);

  // UI state
  const [selectedSiteId, setSelectedSiteId] = useState(user?.site_id || "");
  const [activeVertical, setActiveV] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [searchAnswer, setSearchAnswer] = useState(null);
  const [searching, setSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalSnag, setAssignModalSnag] = useState(null);
  const [time, setTime] = useState(new Date());
  const [syncTime, setSyncTime] = useState("");

  const isSuperAdminUser = isSuperAdmin?.() ?? false;
  const isAdminUser = isAdmin?.() ?? false;
  const effectiveSiteId = isSuperAdminUser ? selectedSiteId : (user?.site_id || "");

  /* Clock */
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Sync label */
  useEffect(() => {
    setSyncTime("Last sync: " + new Date().toLocaleTimeString());
    const t = setInterval(() => setSyncTime("Last sync: " + new Date().toLocaleTimeString()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ── Fetch all dashboard data in parallel + cache ── */
  const fetchData = useCallback(async () => {
    try {
      const qs = effectiveSiteId ? `?site_id=${effectiveSiteId}` : "";
      const siteId = effectiveSiteId || user?.site_id;

      // Fire ALL requests in parallel — no sequential waits
      const [metricsData, snagsData, assignData, sitesData, usersData] = await Promise.all([
        cachedFetch(`metrics_${effectiveSiteId}`, () => apiCall(`${API}/dashboard/dashboard-metrics${qs}`)),
        cachedFetch('feedbacks', () => apiCall(`${API}/dashboard/feedbacks`)),
        cachedFetch('assignments', () => apiCall(`${API}/snag-assignments/assignments`)),
        cachedFetch('sites', () => apiCall(`${API}/sites`), 120_000), // sites rarely change — 2min TTL
        siteId
          ? cachedFetch(`siteUsers_${siteId}`, () => apiCall(`${API}/snag-assignments/site/${siteId}/users`), 60_000)
          : Promise.resolve([]),
      ]);

      if (metricsData && !metricsData.error) setMetrics(metricsData);
      if (Array.isArray(snagsData)) setSnags(snagsData);
      if (Array.isArray(sitesData)) setSites(sitesData);
      if (Array.isArray(usersData)) setSiteUsers(usersData);

      if (Array.isArray(assignData)) {
        const bySnag = {};
        assignData.forEach(a => {
          if (!bySnag[a.snag_id]) bySnag[a.snag_id] = [];
          bySnag[a.snag_id].push({
            assignment_id: a.assignment_id,
            username: a.username || "Unknown",
            role: a.assigned_role || "",
            status: a.status,
            due_date: a.due_date,
            rejection_count: a.rejection_count || 0,
            rejection_remarks: a.rejection_remarks || "",
          });
        });
        setAssignments(bySnag);
      }

      setSyncTime("Last sync: " + new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  }, [apiCall, effectiveSiteId, user?.site_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── AI Search ── */
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

  const handleSearch = async () => {
    const q = searchQ.trim();
    if (!q) return;
    setSearching(true);
    setSearchAnswer(null);
    try {
      const data = await apiCall(`${API}/chat/message`, {
        method: "POST",
        body: JSON.stringify({ message: q }),
      });
      const text = data?.response || data?.reply || data?.error || "No response.";
      setSearchAnswer(beautifyResponse(text));
    } catch {
      setSearchAnswer("Search failed. Please try again.");
    } finally { setSearching(false); }
  };

  /* ── Raise snag ── */
  const handleRaiseSnag = async (form) => {
    try {
      const res = await apiCall(`${API}/dashboard/feedbacks`, {
        method: "POST",
        body: JSON.stringify({ ...form, status: "pending", reporter_name: user?.username }),
      });
      if (res && !res.error) {
        showToast("Snag raised successfully!", "success");
        setModalOpen(false);
        invalidate('feedbacks');
        invalidate('metrics');
        invalidate('assignments');
        fetchData();
      } else {
        showToast(res?.error || "Failed to raise snag", "error");
      }
    } catch { showToast("Error raising snag", "error"); }
  };

  /* ── Filtered table data ── */
  let displayedSnags = [...snags].filter(s => s);
  // Site filter
  if (effectiveSiteId) {
    displayedSnags = displayedSnags.filter(s => String(s.site_id) === String(effectiveSiteId));
  }
  // Vertical filter
  if (activeVertical !== "all") {
    displayedSnags = displayedSnags.filter(s => getCategoryVertical(s.category) === activeVertical);
  }
  // Limit to 10 for dashboard
  const tableSnags = displayedSnags.slice(0, 10);

  /* ── Category counts from metrics ── */
  const getCategoryCount = (verticalKey) => {
    if (!metrics?.category_counts) return 0;
    const counts = metrics.category_counts;
    return Object.entries(counts).reduce((sum, [cat, count]) => {
      if (getCategoryVertical(cat) === verticalKey) return sum + count;
      return sum;
    }, 0);
  };

  const getCriticalCount = (verticalKey) => {
    return displayedSnags.filter(s =>
      getCategoryVertical(s.category) === verticalKey && getPriority(s.category) === "critical" && s.status !== "resolved"
    ).length;
  };

  /* ── Site name for context ── */
  const siteName = effectiveSiteId
    ? sites.find(s => String(s.id) === String(effectiveSiteId))?.site_name || ""
    : "All Sites";

  const totalOpen = displayedSnags.filter(s => s.status !== "resolved").length;
  const wDate = time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const wTime = time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  /* ─── RENDER ───────────────────────────────────────────── */
  return (
    <div className="ss-main">

      {/* Welcome */}
      <div className="ss-welcome">
        <div>
          <div className="ss-welcome-greeting">{getGreeting()}</div>
          <div className="ss-welcome-name">
            Welcome, <span className="ss-welcome-accent">{user?.username || "User"}</span>
          </div>
          <div className="ss-welcome-ctx">
            {user?.role || "Team member"} &nbsp;&middot;&nbsp; {siteName} &nbsp;&middot;&nbsp; {totalOpen} active snags
          </div>
        </div>
        <div className="ss-welcome-right">
          <div className="ss-wdate">{wDate}</div>
          <div className="ss-wtime">{wTime}</div>
        </div>
      </div>

      {/* AI Search */}
      <div className="ss-search">
        <div className="ss-search-bar">
          <div className="ss-search-prefix"><IconSearch /></div>
          <input
            className="ss-search-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Ask anything — e.g. 'What safety issues are unresolved?'"
          />
          <button className="ss-search-btn" onClick={handleSearch} disabled={searching}>
            {searching ? <><span className="btn-spinner btn-spinner--sm" /> Searching</> : "Ask"}
          </button>
        </div>
        <div className="ss-chips">
          <span className="ss-chips-label">Try:</span>
          {SEARCH_CHIPS.map((q) => (
            <span key={q} className="ss-chip" onClick={() => { setSearchQ(q); setTimeout(handleSearch, 0); }}>{q}</span>
          ))}
        </div>
        {searchAnswer && (
          <div className="ss-answer">
            <div className="ss-answer-tag">Response</div>
            <div className="ss-answer-body" dangerouslySetInnerHTML={{ __html: searchAnswer }} />
          </div>
        )}
      </div>

      {/* Site picker (Super Admin only) */}
      {isSuperAdminUser && (
        <div className="ss-site-picker">
          <label>Site</label>
          <select value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)}>
            <option value="">All Sites</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.site_name}</option>)}
          </select>
        </div>
      )}

      {/* Vertical Cards */}
      <div className="ss-verticals">
        {VERTICALS.map(v => {
          const count = getCategoryCount(v.key);
          const critCount = getCriticalCount(v.key);
          return (
            <div
              key={v.key}
              className={`ss-vcard ${activeVertical === v.key ? "active" : ""}`}
              onClick={() => setActiveV(activeVertical === v.key ? "all" : v.key)}
            >
              <div className="ss-vcard-top" />
              <div className="ss-vcard-body">
                <div className="ss-vcard-icon-row">
                  <div className="ss-vcard-icon">{v.icon}</div>
                  {critCount > 0 ? (
                    <div className="ss-vcrit"><IconWarn />{critCount} Critical</div>
                  ) : (
                    <div className="ss-vcrit none"><IconCheck />0 Critical</div>
                  )}
                </div>
                <div className="ss-vname">{v.label}</div>
                <div className="ss-vcount">{count}</div>
                <div className="ss-vsub">open snags</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Metrics */}
      <div className="ss-metrics-hd">
        <div className="ss-section-title">Live Performance — Last 24 Hours</div>
        <div className="ss-sync">{syncTime}</div>
      </div>
      <div className="ss-metrics">
        <MetricCard
          accentCls="m-red" label="Snags Reported" value={metrics?.reported_24h || 0}
          desc="New snags logged in the last 24 hrs"
          sparkData={metrics?.sparklines?.reported || [0,0,0,0,0,0,0]}
        />
        <MetricCard
          accentCls="m-green" label="Snags Completed" value={metrics?.completed_24h || 0}
          desc="Reviewed and closed in last 24 hrs"
          sparkData={metrics?.sparklines?.completed || [0,0,0,0,0,0,0]}
        />
        <MetricCard
          accentCls="m-amber" label="Due Today" value={metrics?.due_today || 0}
          desc="Deadlines expiring today"
          sparkData={metrics?.sparklines?.due || [0,0,0,0,0,0,0]}
        />
        <MetricCard
          accentCls="m-black" label="Overdue" value={metrics?.overdue || 0}
          desc="Past due and unresolved"
          sparkData={metrics?.sparklines?.overdue || [0,0,0,0,0,0,0]}
        />
      </div>

      {/* Snag Table */}
      <div className="ss-tbl-hd">
        <div className="ss-section-title">
          Recent Snags {siteName ? `— ${siteName}` : ""}
        </div>
        <div className="ss-tbl-actions">
          {isAdminUser && (
            <button className="ss-btn-raise" onClick={() => setModalOpen(true)}>
              <IconPlus />Raise Snag
            </button>
          )}
        </div>
      </div>

      <div className="ss-tbl-wrap">
        <table className="ss-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Category</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tableSnags.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--ink-400)" }}>No snags found</td></tr>
            )}
            {tableSnags.map(s => {
              const snagAssignments = assignments[s.id] || [];
              const primary = snagAssignments[0] || null;
              const displayStatus = deriveSnagDisplayStatus(s.status, snagAssignments);
              const dueDate = primary?.due_date;
              const today = new Date().toISOString().split("T")[0];
              const dueStr = dueDate ? new Date(dueDate).toISOString().split("T")[0] : null;
              const dueClass = !dueStr ? "" : dueStr < today ? "due-over" : dueStr === today ? "due-today" : "due-ok";

              return (
                <tr key={s.id}>
                  <td className="ss-snag-id">{formatSnagId(s.id)}</td>
                  <td>
                    <div className="ss-snag-title">
                      {s.feedback || (s.feedback_type === "voice" ? "Voice Feedback" : "No feedback")}
                    </div>
                  </td>
                  <td><CategoryTag category={s.category} /></td>
                  <td>
                    <StatusPill displayStatus={displayStatus} />
                    {primary?.rejection_count > 0 && (
                      <RevisionTag rejectionCount={primary.rejection_count} />
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{primary?.username || "Unassigned"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    <span className={dueClass}>
                      {dueDate ? new Date(dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="ss-view-all"
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate("/allfeedbacks", { state: { highlightSnagId: s.id } })}
                    >
                      View &rarr;
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="ss-tbl-foot">
          <div className="ss-tbl-count">Showing {tableSnags.length} of {displayedSnags.length} snags</div>
          <span className="ss-view-all" style={{ cursor: "pointer" }} onClick={() => navigate("/allfeedbacks")}>
            View All Snags &rarr;
          </span>
        </div>
      </div>

      {/* Raise Snag Modal */}
      {modalOpen && (
        <RaiseModal
          onClose={() => setModalOpen(false)}
          onSubmit={handleRaiseSnag}
          siteUsers={siteUsers}
          sites={sites}
          userSiteId={effectiveSiteId}
        />
      )}

      {/* Assign Modal (opened from table — future use) */}
      <AssignModal
        isOpen={!!assignModalSnag}
        onClose={() => setAssignModalSnag(null)}
        snagId={assignModalSnag?.id}
        siteId={assignModalSnag?.site_id || effectiveSiteId}
        onAssigned={fetchData}
      />
    </div>
  );
}
