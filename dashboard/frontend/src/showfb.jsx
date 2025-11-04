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
  const [reportStatus, setReportStatus] = useState(""); // 🧾 report status

  const { apiCall, user, isAdmin } = useAuth();

  const API = "http://localhost:9999/api/dashboard";
  const BASE_URL = "http://localhost:9999";

  // 🧾 Generate Report (Admin Only)
  const handleGenerateReport = async () => {
    setReportStatus("Generating...");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        setReportStatus("⚠️ No access token found. Please log in again.");
        showToast("⚠️ Login required", "error");
        return;
      }

      const res = await fetch(`${API}/generate-report`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok) {
        console.log("📊 Report Summary:", data.summary);
        setReportStatus("✅ Report generated successfully!");
        showToast("✅ Report generated successfully!", "success");

        // 🧾 Automatically download the generated CSV file
        const link = document.createElement("a");
        link.href = `${BASE_URL}/MD-report-data.csv`;
        link.download = "MD-report-data.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        const msg = data.message || data.error || "Error generating report";
        setReportStatus(`⚠️ ${msg}`);
        showToast(msg, "error");
      }
    } catch (err) {
      console.error("❌ Report generation failed:", err);
      setReportStatus("❌ Failed to generate report");
      showToast("❌ Failed to generate report", "error");
    }

    setTimeout(() => setReportStatus(""), 4000);
  };

  // 🧠 Fetch all feedbacks
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

        feedbacksData.forEach((fb) => {
          // 🖼️ Handle images
          if (fb.image && fb.image.length > 0) {
            fb.image.forEach((img, i) => {
              let finalPath = img?.trim();
              if (!finalPath) return;

              if (finalPath.startsWith("http")) {
                imgMap[`${fb._id}_${i}`] = finalPath;
                return;
              }

              if (!finalPath.startsWith("/uploads/")) {
                if (finalPath.startsWith("uploads/")) {
                  finalPath = "/" + finalPath;
                } else if (finalPath.startsWith("images/")) {
                  finalPath = `/uploads/${finalPath}`;
                } else {
                  finalPath = `/uploads/images/${finalPath}`;
                }
              }

              imgMap[`${fb._id}_${i}`] = `${BASE_URL}${finalPath}`;
            });
          }

          // 🎧 Handle voice files
          if (fb.voice_url) {
            let voicePath = fb.voice_url?.trim();
            if (!voicePath) return;

            if (voicePath.startsWith("http")) {
              voiceMap[fb._id] = voicePath;
              return;
            }

            if (!voicePath.startsWith("/uploads/")) {
              if (voicePath.startsWith("uploads/")) {
                voicePath = "/" + voicePath;
              } else if (voicePath.startsWith("voice/")) {
                voicePath = `/uploads/${voicePath}`;
              } else {
                voicePath = `/uploads/voice/${voicePath}`;
              }
            }

            voiceMap[fb._id] = `${BASE_URL}${voicePath}`;
          }
        });

        setImageUrls(imgMap);
        setVoiceUrls(voiceMap);
      } catch (err) {
        console.error("Error fetching feedbacks:", err);
        setFeedbacks([]);
      }
    };

    fetchFeedbacks();
  }, [apiCall]);

  // ✅ Toggle resolved
  const toggleTodo = async (id, currentResolved) => {
    try {
      const response = await apiCall(`${API}/feedbacks/${id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ resolved: !currentResolved }),
      });
      if (response && !response.error) {
        const updated = await response.json();
        setFeedbacks((prev) => prev.map((f) => (f._id === id ? updated : f)));
        setCompleted((prev) => ({ ...prev, [id]: updated.resolved }));
      }
    } catch (err) {
      console.error("Error toggling feedback:", err);
    }
  };

  // ✅ Edit feedback
  const editFeedback = (fb) => {
    setEditingId(fb._id);
    setEditValues({ feedback: fb.feedback || "", solution: fb.solution || "" });
  };

  // ✅ Save edited feedback
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
        setEditValues({ feedback: "", solution: "" });
      } else showToast("Failed to update feedback", "error");
    } catch (err) {
      console.error("Error saving feedback:", err);
      showToast("Failed to update feedback", "error");
    }
  };

  // ✅ Delete feedback
  const deleteFeedback = async (id) => {
    try {
      const response = await apiCall(`${API}/feedbacks/${id}`, { method: "DELETE" });
      if (response && !response.error) {
        setFeedbacks((prev) => prev.filter((f) => f._id !== id));
        showToast("Feedback deleted", "success");
      } else showToast("Failed to delete feedback", "error");
    } catch (err) {
      console.error("Error deleting feedback:", err);
      showToast("Failed to delete feedback", "error");
    }
  };

  // ✅ Sorting
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

          {/* 🧾 Admin-only Generate Report Button */}
          {isAdmin() && (
            <>
              <button
                onClick={handleGenerateReport}
                className="generate-report-btn"
                style={{
                  background: "#0077cc",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  marginLeft: "10px",
                }}
              >
                Generate Report
              </button>
              {reportStatus && (
                <span
                  style={{
                    marginLeft: "10px",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {reportStatus}
                </span>
              )}
            </>
          )}
        </div>
      </header>

      <div className="stats-summary">
        {[
          { label: "Total", value: total },
          { label: "Resolved", value: resolved },
          { label: "Pending", value: pending },
          { label: "Completion Rate", value: `${Math.round((resolved / total) * 100) || 0}%` },
        ].map((stat, i) => (
          <div className="stat-item" key={i}>
            <div className="number">{stat.value}</div>
            <div className="label">{stat.label}</div>
          </div>
        ))}
      </div>


      <div className="feedback-list">
        {displayed.map((fb) => (
          <div key={fb._id} className={`fb-card ${fb.resolved ? "resolved" : "pending"}`}>
            <div className="fb-header-row">
              <h3>{fb.feedback || (fb.feedback_type === "voice" ? "🎤 Voice Feedback" : "No feedback")}</h3>
              <button
                onClick={() => toggleTodo(fb._id, fb.resolved)}
                className={`status-btn ${fb.resolved ? "done" : ""}`}
              >
                {fb.resolved ? "Resolved" : "Mark Complete"}
              </button>
            </div>

            <div className="fb-details">
              <p><strong>Site:</strong> {fb.sitename} | <strong>By:</strong> {fb.name} | <strong>Code:</strong> {fb.code}</p>
              <p>
                <strong>Category:</strong>{" "}
                <span className={`cat-badge ${fb.category || "no-category"}`}>
                  {(fb.category && fb.category.replace("_", " ")) || "No category"}
                </span>
              </p>

              {editingId === fb._id ? (
                <div className="edit-area">
                  <input
                    value={editValues.feedback}
                    onChange={(e) => setEditValues(v => ({ ...v, feedback: e.target.value }))}
                    placeholder="Feedback"
                  />
                  <input
                    value={editValues.solution}
                    onChange={(e) => setEditValues(v => ({ ...v, solution: e.target.value }))}
                    placeholder="Solution"
                  />
                  <div className="edit-btns">
                    <button className="save-btn" onClick={() => saveEdit(fb._id)}>Save</button>
                    <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                fb.solution && <p><strong>Solution:</strong> {fb.solution}</p>
              )}

              {fb.suggestions && <p><strong>Suggestions:</strong> {fb.suggestions}</p>}

              {/* 🎧 Voice Feedback */}
              {fb.feedback_type === "voice" && voiceUrls[fb._id] && (
                <div className="voice-player">
                  <p><strong>Voice Message:</strong></p>
                  <audio controls preload="none" src={voiceUrls[fb._id]} />
                </div>
              )}

              {/* 🖼️ Images */}
              {fb.image && fb.image.length > 0 && (
                <div className="feedback-images">
                  <p><strong>Images:</strong></p>
                  <div className="image-gallery">
                    {fb.image.map((_, index) => {
                      const signedUrl = imageUrls[`${fb._id}_${index}`];
                      return (
                        <img
                          key={index}
                          src={signedUrl}
                          alt={`Feedback ${index + 1}`}
                          className="feedback-image"
                          onClick={() => window.open(signedUrl, "_blank")}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="timestamp">{new Date(fb.createdAt).toLocaleString()}</p>

              <div className="action-btns">
                {editingId === fb._id ? null : (
                  <button className="edit-btn" onClick={() => editFeedback(fb)}>Edit</button>
                )}
                <button className="delete-btn" onClick={() => deleteFeedback(fb._id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
