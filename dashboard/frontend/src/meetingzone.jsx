import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { showToast } from "./Toast";
import "./css/meetzone.css";

export function MeetingZone() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [completed, setCompleted] = useState({});
  const [loading, setLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState({});
  const [voiceUrls, setVoiceUrls] = useState({});
  const { apiCall, isAdmin } = useAuth();

  const API = "http://localhost:9999/api/dashboard";
  const BASE_URL = "http://localhost:9999";

  useEffect(() => {
    fetchAllFeedbacks();
  }, [apiCall]);

  // ✅ Fetch feedbacks and normalize image/voice URLs
  const fetchAllFeedbacks = async () => {
    setLoading(true);
    try {
      const response = await apiCall(`${API}/feedbacks`);
      if (!response || response.error) return setFeedbacks([]);

      const data = await response.json();
      const feedbackData = Array.isArray(data)
        ? data.map((fb) => ({
            feedback_type: fb.feedback_type || "text",
            category: fb.category || "miscellaneous",
            ...fb,
          }))
        : [];

      // 🧭 Build image & voice maps
      const imgMap = {};
      const voiceMap = {};

      // Helper function to get media URL (S3 or local)
      const getMediaUrl = async (filePath) => {
        if (!filePath) return null;
        
        // If already a full URL, return it
        if (filePath.startsWith("http")) {
          return filePath;
        }

        // Check if it's an S3 key (starts with voice/ or images/)
        if (filePath.startsWith("voice/") || filePath.startsWith("images/")) {
          try {
            console.log(`🔍 Fetching S3 URL for: ${filePath}`);
            const response = await apiCall(`${API}/media-url?path=${encodeURIComponent(filePath)}`);
            if (response && !response.error) {
              const data = await response.json();
              console.log(`✅ Got S3 URL for: ${filePath}`);
              return data.url;
            } else {
              console.warn(`⚠️ Failed to get S3 URL for: ${filePath}`, response?.error);
            }
          } catch (err) {
            console.error("❌ Error fetching S3 URL:", err);
          }
        }

        // Fallback to local path
        if (!filePath.startsWith("/uploads/")) {
          if (filePath.startsWith("uploads/")) {
            filePath = "/" + filePath;
          } else if (filePath.startsWith("images/")) {
            filePath = `/uploads/${filePath}`;
          } else if (filePath.startsWith("voice/")) {
            filePath = `/uploads/${filePath}`;
          } else {
            // Try to determine folder from path
            const ext = filePath.split('.').pop()?.toLowerCase();
            const folder = ['ogg', 'wav', 'mp3', 'm4a'].includes(ext) ? 'voice' : 'images';
            filePath = `/uploads/${folder}/${filePath}`;
          }
        }
        return `${BASE_URL}${filePath}`;
      };

      // Process images and voice files
      for (const fb of feedbackData) {
        // 🖼️ Handle images
        if (fb.image && fb.image.length > 0) {
          for (let i = 0; i < fb.image.length; i++) {
            const img = fb.image[i]?.trim();
            if (!img) continue;
            const url = await getMediaUrl(img);
            if (url) {
              imgMap[`${fb._id}_${i}`] = url;
            }
          }
        }

        // 🎧 Handle voice files
        if (fb.voice_url) {
          const voicePath = fb.voice_url?.trim();
          if (voicePath) {
            const url = await getMediaUrl(voicePath);
            if (url) {
              voiceMap[fb._id] = url;
            }
          }
        }
      }

      setImageUrls(imgMap);
      setVoiceUrls(voiceMap);
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
      const response = await apiCall(`${API}/feedbacks`);
      if (!response || response.error) return;
      const data = await response.json();
      let feedbackArray = Array.isArray(data) ? data : [];
      const unresolved = feedbackArray.filter((fb) => !completed[fb._id]);
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

 // ✅ Toggle resolved (auto-updates CSV in backend)
  const toggleTodo = async (id, currentResolved) => {
    try {
      const response = await apiCall(`${API}/feedbacks/${id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ resolved: !currentResolved }),
      });

      if (response && !response.error) {
        const updated = await response.json();
        setFeedbacks((prev) => prev.map((f) => (f._id === id ? updated.updated : f)));
        setCompleted((prev) => ({ ...prev, [id]: updated.updated.resolved }));

        showToast(
          updated.updated.resolved
            ? "✅ Feedback marked as resolved (CSV updated)"
            : "⚠️ Feedback marked as unresolved",
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
              key={fb._id}
              className={`fb-card ${completed[fb._id] ? "resolved" : "pending"}`}
            >
              <div className="fb-header-row">
                <h3>
                  {fb.feedback ||
                    (fb.feedback_type === "voice"
                      ? "🎤 Voice Feedback"
                      : "No feedback text")}
                </h3>
                <button
                  onClick={() => toggleTodo(fb._id, completed[fb._id])}
                  className={`status-btn ${completed[fb._id] ? "done" : ""}`}
                >
                  {completed[fb._id] ? "Completed" : "Mark Complete"}
                </button>
              </div>

              <div className="fb-details">
                <p>
                  {fb.sitename && (
                    <>
                      <strong>Site:</strong> {fb.sitename}{" "}
                    </>
                  )}
                  {fb.name && (
                    <>
                      | <strong>By:</strong> {fb.name}{" "}
                    </>
                  )}
                  {fb.code && (
                    <>
                      | <strong>Code:</strong> {fb.code}{" "}
                    </>
                  )}
                  {fb.phone && (
                    <>
                      | <strong>Phone:</strong> {fb.phone}
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

                {/* 🎧 Voice feedback (normalized) */}
                {fb.feedback_type === "voice" && voiceUrls[fb._id] && (
                  <div className="voice-player">
                    <p>
                      <strong>Voice Message:</strong>
                    </p>
                    <audio controls preload="none" src={voiceUrls[fb._id]} />
                  </div>
                )}

                {/* 📝 Transcription */}
                {fb.transcription && (
                  <div className="transcription-section">
                    <p><strong>Transcription:</strong></p>
                    <div className="transcription-text">{fb.transcription}</div>
                  </div>
                )}

                {/* 🖼️ Images (normalized) */}
                {fb.image && fb.image.length > 0 && (
                  <div className="feedback-images">
                    <p>
                      <strong>Images:</strong>
                    </p>
                    <div className="image-gallery">
                      {fb.image.map((_, i) => {
                        const finalPath = imageUrls[`${fb._id}_${i}`];
                        return (
                          <img
                            key={i}
                            src={finalPath}
                            alt={`Feedback ${i + 1}`}
                            className="feedback-image"
                            onClick={() => window.open(finalPath, "_blank")}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Solution + Suggestions */}
                {fb.solution && (
                  <p>
                    <strong>Solution:</strong> {fb.solution}
                  </p>
                )}
                {fb.suggestions && (
                  <p>
                    <strong>Suggestions:</strong> {fb.suggestions}
                  </p>
                )}

                {/* Timestamp */}
                {fb.createdAt && (
                  <p className="timestamp">
                    {new Date(fb.createdAt).toLocaleString()}
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
