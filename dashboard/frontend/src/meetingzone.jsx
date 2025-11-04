import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import "./css/meetzone.css";

export function MeetingZone() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [completed, setCompleted] = useState({});
  const [loading, setLoading] = useState(false);
  const { apiCall } = useAuth();

  useEffect(() => {
    fetchAllFeedbacks();
  }, [apiCall]);

  const fetchAllFeedbacks = async () => {
    setLoading(true);
    try {
      const response = await apiCall("http://localhost:9999/api/dashboard/feedbacks");
      if (response && !response.error) {
        const data = await response.json();
        setFeedbacks(Array.isArray(data) ? data : []);
      } else {
        setFeedbacks([]);
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };

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
      const response = await apiCall("http://localhost:9999/api/dashboard/feedbacks");
      if (response && !response.error) {
        const data = await response.json();
        let feedbackArray = Array.isArray(data) ? data : [];
        
        // Filter out completed issues and sort by priority
        const unresolvedIssues = feedbackArray.filter(fb => !completed[fb._id]);
        
        unresolvedIssues.sort((a, b) => {
          return (
            categoryPriority.indexOf(a.category) -
            categoryPriority.indexOf(b.category)
          );
        });
  
        setFeedbacks(unresolvedIssues);
      } else {
        setFeedbacks([]);
      }
    } catch (error) {
      console.error('Error sorting feedbacks:', error);
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleTodo = (id) => {
    setCompleted((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate stats
  const totalFeedbacks = feedbacks.length;
  const completedCount = Object.values(completed).filter(Boolean).length;
  const pendingCount = totalFeedbacks - completedCount;

  return (
    <div className="meetingZone">
      <div className="meeting-header">
        <h1>Meeting Zone</h1>
        <p className="meeting-subtitle">Prioritize and manage construction feedbacks efficiently</p>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-icon">
            <div className="stat-icon-inner"></div>
          </div>
          <div className="stat-content">
            <h3>{totalFeedbacks}</h3>
            <p>Total Issues</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <div className="stat-icon-inner"></div>
          </div>
          <div className="stat-content">
            <h3>{pendingCount}</h3>
            <p>Pending</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <div className="stat-icon-inner"></div>
          </div>
          <div className="stat-content">
            <h3>{completedCount}</h3>
            <p>Completed</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <div className="stat-icon-inner"></div>
          </div>
          <div className="stat-content">
            <h3>{totalFeedbacks ? Math.round((completedCount / totalFeedbacks) * 100) : 0}%</h3>
            <p>Progress</p>
          </div>
        </div>
      </div>

      <div className="button-group">
        <button className="refresh-btn" onClick={fetchAllFeedbacks}>
           Refresh All
        </button>
        <button className="last24-btn" onClick={sortUnresolvedByPriority}>
          Sort Unresolved by Priority 
        </button>
      </div>

      <div className="feedback-section">
        <div className="section-header">
          <h2>Feedback Todo List</h2>
          <div className="section-actions">
            <span className="filter-info">
              {feedbacks.length} {feedbacks.length === 1 ? 'issue' : 'issues'} found
            </span>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading feedbacks...</p>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <div className="empty-icon-inner"></div>
            </div>
            <h3>No feedbacks found</h3>
            <p>All caught up! No pending issues at the moment.</p>
          </div>
        ) : (
          <div className="tasks-container">
            {feedbacks.map((fb) => (
              <div
                key={fb._id}
                className={`task ${completed[fb._id] ? "completed" : ""}`}
              >
                <div className="task-header">
                  <h3>{fb.feedback}</h3>
                  <button
                    onClick={() => toggleTodo(fb._id)}
                    className={`status-btn ${
                      completed[fb._id] ? "done" : "pending"
                    }`}
                  >
                    {completed[fb._id] ? "Completed" : "Mark Complete"}
                  </button>
                </div>

                <div className="task-body">
                  <div className="task-meta">
                    <div className="meta-item">
                      <span className="meta-label">Site:</span>
                      <span className="meta-value">{fb.sitename}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">By:</span>
                      <span className="meta-value">{fb.name}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Code:</span>
                      <span className="meta-value">{fb.code}</span>
                    </div>
                  </div>
                  
                  <div className="category-section">
                    <span className="meta-label">Category:</span>
                    <span className={`category-badge ${fb.category}`}>
                      {fb.category.replace("_", " ")}
                    </span>
                  </div>
                  
                  {fb.solution && (
                    <div className="solution-section">
                      <span className="meta-label">Solution:</span>
                      <p className="solution-text">{fb.solution}</p>
                    </div>
                  )}
                  
                  {fb.suggestions && (
                    <div className="suggestions-section">
                      <span className="meta-label">Suggestions:</span>
                      <p className="suggestions-text">{fb.suggestions}</p>
                    </div>
                  )}
                  
                  <div className="task-footer">
                    <p className="timestamp">
                      {new Date(fb.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
