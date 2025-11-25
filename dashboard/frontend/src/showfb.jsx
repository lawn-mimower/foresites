import React, { useEffect, useState } from "react";
import { showToast } from "./Toast";
import { useAuth } from "./AuthContext";
import "./css/allfb.css";

export function AllFeedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [completed, setCompleted] = useState({});
  const [sortBy, setSortBy] = useState("newest");
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ feedback: "", solution: "" });
  const [imageUrls, setImageUrls] = useState({});
  const [voiceUrls, setVoiceUrls] = useState({});
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState(null);

  const { apiCall, isAdmin } = useAuth();
  const API = "http://localhost:9999/api/dashboard";
  const BASE_URL = "http://localhost:9999";

  // 🧠 Fetch feedbacks
  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const response = await apiCall(`${API}/feedbacks`);
        if (!response || response.error) return setFeedbacks([]);

        const data = await response.json();
        const feedbacksData = Array.isArray(data) ? data : [];
        setFeedbacks(feedbacksData);

        const imgMap = {};
        const voiceMap = {};

        const getMediaUrl = async (filePath) => {
          if (!filePath) return null;

          if (filePath.startsWith("http")) return filePath;

          // S3 signed URL
          if (filePath.startsWith("voice/") || filePath.startsWith("images/")) {
            try {
              const response = await apiCall(
                `${API}/media-url?path=${encodeURIComponent(filePath)}`
              );
              if (response && !response.error) {
                const data = await response.json();
                return data.url;
              }
            } catch (err) {
              console.error("Error fetching media URL:", err);
            }
          }

          let fp = filePath;
          if (!fp.startsWith("/uploads/")) {
            if (fp.startsWith("uploads/")) fp = "/" + fp;
            else if (fp.startsWith("images/")) fp = `/uploads/${fp}`;
            else if (fp.startsWith("voice/")) fp = `/uploads/${fp}`;
            else {
              const ext = fp.split(".").pop()?.toLowerCase();
              const folder = ["ogg", "wav", "mp3", "m4a"].includes(ext)
                ? "voice"
                : "images";
              fp = `/uploads/${folder}/${fp}`;
            }
          }

          return `${BASE_URL}${fp}`;
        };

        // Process images + voice files
        for (const fb of feedbacksData) {
          if (fb.image && fb.image.length > 0) {
            for (let i = 0; i < fb.image.length; i++) {
              const img = fb.image[i]?.trim();
              if (!img) continue;
              const url = await getMediaUrl(img);
              if (url) imgMap[`${fb._id}_${i}`] = url;
            }
          }

          if (fb.voice_url) {
            const url = await getMediaUrl(fb.voice_url.trim());
            if (url) voiceMap[fb._id] = url;
          }
        }

        setImageUrls(imgMap);
        setVoiceUrls(voiceMap);
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

  // Toggle resolved
  const toggleTodo = async (id, currentResolved) => {
    try {
      const response = await apiCall(`${API}/feedbacks/${id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ resolved: !currentResolved }),
      });

      if (response && !response.error) {
        const updated = await response.json();
        setFeedbacks((prev) =>
          prev.map((f) => (f._id === id ? updated.updated : f))
        );
        setCompleted((prev) => ({ ...prev, [id]: updated.updated.resolved }));
        showToast(
          updated.updated.resolved
            ? "✅ Marked as resolved"
            : "⚠️ Marked as unresolved",
          "success"
        );
      }
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  // Edit feedback
  const editFeedback = (fb) => {
    setEditingId(fb._id);
    setEditValues({ feedback: fb.feedback || "", solution: fb.solution || "" });
  };

  const saveEdit = async (id) => {
    try {
      const response = await apiCall(`${API}/feedbacks/${id}`, {
        method: "PUT",
        body: JSON.stringify(editValues),
      });
      if (response && !response.error) {
        const updated = await response.json();
        setFeedbacks((prev) => prev.map((f) => (f._id === id ? updated : f)));
        showToast("Feedback updated", "success");
        setEditingId(null);
      }
    } catch (err) {
      console.error("Edit error:", err);
      showToast("Failed to update feedback", "error");
    }
  };

  const deleteFeedback = async (id) => {
    try {
      const response = await apiCall(`${API}/feedbacks/${id}`, {
        method: "DELETE",
      });
      if (response && !response.error) {
        setFeedbacks((prev) => prev.filter((f) => f._id !== id));
        showToast("Deleted", "success");
      }
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Failed to delete", "error");
    }
  };

  // Sorting
  let displayed = [...feedbacks];
  if (sortBy === "resolved") displayed = displayed.filter((f) => f.resolved);
  if (sortBy === "unresolved") displayed = displayed.filter((f) => !f.resolved);
  displayed.sort((a, b) =>
    sortBy === "oldest"
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt)
  );

  const total = feedbacks.length;
  const resolved = feedbacks.filter((f) => f.resolved).length;
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
            key={fb._id}
            className={`fb-card ${fb.resolved ? "resolved" : "pending"}`}
          >
            <div className="fb-header-row">
              <h3>
                {fb.feedback ||
                  (fb.feedback_type === "voice"
                    ? "🎤 Voice Feedback"
                    : "No feedback")}
              </h3>
              <button
                onClick={() => toggleTodo(fb._id, fb.resolved)}
                className={`status-btn ${fb.resolved ? "done" : ""}`}
              >
                {fb.resolved ? "Resolved" : "Mark Complete"}
              </button>
            </div>

            <div className="fb-details">
              <p>
                <strong>Site:</strong> {fb.sitename} | <strong>By:</strong>{" "}
                {fb.name} | <strong>Code:</strong> {fb.code}
              </p>

              <p>
                <strong>Category:</strong>{" "}
                <span className={`cat-badge ${fb.category || "no-category"}`}>
                  {fb.category?.replace("_", " ") || "No category"}
                </span>
              </p>

              {editingId === fb._id ? (
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
                    value={editValues.solution}
                    onChange={(e) =>
                      setEditValues((v) => ({
                        ...v,
                        solution: e.target.value,
                      }))
                    }
                    placeholder="Solution"
                  />
                  <div className="edit-btns">
                    <button className="save-btn" onClick={() => saveEdit(fb._id)}>
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
              {fb.feedback_type === "voice" && voiceUrls[fb._id] && (
                <div className="voice-player">
                  <p>
                    <strong>Voice Message:</strong>
                  </p>
                  <audio controls preload="none" src={voiceUrls[fb._id]} />
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

              {/* Images */}
              {fb.image && fb.image.length > 0 && (
                <div className="feedback-images">
                  <p>
                    <strong>Images:</strong>
                  </p>
                  <div className="image-gallery">
                    {fb.image.map((_, idx) => {
                      const url = imageUrls[`${fb._id}_${idx}`];
                      return (
                        <img
                          key={idx}
                          src={url}
                          alt={`Feedback ${idx + 1}`}
                          className="feedback-image"
                          onClick={() => window.open(url, "_blank")}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="timestamp">
                {new Date(fb.createdAt).toLocaleString()}
              </p>

              <div className="action-btns">
                {editingId !== fb._id && (
                  <button className="edit-btn" onClick={() => editFeedback(fb)}>
                    Edit
                  </button>
                )}
                <button
                  className="delete-btn"
                  onClick={() => deleteFeedback(fb._id)}
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
