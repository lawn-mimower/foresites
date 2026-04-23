import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import { API_BASE, BASE_URL } from "./config/api";
import S3Image from "./components/S3Image";
import "./css/meetzone.css";

export function MeetingZone() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [completed, setCompleted] = useState({});
  const [loading, setLoading] = useState(false);
  const { apiCall, isAdmin } = useAuth();

  const API = `${API_BASE}/dashboard`;

  useEffect(() => {
    fetchAllFeedbacks();
  }, [apiCall]);

  // ✅ Fetch feedbacks from Supabase
  const fetchAllFeedbacks = async () => {
    setLoading(true);
    try {
      const data = await apiCall(`${API}/feedbacks`);
      if (!data || data.error) return setFeedbacks([]);

      const feedbackData = Array.isArray(data)
        ? data.map((fb) => ({
            feedback_type: fb.feedback_type || "text",
            category: fb.category || "miscellaneous",
            ...fb,
          }))
        : [];

      setFeedbacks(feedbackData);
    } catch (err) {
      console.error("Error fetching feedbacks:", err);
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Sort unresolved by category priority
  const categoryPriority = [
    "safety_compliance",
    "design_conflicts",
    "resource_blockers",
    "workflow_issues",
    "miscellaneous",
  ];

  const sortUnresolvedByPriority = async () => {
    setLoading(true);
    try {
      const data = await apiCall(`${API}/feedbacks`);
      if (!data || data.error) return;
      let feedbackArray = Array.isArray(data) ? data : [];
      const unresolved = feedbackArray.filter((fb) => fb.status !== 'resolved');
      unresolved.sort(
        (a, b) =>
          categoryPriority.indexOf(a.category) -
          categoryPriority.indexOf(b.category)
      );
      setFeedbacks(unresolved);
    } catch (err) {
      console.error("Error sorting:", err);
    } finally {
      setLoading(false);
    }
  };

 // ✅ Toggle status
  const toggleTodo = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
      const response = await apiCall(`${API}/feedbacks/${id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      if (response && !response.error) {
        const updated = response.updated;
        setFeedbacks((prev) => prev.map((f) => (f.id === id ? updated : f)));
        setCompleted((prev) => ({ ...prev, [id]: newStatus === 'resolved' }));

        showToast(
          newStatus === 'resolved'
            ? "✅ Feedback marked as resolved"
            : "⚠️ Feedback marked as pending",
          "success"
        );
      }
    } catch (err) {
      console.error("Error toggling feedback:", err);
    }
  };

  // ✅ Stats
  const total = feedbacks.length;
  const done = Object.values(completed).filter(Boolean).length;
  const pending = total - done;

  return (
    <div className="all-feedbacks">
      <header className="fb-header">
        <div>
          <h1>Meeting Zone</h1>
          <p className="sub">
            Prioritize and review construction feedbacks efficiently.
          </p>
        </div>

        <div className="sort-controls">
          <button
            onClick={fetchAllFeedbacks}
            className="refresh-btn"
            style={{
              background: "#4b7bec",
              color: "#fff",
              border: "none",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Refresh All
          </button>

          <button
            onClick={sortUnresolvedByPriority}
            className="sort-btn"
            style={{
              background: "#20bf6b",
              color: "#fff",
              border: "none",
              padding: "8px 12px",
              borderRadius: "8px",
              marginLeft: "10px",
              cursor: "pointer",
            }}
          >
            Sort by Priority
          </button>
        </div>
      </header>

      {/* ✅ Stats Summary */}
      <div className="stats-summary">
        {[
          { label: "Total", value: total },
          { label: "Pending", value: pending },
          { label: "Completed", value: done },
          {
            label: "Progress",
            value: `${total ? Math.round((done / total) * 100) : 0}%`,
          },
        ].map((stat, i) => (
          <div className="stat-item" key={i}>
            <div className="number">{stat.value}</div>
            <div className="label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ✅ Feedback List */}
      <div className="feedback-list">
        {loading ? (
          <p>Loading feedbacks...</p>
        ) : feedbacks.length === 0 ? (
          <div className="empty-state">
            <h3>No feedbacks found</h3>
            <p>All caught up! No pending issues at the moment.</p>
          </div>
        ) : (
          feedbacks.map((fb) => (
            <div
              key={fb.id}
              className={`fb-card ${fb.status === 'resolved' ? "resolved" : "pending"}`}
            >
              <div className="fb-header-row">
                <h3>
                  {fb.feedback ||
                    (fb.feedback_type === "voice"
                      ? "🎤 Voice Feedback"
                      : "No feedback text")}
                </h3>
                <button
                  onClick={() => toggleTodo(fb.id, fb.status)}
                  className={`status-btn ${fb.status === 'resolved' ? "done" : ""}`}
                >
                  {fb.status === 'resolved' ? "Completed" : "Mark Complete"}
                </button>
              </div>

              <div className="fb-details">
                <p>
                  {fb.site?.site_name && (
                    <>
                      <strong>Site:</strong> {fb.site.site_name}{" "}
                    </>
                  )}
                  {fb.reporter_name && (
                    <>
                      | <strong>By:</strong> {fb.reporter_name}{" "}
                    </>
                  )}
                  {fb.phone_number && (
                    <>
                      | <strong>Phone:</strong> {fb.phone_number}
                    </>
                  )}
                </p>

                <p>
                  <strong>Category:</strong>{" "}
                  <span
                    className={`cat-badge ${fb.category || "no-category"}`}
                  >
                    {(fb.category && fb.category.replace("_", " ")) ||
                      "Uncategorized"}
                  </span>
                </p>

                <p>
                  <strong>Type:</strong>{" "}
                  {fb.feedback_type === "voice" ? "🎙 Voice" : "💬 Text"}
                </p>

                {/* 🎧 Voice feedback */}
                {fb.feedback_type === "voice" && fb.voice_url && (
                  <div className="voice-player">
                    <p>
                      <strong>Voice Message:</strong>
                    </p>
                    <audio controls preload="none" src={fb.voice_url} />
                  </div>
                )}

                {/* 📝 Transcription */}
                {fb.transcription && (
                  <div className="transcription-section">
                    <p><strong>Transcription:</strong></p>
                    <div className="transcription-text">{fb.transcription}</div>
                  </div>
                )}

                {/* 🖼️ Images */}
                {fb.image_url && (
                  <div className="feedback-images">
                    <p>
                      <strong>Image:</strong>
                    </p>
                    <div className="image-gallery">
                      <S3Image
                        src={fb.image_url}
                        apiCall={apiCall}
                        apiBase={API_BASE}
                        alt="Feedback"
                        className="feedback-image"
                        onClick={(url) => window.open(url, "_blank")}
                      />
                    </div>
                  </div>
                )}

                {/* Suggestion */}
                {fb.suggestion && (
                  <p>
                    <strong>Suggestion:</strong> {fb.suggestion}
                  </p>
                )}

                {/* Timestamp */}
                {fb.created_at && (
                  <p className="timestamp">
                    {new Date(fb.created_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
