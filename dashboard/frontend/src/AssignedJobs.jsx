import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import "./css/allfb.css";

export function AssignedJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const { apiCall, user } = useAuth();

  const API = "http://localhost:9999/api";

  useEffect(() => {
    fetchAssignedJobs();
  }, [apiCall]);

  // ✅ Fetch assigned jobs for current user
  const fetchAssignedJobs = async () => {
    setLoading(true);
    try {
      const data = await apiCall(`${API}/snag-assignments/user/assigned-jobs`);
      if (!data || data.error) {
        setJobs([]);
        showToast("Failed to load assigned jobs", "error");
        return;
      }

      const jobsData = Array.isArray(data) ? data : [];
      setJobs(jobsData);
    } catch (err) {
      console.error("Error fetching assigned jobs:", err);
      setJobs([]);
      showToast("Error loading assigned jobs", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Resolve a job
  const resolveJob = async (assignmentId, currentStatus) => {
    try {
      const newStatus = currentStatus === "resolved" ? "open" : "resolved";
      
      const response = await apiCall(
        `${API}/snag-assignments/assignments/${assignmentId}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (response && !response.error) {
        // Update local state
        setJobs((prev) =>
          prev.map((job) =>
            job.assignment_id === assignmentId
              ? {
                  ...job,
                  status: newStatus,
                  resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
                }
              : job
          )
        );

        showToast(
          newStatus === "resolved"
            ? "✅ Job marked as resolved"
            : "⚠️ Job marked as open",
          "success"
        );
      }
    } catch (err) {
      console.error("Error resolving job:", err);
      showToast("Error updating job status", "error");
    }
  };

  // ✅ Filter jobs
  const filteredJobs = () => {
    if (filter === "resolved") {
      return jobs.filter((job) => job.status === "resolved");
    } else if (filter === "open") {
      return jobs.filter((job) => job.status === "open");
    }
    return jobs;
  };

  // ✅ Stats
  const total = jobs.length;
  const resolved = jobs.filter((job) => job.status === "resolved").length;
  const pending = jobs.filter((job) => job.status === "open").length;

  const displayJobs = filteredJobs();

  return (
    <div className="all-feedbacks">
      <header className="fb-header">
        <div>
          <h1>🎯 Assigned Jobs</h1>
          <p className="sub">View and manage your assigned tasks</p>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="stats-summary">
        {[
          { label: "Total", value: total },
          { label: "Open", value: pending },
          { label: "Resolved", value: resolved },
          {
            label: "Completion Rate",
            value: `${Math.round((resolved / total) * 100) || 0}%`,
          },
        ].map((stat, i) => (
          <div className="stat-item" key={i}>
            <div className="number">{stat.value}</div>
            <div className="label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Controls */}
      <div className="sort-controls" style={{ marginBottom: '20px' }}>
        <button
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
          style={{ 
            padding: '8px 16px',
            borderRadius: '6px',
            border: filter === "all" ? '2px solid #2563eb' : '1px solid #ddd',
            background: filter === "all" ? '#eff6ff' : 'white',
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          All ({total})
        </button>
        <button
          className={`filter-btn ${filter === "open" ? "active" : ""}`}
          onClick={() => setFilter("open")}
          style={{ 
            padding: '8px 16px',
            borderRadius: '6px',
            border: filter === "open" ? '2px solid #2563eb' : '1px solid #ddd',
            background: filter === "open" ? '#eff6ff' : 'white',
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          Open ({pending})
        </button>
        <button
          className={`filter-btn ${filter === "resolved" ? "active" : ""}`}
          onClick={() => setFilter("resolved")}
          style={{ 
            padding: '8px 16px',
            borderRadius: '6px',
            border: filter === "resolved" ? '2px solid #2563eb' : '1px solid #ddd',
            background: filter === "resolved" ? '#eff6ff' : 'white',
            cursor: 'pointer'
          }}
        >
          Resolved ({resolved})
        </button>
        <button 
          onClick={fetchAssignedJobs} 
          disabled={loading}
          style={{
            marginLeft: 'auto',
            padding: '8px 14px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? "⏳ Loading..." : "🔄 Refresh"}
        </button>
      </div>

      {/* Feedback List */}
      <div className="feedback-list">
        {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Loading assigned jobs...</div>}

        {!loading && displayJobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            <p>
              {filter === "all"
                ? "No assigned jobs yet"
                : `No ${filter} jobs`}
            </p>
          </div>
        )}

        {!loading &&
          displayJobs.map((job) => (
            <div
              key={job.assignment_id}
              className={`fb-card ${job.status === "resolved" ? "resolved" : "pending"}`}
            >
              {/* Title with Mark Complete Button */}
              <div className="fb-header-row">
                <h3 style={{ margin: 0, flex: 1 }}>
                  {job.snag?.feedback || "Assigned Job"}
                </h3>
                <button
                  onClick={() => resolveJob(job.assignment_id, job.status)}
                  className={`status-btn ${job.status === "resolved" ? "done" : ""}`}
                >
                  {job.status === "resolved" ? "Resolved" : "Mark Complete"}
                </button>
              </div>

              <div className="fb-details">
                {/* Site & Manager Info */}
                <p>
                  <strong>Site:</strong> {job.site?.site_name || "—"} | <strong>Manager:</strong>{" "}
                  {job.site?.site_manager || "—"}
                </p>

                {/* Type */}
                <p>
                  <strong>Type:</strong> {job.snag?.feedback_type || "text"}
                </p>

                {/* Feedback Details */}
                {job.snag?.feedback && (
                  <p>
                    <strong>Feedback:</strong> {job.snag.feedback}
                  </p>
                )}

                {/* Assignment Description/Notes */}
                {job.description && (
                  <div style={{
                    background: 'linear-gradient(135deg, #faf5ff 0%, #f3f0ff 100%)',
                    border: '2px solid #e9d5ff',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #8b5cf6',
                    color: '#5b21b6',
                    marginTop: '10px',
                    marginBottom: '10px'
                  }}>
                    <strong style={{ fontSize: '0.95rem' }}>📝 Assignment Notes: </strong>
                    <span style={{ color: '#6b5b95', fontSize: '0.95rem' }}>{job.description}</span>
                  </div>
                )}

                {/* Image Gallery */}
                {job.snag?.image_url && (
                  <div className="feedback-images">
                    <p>
                      <strong>Image:</strong>
                    </p>
                    <div className="image-gallery">
                      <img
                        src={job.snag.image_url}
                        alt="Job Image"
                        className="feedback-image"
                        onClick={() => window.open(job.snag.image_url, "_blank")}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                )}

                {/* Transcription as Suggestion */}
                {job.snag?.transcription && (
                  <p>
                    <strong>Suggestion:</strong> {job.snag.transcription}
                  </p>
                )}

                {/* Proof of Resolution */}
                {job.proof && (
                  <p>
                    <strong>Proof of Resolution:</strong> {job.proof}
                  </p>
                )}

                {/* Timestamp */}
                <p className="timestamp">
                  <strong>Assigned:</strong> {new Date(job.assigned_at).toLocaleString()}
                  {job.resolved_at && (
                    <>{" | "}<strong>Resolved:</strong> {new Date(job.resolved_at).toLocaleString()}</>
                  )}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
