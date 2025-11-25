import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import "./css/home.css";

export function Home() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated, apiCall } = useAuth();

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await apiCall("http://localhost:9999/api/dashboard/stats");
        if (response && !response.error) {
          const data = await response.json();
          if (data && typeof data.total === "number") setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [apiCall]);
  function beautifyResponse(text) {
    if (!text) return "";
  
    // Replace underscores such as safety_compliance → Safety Compliance
    text = text.replace(/([a-z])_([a-z])/gi, (m, a, b) => a + " " + b.toUpperCase());
  
    // Bold bullet points: "*  something" to "• Something"
    text = text.replace(/\*\s+/g, "• ");
  
    // Convert markdown-style bold **text**
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
    // Convert headings like *Title:* → <h3>Title</h3>
    text = text.replace(/\*(.*?)\*:/g, "<h3>$1</h3>");
  
    // Italic markdown *text*
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
  
    // Replace new lines with <br>
    text = text.replace(/\n+/g, "<br/>");
  
    return text;
  }
  

  const handleAsk = async () => {
    const userQuery = query.trim();
    if (!userQuery) return setAnswer("");
  
    setAnswer("Processing...");
  
    try {
      const token = localStorage.getItem("authToken");
  
      const response = await fetch("http://localhost:9999/api/dashboard/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,   // 🔥 REQUIRED
        },
        body: JSON.stringify({ task: userQuery }),
      });
  
      const data = await response.json();
  
      setAnswer(beautifyResponse(data.response || data.error || "No response."));

    } catch (error) {
      console.error("Query error:", error);
      setAnswer("Something went wrong.");
    }
  };
  

  return (
    <div className="home-wrapper">
      {/* Header */}
      <header className="home-header">
        <h1>
          {isAuthenticated() ? (
            <>
              Welcome back, <span>{user?.profile?.firstName || user?.username}</span>!
            </>
          ) : (
            <>
              Welcome to <span>MD Consultants</span>
            </>
          )}
        </h1>
        <p>
          {isAuthenticated() ? (
            <>
              Ready to manage construction feedbacks with <strong>OMNIFEED</strong>? 
              <br />
              <span className="user-role-info">
                Logged in as <strong>{user?.role}</strong> • Last login: {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'First time'}
              </span>
            </>
          ) : (
            <>
              Monitor, manage, and track construction feedbacks with <strong>OMNIFEED</strong>
              <br />
              <span className="login-prompt">
                <a href="/login" style={{ color: 'var(--primary-600)', textDecoration: 'none' }}>
                  Sign in to access all features
                </a>
              </span>
            </>
          )}
        </p>
      </header>

      {/* Stats */}
      <section className="stats-section">
        {[
          { label: "Total Feedbacks", value: stats.total, color: "#3b82f6" },
          { label: "Resolved", value: stats.resolved, color: "#10b981" },
          { label: "Pending", value: stats.pending, color: "#ef4444" },
        ].map((c, i) => (
          <div className="stat-item" key={i}>
            <div className="stat-icon" style={{ color: c.color, background: `${c.color}15` }}>
              <div className="stat-icon-inner" style={{ backgroundColor: c.color }}></div>
            </div>
            <div className="stat-info">
              <h4>{c.label}</h4>
              <p style={{ color: c.color }}>{loading ? "—" : c.value}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Query and Highlights */}
      <section className="insight-section">
        <div className="query-panel">
          <h3>Quick Query</h3>
          <div className="query-field">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about total, resolved, or pending..."
            />
            <button onClick={handleAsk}>Ask</button>
          </div>
          {answer && <div className="query-result" dangerouslySetInnerHTML={{ __html: answer }}></div>}
        </div>

        <div className="highlight-panel">
          <h3>Insights</h3>
          <ul>
            <li>
              Completion Rate:{" "}
              <span>
                {stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0}%
              </span>
            </li>
            <li>Pending Reviews: <span>{stats.pending}</span></li>
            <li>Last Sync: <span>just now</span></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
