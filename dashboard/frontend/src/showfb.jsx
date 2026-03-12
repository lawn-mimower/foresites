import React, { useEffect, useState } from "react";
import { showToast } from "./Toast";
import { useAuth } from "./AuthContext";
import "./css/allfb.css";

export function AllFeedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [completed, setCompleted] = useState({});
  const [sortBy, setSortBy] = useState("newest");
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ feedback: "", suggestion: "" });
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState(null);

  const { apiCall, isAdmin } = useAuth();
  const API = "http://localhost:9999/api/dashboard";
  const BASE_URL = "http://localhost:9999";

  // 🧠 Fetch feedbacks
  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const data = await apiCall(`${API}/feedbacks`);
        if (!data || data.error) return setFeedbacks([]);

        const feedbacksData = Array.isArray(data) ? data : [];
        setFeedbacks(feedbacksData);
      } catch (err) {
        console.error("Error fetching feedbacks:", err);
        setFeedbacks([]);
      }
    };

    fetchFeedbacks();
  }, [apiCall]);

  // ⏳ Generate Report
  const downloadReport = async () => {
    try {
      setLoadingReport(true);

      const res = await fetch(`${BASE_URL}/api/report/generate-report`, {
        method: "GET",
      });

      if (!res.ok) throw new Error("Failed to download report");

      // Convert response to Blob
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      // Trigger browser download
      const link = document.createElement("a");
      link.href = url;
      link.download = "construction_site_report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setReportUrl(url);
      showToast("📄 Report generated successfully!", "success");
    } catch (err) {
      console.error("Download error:", err);
      showToast("Failed to generate report", "error");
    } finally {
      setLoadingReport(false);
    }
  };

  // Toggle status (resolved/pending)
  const toggleTodo = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
      const response = await apiCall(`${API}/feedbacks/${id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus })
      });

      if (response && response.updated) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === id ? response.updated : f))
        );
        showToast(
          newStatus === 'resolved'
            ? "✅ Marked as resolved"
            : "⚠️ Marked as unresolved",
          "success"
        );
      }
    } catch (err) {
      console.error("Toggle error:", err);
      showToast("Failed to update status", "error");
    }
  };

  // Edit feedback
  const editFeedback = (fb) => {
    setEditingId(fb.id);
    setEditValues({ feedback: fb.feedback || "", suggestion: fb.suggestion || "" });
  };

  const saveEdit = async (id) => {
    try {
      const response = await apiCall(`${API}/feedbacks/${id}`, {
        method: "PUT",
        body: JSON.stringify(editValues)
      });
      if (response && response.id) {
        setFeedbacks((prev) => prev.map((f) => (f.id === id ? response : f)));
        showToast("Feedback updated", "success");
        setEditingId(null);
      } else if (response && response.error) {
        showToast(response.error, "error");
      }
    } catch (err) {
      console.error("Edit error:", err);
      showToast("Failed to update feedback", "error");
    }
  };

  const deleteFeedback = async (id) => {
    try {
      await apiCall(`${API}/feedbacks/${id}`, {
        method: "DELETE"
      });
      setFeedbacks((prev) => prev.filter((f) => f && f.id !== id));
      showToast("Deleted", "success");
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Failed to delete", "error");
    }
  };

  // Sorting
  let displayed = [...feedbacks].filter(f => f); // Remove undefined values
  if (sortBy === "resolved") displayed = displayed.filter((f) => f && f.status === 'resolved');
  if (sortBy === "unresolved") displayed = displayed.filter((f) => f && f.status === 'pending');
  displayed.sort((a, b) =>
    sortBy === "oldest"
      ? new Date(a.created_at) - new Date(b.created_at)
      : new Date(b.created_at) - new Date(a.created_at)
  );

  const total = feedbacks.filter(f => f).length;
  const resolved = feedbacks.filter((f) => f && f.status === 'resolved').length;
  const pending = total - resolved;

  return (
    <div className="all-feedbacks">
      <header className="fb-header">
        <div>
          <h1>Feedback Dashboard</h1>
          <p className="sub">View, manage, and update all feedback efficiently.</p>
        </div>

        <div className="sort-controls">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="resolved">Resolved</option>
            <option value="unresolved">Unresolved</option>
          </select>

          {/* Generate Report Button */}
          <button
            className="generate-report-btn"
            onClick={downloadReport}
            disabled={loadingReport}
          >
            {loadingReport ? "Generating..." : "Generate Report"}
          </button>

          {reportUrl && (
            <a
              href={reportUrl}
              download="construction_site_report.pdf"
              className="download-report-link"
            >
              Download Again
            </a>
          )}
        </div>
      </header>

      {/* Summary Cards */}
      <div className="stats-summary">
        {[
          { label: "Total", value: total },
          { label: "Resolved", value: resolved },
          { label: "Pending", value: pending },
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

      {/* Feedback List */}
      <div className="feedback-list">
        {displayed.map((fb) => (
          <div
            key={fb.id}
            className={`fb-card ${fb.status === 'resolved' ? "resolved" : "pending"}`}
          >
            <div className="fb-header-row">
              <h3>
                {fb.feedback ||
                  (fb.feedback_type === "voice"
                    ? "🎤 Voice Feedback"
                    : "No feedback")}
              </h3>
              <button
                onClick={() => toggleTodo(fb.id, fb.status)}
                className={`status-btn ${fb.status === 'resolved' ? "done" : ""}`}
              >
                {fb.status === 'resolved' ? "Resolved" : "Mark Complete"}
              </button>
            </div>

            <div className="fb-details">
              <p>
                <strong>Site:</strong> {fb.site?.site_name || "—"} | <strong>Reporter:</strong>{" "}
                {fb.reporter_name || "—"} | <strong>Phone:</strong> {fb.phone_number || "—"}
              </p>

              <p>
                <strong>Type:</strong> {fb.feedback_type || "text"} | <strong>Category:</strong>{" "}
                <span className={`cat-badge ${fb.category || "no-category"}`}>
                  {fb.category?.replace("_", " ") || "No category"}
                </span>
              </p>

              {fb.feedback && (
                <p>
                  <strong>Feedback:</strong> {fb.feedback}
                </p>
              )}

              {fb.suggestion && (
                <p>
                  <strong>Suggestion:</strong> {fb.suggestion}
                </p>
              )}

              {editingId === fb.id ? (
                <div className="edit-area">
                  <input
                    value={editValues.feedback}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        feedback: e.target.value,
                      }))
                    }
                    placeholder="Feedback"
                  />
                  <input
                    value={editValues.suggestion}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        suggestion: e.target.value,
                      }))
                    }
                    placeholder="Suggestion"
                  />
                  <div className="edit-btns">
                    <button className="save-btn" onClick={() => saveEdit(fb.id)}>
                      Save
                    </button>
                    <button
                      className="cancel-btn"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                fb.solution && (
                  <p>
                    <strong>Solution:</strong> {fb.solution}
                  </p>
                )
              )}

              {fb.suggestions && (
                <p>
                  <strong>Suggestions:</strong> {fb.suggestions}
                </p>
              )}

              {/* Voice */}
              {fb.feedback_type === "voice" && fb.voice_url && (
                <div className="voice-player">
                  <p>
                    <strong>Voice Message:</strong>
                  </p>
                  <audio controls preload="none" src={fb.voice_url} />
                </div>
              )}

              {/* Transcription */}
              {fb.transcription && (
                <div className="transcription-section">
                  <p>
                    <strong>Transcription:</strong>
                  </p>
                  <div className="transcription-text">{fb.transcription}</div>
                </div>
              )}

              {/* Image */}
              {fb.image_url && (
                <div className="feedback-images">
                  <p>
                    <strong>Image:</strong>
                  </p>
                  <div className="image-gallery">
                    <img
                      src={fb.image_url}
                      alt="Feedback"
                      className="feedback-image"
                      onClick={() => window.open(fb.image_url, "_blank")}
                    />
                  </div>
                </div>
              )}

              <p className="timestamp">
                <strong>Created:</strong> {new Date(fb.created_at).toLocaleString()} 
                {fb.assigned_at && (
                  <>
                    {" | "}<strong>Assigned:</strong> {new Date(fb.assigned_at).toLocaleString()}
                  </>
                )}
              </p>

              <div className="action-btns">
                {editingId !== fb.id && (
                  <button className="edit-btn" onClick={() => editFeedback(fb)}>
                    Edit
                  </button>
                )}
                <button
                  className="delete-btn"
                  onClick={() => deleteFeedback(fb.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
