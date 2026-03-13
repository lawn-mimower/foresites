import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
        const data = await apiCall("http://localhost:9999/api/dashboard/stats");
        if (data && !data.error) {
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
          Authorization: `Bearer ${token}`,
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
              Welcome back, <span>{user?.username || 'User'}</span>
            </>
          ) : (
            <>
              Welcome to <span>Foresites</span>
            </>
          )}
        </h1>
        <p>
          {isAuthenticated() ? (
            <>
              Construction feedback management powered by <strong>OMNIFEED</strong>
              <br />
              <span className="user-role-info">
                {user?.role} &bull; {user?.department || 'N/A'}
              </span>
            </>
          ) : (
            <>
              Monitor, manage, and track construction feedbacks with <strong>OMNIFEED</strong>
              <br />
              <span className="login-prompt">
                <a href="/login">
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
          { label: "Total Feedbacks", value: stats.total },
          { label: "Resolved", value: stats.resolved },
          { label: "Pending", value: stats.pending },
        ].map((c, i) => (
          <div className="stat-item" key={i}>
            <div className="stat-info">
              <h4>{c.label}</h4>
              <p>{loading ? "—" : c.value}</p>
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
          <Link to="/chat" style={{
            display: "inline-block",
            marginTop: "1rem",
            color: "var(--brand-red)",
            fontWeight: 700,
            fontSize: "var(--font-size-xs)",
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "0.04em"
          }}>
            Open Full Chat &rarr;
          </Link>
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
