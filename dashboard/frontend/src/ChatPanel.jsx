import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { useAuth } from "./AuthContext";
import "./css/chat.css";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

function ChatChart({ chartData }) {
  if (!chartData) return null;

  const { chart_type, title, labels, datasets, x_label, y_label } = chartData;

  // Transform data for Recharts format
  const data = labels.map((label, i) => {
    const point = { name: label };
    datasets.forEach((ds) => {
      point[ds.label] = ds.values[i] ?? 0;
    });
    return point;
  });

  const renderChart = () => {
    switch (chart_type) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" label={x_label ? { value: x_label, position: "insideBottom", offset: -5 } : undefined} />
              <YAxis label={y_label ? { value: y_label, angle: -90, position: "insideLeft" } : undefined} />
              <Tooltip />
              <Legend />
              {datasets.map((ds, i) => (
                <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
        // For pie, use first dataset only
        const pieData = labels.map((label, i) => ({
          name: label,
          value: datasets[0]?.values[i] ?? 0,
        }));
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {datasets.map((ds, i) => (
                <Area key={ds.label} type="monotone" dataKey={ds.label} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      default: // bar
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" label={x_label ? { value: x_label, position: "insideBottom", offset: -5 } : undefined} />
              <YAxis label={y_label ? { value: y_label, angle: -90, position: "insideLeft" } : undefined} />
              <Tooltip />
              <Legend />
              {datasets.map((ds, i) => (
                <Bar key={ds.label} dataKey={ds.label} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="chat-chart-container">
      {title && <p className="chat-chart-title">{title}</p>}
      {renderChart()}
    </div>
  );
}

function formatContent(text) {
  if (!text) return "";
  // Convert markdown bold
  let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Convert markdown italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br/>");
  // Convert underscored category names
  html = html.replace(/([a-z])_([a-z])/gi, (m, a, b) => a + " " + b);
  return html;
}

export function ChatPanel() {
  const { user, apiCall } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  async function loadSessions() {
    try {
      const data = await apiCall("/api/chat/sessions");
      if (data?.sessions) setSessions(data.sessions);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  }

  async function loadSessionMessages(sessionId) {
    try {
      const data = await apiCall(`/api/chat/sessions/${sessionId}/messages`);
      if (data?.messages) {
        setMessages(
          data.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: m.role,
              content: m.content,
              chart_data: m.chart_data,
            }))
        );
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  function handleSelectSession(sessionId) {
    setActiveSessionId(sessionId);
    loadSessionMessages(sessionId);
  }

  function handleNewChat() {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    // Optimistically add user message
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);

    try {
      const data = await apiCall("/api/chat/message", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          session_id: activeSessionId,
        }),
      });

      if (data?.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error },
        ]);
      } else {
        // Set session if this was a new chat
        if (!activeSessionId && data?.session_id) {
          setActiveSessionId(data.session_id);
          loadSessions(); // Refresh sidebar
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response || "No response.",
            chart_data: data.chart_data || null,
          },
        ]);
      }
    } catch (err) {
      console.error("Send error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const initials = user?.username ? user.username[0].toUpperCase() : "U";

  return (
    <div className="chat-wrapper">
      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h3>AI Chat</h3>
          <button className="new-chat-btn" onClick={handleNewChat}>
            + New Chat
          </button>
        </div>
        <div className="chat-session-list">
          {sessions.map((s) => (
            <button
              key={s.session_id}
              className={`chat-session-item ${activeSessionId === s.session_id ? "active" : ""}`}
              onClick={() => handleSelectSession(s.session_id)}
            >
              <span className="chat-session-title">{s.title || "Untitled"}</span>
              <span className="chat-session-date">
                {new Date(s.updated_at).toLocaleDateString()}
              </span>
            </button>
          ))}
          {sessions.length === 0 && (
            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", padding: "1rem" }}>
              No conversations yet
            </p>
          )}
        </div>
      </aside>

      {/* Main Chat */}
      <div className="chat-main">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">AI</div>
              <h3>OMNIFEED AI Assistant</h3>
              <p>Ask about snags, sites, reports, or anything construction-related.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div className="chat-avatar">
                  {msg.role === "user" ? initials : "AI"}
                </div>
                <div>
                  <div
                    className="chat-bubble"
                    dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                  />
                  {msg.chart_data && <ChatChart chartData={msg.chart_data} />}
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="chat-loading">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-bar">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about snags, sites, reports..."
            rows={1}
            disabled={sending}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={sending || !input.trim()}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
