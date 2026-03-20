import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { useAuth } from "./AuthContext";
import { BASE_URL } from "./config/api";
import "./css/chat.css";

SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("shell", bash);

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const SUGGESTION_CHIPS = [
  { label: "Morning Briefing", query: "Give me the morning briefing" },
  { label: "What's stuck?", query: "Find bottlenecks and blocked assignments" },
  { label: "Safety Trends", query: "Show me safety trends and Heinrich analysis" },
  { label: "Site Health Scores", query: "Compare site health scores across all sites" },
  { label: "Top Recurring Issues", query: "Run a Pareto analysis on recurring issues" },
  { label: "Team Performance", query: "Show engineer performance report" },
  { label: "Weekly Summary", query: "Generate the weekly executive summary" },
  { label: "Issue Patterns", query: "Find co-occurring issue patterns across sites" },
];

const ARTIFACT_TYPE_LABELS = {
  chart: "Chart",
  table: "Table",
  kpi: "Metrics",
  findings: "Findings",
};

function groupSessionsByDate(sessions) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const today = [], yesterday = [], earlier = [];
  sessions.forEach((s) => {
    const d = new Date(s.updated_at);
    if (d >= todayStart) today.push(s);
    else if (d >= yesterdayStart) yesterday.push(s);
    else earlier.push(s);
  });

  const groups = [];
  if (today.length) groups.push({ label: "Today", sessions: today });
  if (yesterday.length) groups.push({ label: "Yesterday", sessions: yesterday });
  if (earlier.length) groups.push({ label: "Earlier", sessions: earlier });
  return groups;
}

/* ===== Chart Component ===== */

function ChatChart({ chartData }) {
  if (!chartData) return null;
  const { chart_type, title, labels, datasets, x_label, y_label } = chartData;

  const data = labels.map((label, i) => {
    const point = { name: label };
    datasets.forEach((ds) => { point[ds.label] = ds.values[i] ?? 0; });
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
              <Tooltip /><Legend />
              {datasets.map((ds, i) => <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />)}
            </LineChart>
          </ResponsiveContainer>
        );
      case "pie":
        const pieData = labels.map((label, i) => ({ name: label, value: datasets[0]?.values[i] ?? 0 }));
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      case "area":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
              {datasets.map((ds, i) => <Area key={ds.label} type="monotone" dataKey={ds.label} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} />)}
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" label={x_label ? { value: x_label, position: "insideBottom", offset: -5 } : undefined} />
              <YAxis label={y_label ? { value: y_label, angle: -90, position: "insideLeft" } : undefined} />
              <Tooltip /><Legend />
              {datasets.map((ds, i) => <Bar key={ds.label} dataKey={ds.label} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />)}
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

/* ===== Markdown Components ===== */

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{language || "text"}</span>
        <button className="code-copy-btn" onClick={handleCopy}>{copied ? "Copied!" : "Copy"}</button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || "text"}
        showLineNumbers
        customStyle={{ margin: 0, padding: "12px 14px", background: "#0D0D0D", fontSize: "0.82rem", borderRadius: 0 }}
        lineNumberStyle={{ minWidth: "28px", color: "#4A4A4A" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function MessageContent({ content }) {
  return (
    <div className="md-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children, node, ref, ...props }) { return <>{children}</>; },
          code({ className, children, node, ref, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeStr = String(children).replace(/\n$/, "");
            if (match) return <CodeBlock language={match?.[1]} code={codeStr} />;
            return <code className="inline-code" {...props}>{children}</code>;
          },
          table({ children, node, ref, ...props }) {
            return <div className="md-table-wrapper"><table {...props}>{children}</table></div>;
          },
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}

/* ===== Artifact Renderers ===== */

function ArtifactTable({ data }) {
  function downloadCSV() {
    const header = data.columns.join(",");
    const rows = data.rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title || "table"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="artifact-table-view">
      <div className="artifact-table-actions">
        <button className="artifact-download-btn" onClick={downloadCSV}>Download CSV</button>
      </div>
      <div className="md-table-wrapper">
        <table>
          <thead><tr>{data.columns.map((col, i) => <th key={i}>{col}</th>)}</tr></thead>
          <tbody>{data.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function ArtifactKPI({ data }) {
  return (
    <div className="artifact-kpi-grid">
      {data.metrics.map((m, i) => (
        <div key={i} className={`kpi-card kpi-${m.accent || "default"}`}>
          <div className="kpi-value">{m.value}</div>
          <div className="kpi-label">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

function ArtifactFindings({ data }) {
  return (
    <ul className="artifact-findings-list">
      {data.items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

function ArtifactRenderer({ artifact }) {
  if (!artifact) return null;
  switch (artifact.type) {
    case "chart": return <ChatChart chartData={artifact.data} />;
    case "table": return <ArtifactTable data={artifact} />;
    case "kpi": return <ArtifactKPI data={artifact} />;
    case "findings": return <ArtifactFindings data={artifact} />;
    default: return <p>Unknown artifact type: {artifact.type}</p>;
  }
}

/* ===== Artifact Panel ===== */

function ArtifactPanel({ artifacts, activeTab, onTabChange, onClose, panelWidth, onResizeStart }) {
  if (!artifacts || artifacts.length === 0) return null;
  const artifact = artifacts[activeTab] || artifacts[0];

  return (
    <>
      <div className="resize-handle" onMouseDown={onResizeStart} />
      <div className="artifact-panel" style={{ width: panelWidth }}>
        <div className="artifact-panel-header">
          <span className="artifact-panel-title">
            Artifacts <span className="artifact-badge">{artifacts.length}</span>
          </span>
          <button className="artifact-action-btn" onClick={onClose} title="Close panel">&#10005;</button>
        </div>
        {artifacts.length > 1 && (
          <div className="artifact-tabs">
            {artifacts.map((a, i) => (
              <button key={i} className={`artifact-tab ${i === activeTab ? "active" : ""}`} onClick={() => onTabChange(i)}>
                {a.title || ARTIFACT_TYPE_LABELS[a.type] || `Tab ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        <div className="artifact-content">
          <ArtifactRenderer artifact={artifact} />
        </div>
      </div>
    </>
  );
}

/* ===== Thinking Block ===== */

function ThinkingBlock({ events, isStreaming }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isStreaming) setIsOpen(true);
  }, [isStreaming]);

  if (!events || events.length === 0) return null;

  return (
    <div className="thinking-block">
      <button className="thinking-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "\u25BE" : "\u25B8"} {events.length} step{events.length !== 1 ? "s" : ""}
        {isStreaming && (
          <span className="thinking-dots-inline">
            <span></span><span></span><span></span>
          </span>
        )}
      </button>
      {isOpen && (
        <div className="thinking-content">
          {events.map((e, i) => (
            <div key={i} className="thinking-event">
              <span className="thinking-tool">
                {e.tool === "execute_sql" ? "SQL" : e.tool?.replace("build_", "").toUpperCase()}
              </span>
              <span className="thinking-desc">{e.description}</span>
              <span className="thinking-meta">
                {e.rows !== undefined ? `${e.rows} rows \u00B7 ` : ""}{e.ms}ms
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== Main Chat Panel ===== */

export function ChatPanel() {
  const { user, apiCall } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reactions, setReactions] = useState({});
  const [copiedMsg, setCopiedMsg] = useState(null);

  // Artifact panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelArtifacts, setPanelArtifacts] = useState(null);
  const [activeArtifactTab, setActiveArtifactTab] = useState(0);
  const [panelWidth, setPanelWidth] = useState(480);
  const resizing = useRef(false);

  // Sidebar (desktop: collapsible + resizable, mobile: drawer)
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const sidebarResizing = useRef(false);

  // Streaming
  const abortRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);

  // Only auto-scroll when actively chatting (sending/streaming), not on session load
  const shouldAutoScroll = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll.current && messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, []);

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Resize handles (sidebar + artifact panel)
  useEffect(() => {
    function onMouseMove(e) {
      if (sidebarResizing.current) {
        setSidebarWidth(Math.min(480, Math.max(200, e.clientX)));
      } else if (resizing.current) {
        setPanelWidth(Math.min(800, Math.max(320, window.innerWidth - e.clientX)));
      }
    }
    function onMouseUp() {
      resizing.current = false;
      sidebarResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Esc to cancel generation
  useEffect(() => {
    function handleKeyUp(e) {
      if (e.key === "Escape" && sending && abortRef.current) {
        abortRef.current.abort();
      }
    }
    document.addEventListener("keyup", handleKeyUp);
    return () => document.removeEventListener("keyup", handleKeyUp);
  }, [sending]);

  function handleResizeStart(e) {
    resizing.current = true;
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleSidebarResizeStart(e) {
    sidebarResizing.current = true;
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function toggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

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
        const mapped = data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.message_id || crypto.randomUUID(),
            role: m.role,
            content: m.content,
            chart_data: m.chart_data,
            artifacts: m.metadata?.artifacts || null,
            thinking: m.metadata?.thinking || null,
          }));
        // Normalize chart_data into artifacts if no artifacts exist
        mapped.forEach((m) => {
          if (m.chart_data && (!m.artifacts || m.artifacts.length === 0)) {
            m.artifacts = [{ type: "chart", title: "Chart", data: m.chart_data }];
          }
        });
        setMessages(mapped);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }

  function handleSelectSession(sessionId) {
    shouldAutoScroll.current = false;
    setActiveSessionId(sessionId);
    setReactions({});
    setCopiedMsg(null);
    setPanelOpen(false);
    loadSessionMessages(sessionId);
  }

  function handleNewChat() {
    shouldAutoScroll.current = false;
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
    setReactions({});
    setCopiedMsg(null);
    setPanelOpen(false);
    setSessionMenu(null);
    setRenamingSession(null);
  }

  // Session management
  const [sessionMenu, setSessionMenu] = useState(null); // session_id of open menu
  const [renamingSession, setRenamingSession] = useState(null); // {id, title}

  async function handleDeleteSession(sessionId) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      const result = await apiCall(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      if (result?.error) {
        console.error("Delete failed:", result.error);
        alert("Failed to delete: " + result.error);
        setSessionMenu(null);
        return;
      }
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
      alert("Failed to delete conversation.");
    }
    setSessionMenu(null);
  }

  function startRename(session) {
    setRenamingSession({ id: session.session_id, title: session.title || "" });
    setSessionMenu(null);
  }

  async function submitRename() {
    if (!renamingSession) return;
    const { id, title } = renamingSession;
    if (!title.trim()) { setRenamingSession(null); return; }
    try {
      const result = await apiCall(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim() }),
      });
      if (result?.error) {
        console.error("Rename failed:", result.error);
      } else {
        setSessions((prev) => prev.map((s) =>
          s.session_id === id ? { ...s, title: title.trim() } : s
        ));
      }
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
    setRenamingSession(null);
  }

  // Helper to update the last message in state
  function updateLastMessage(updater) {
    setMessages((prev) => {
      const updated = [...prev];
      const last = { ...updated[updated.length - 1] };
      updater(last);
      updated[updated.length - 1] = last;
      return updated;
    });
  }

  // Non-streaming send (reliable fallback)
  async function sendDirect(text) {
    try {
      const data = await apiCall("/api/chat/message", {
        method: "POST",
        body: JSON.stringify({ message: text, session_id: activeSessionId }),
      });
      if (data?.error) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.error, isError: true }]);
      } else {
        if (!activeSessionId && data?.session_id) {
          setActiveSessionId(data.session_id);
          loadSessions();
        }
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data?.response || "No response.",
          chart_data: data?.chart_data || null,
          artifacts: data?.artifacts || null,
          thinking: data?.thinking || null,
        }]);
      }
    } catch (err) {
      console.error("Send error:", err);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Something went wrong. Please try again.",
        isError: true,
      }]);
    }
  }

  async function sendMessage(text) {
    if (!text || sending) return;

    shouldAutoScroll.current = true;
    // Auto-collapse sidebar on first message in a new chat
    if (!activeSessionId) setSidebarCollapsed(true);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
    setInput("");
    setSending(true);

    const token = localStorage.getItem("authToken");
    const controller = new AbortController();
    abortRef.current = controller;

    // Try streaming endpoint first
    let streamResponse = null;
    try {
      streamResponse = await fetch(`${BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, session_id: activeSessionId }),
        signal: controller.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") {
        setSending(false);
        return;
      }
      // Network error — will fall back below
    }

    const isSSE = streamResponse?.ok &&
      (streamResponse.headers.get("content-type") || "").includes("text/event-stream");

    if (isSSE) {
      // === Streaming path ===
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "", streaming: true, thinking: [] }]);
      // Track session ID from the stream (closure-safe for new sessions)
      let streamSessionId = activeSessionId;

      try {
        const reader = streamResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ") && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                switch (currentEvent) {
                  case "session":
                    if (data.session_id) {
                      streamSessionId = data.session_id;
                      if (!activeSessionId) {
                        setActiveSessionId(data.session_id);
                        loadSessions();
                      }
                    }
                    break;
                  case "thinking":
                    updateLastMessage((msg) => { msg.thinking = [...(msg.thinking || []), data]; });
                    break;
                  case "text":
                    updateLastMessage((msg) => { msg.content += data.token; });
                    break;
                  case "artifacts":
                    updateLastMessage((msg) => { msg.artifacts = data.artifacts; });
                    break;
                  case "chart":
                    updateLastMessage((msg) => {
                      msg.artifacts = [...(msg.artifacts || []), { type: "chart", title: "Chart", data: data.chart_data }];
                    });
                    break;
                  case "title":
                    if (data.title && streamSessionId) {
                      setSessions((prev) => prev.map((s) =>
                        s.session_id === streamSessionId ? { ...s, title: data.title } : s
                      ));
                    }
                    break;
                  case "processing":
                    updateLastMessage((msg) => {
                      msg.thinking = [...(msg.thinking || []), { tool: "system", description: data.status, ms: 0 }];
                    });
                    break;
                  case "done":
                    updateLastMessage((msg) => { msg.streaming = false; });
                    break;
                  case "error":
                    updateLastMessage((msg) => { msg.content = data.error; msg.streaming = false; msg.isError = true; });
                    break;
                  default: break;
                }
              } catch {}
              currentEvent = null;
            }
          }
        }
        updateLastMessage((msg) => { msg.streaming = false; });
      } catch (err) {
        if (err.name === "AbortError") {
          updateLastMessage((msg) => { msg.streaming = false; if (!msg.content) msg.content = "Generation cancelled."; });
        } else {
          updateLastMessage((msg) => { msg.content = "Something went wrong."; msg.streaming = false; msg.isError = true; });
        }
      }
    } else {
      // === Non-streaming fallback ===
      await sendDirect(text);
    }

    setSending(false);
    abortRef.current = null;
  }

  function handleSend() {
    sendMessage(input.trim());
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleChipClick(query) {
    sendMessage(query);
  }

  function handleCopyMessage(msgId, content) {
    navigator.clipboard.writeText(content);
    setCopiedMsg(msgId);
    setTimeout(() => setCopiedMsg(null), 2000);
  }

  async function handleRetry(msgIndex) {
    const userMsgIndex = msgIndex - 1;
    if (userMsgIndex < 0 || messages[userMsgIndex]?.role !== "user") return;
    const text = messages[userMsgIndex].content;
    // Remove both the user message and the failed assistant message
    setMessages((prev) => prev.slice(0, userMsgIndex));
    // sendMessage will re-add the user message and stream the response
    sendMessage(text);
  }

  function handleReaction(msgId, type) {
    setReactions((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? null : type,
    }));
  }

  function openArtifacts(artifacts, tabIndex = 0) {
    setPanelArtifacts(artifacts);
    setActiveArtifactTab(tabIndex);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  const initials = user?.username ? user.username[0].toUpperCase() : "U";
  const sessionGroups = groupSessionsByDate(sessions);

  return (
    <div className={`chat-wrapper ${panelOpen ? "chat-with-panel" : ""}`}>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? "\u2715" : "\u2630"}
        </button>
        <span className="mobile-title">OMNIFEED AI</span>
        <button className="hamburger-btn" onClick={handleNewChat}>+</button>
      </div>

      {/* Sidebar */}
      <aside
        className={`chat-sidebar ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}
        style={!sidebarCollapsed ? { width: sidebarWidth } : undefined}
      >
        <div className="chat-sidebar-header">
          <h3>AI Chat</h3>
          <button className="new-chat-btn" onClick={handleNewChat}>+ New Chat</button>
        </div>
        <div className="chat-session-list">
          {sessionGroups.map((group) => (
            <div key={group.label}>
              <div className="session-group-label">{group.label}</div>
              {group.sessions.map((s) => (
                <div key={s.session_id} className={`chat-session-item ${activeSessionId === s.session_id ? "active" : ""}`}>
                  {renamingSession?.id === s.session_id ? (
                    <input
                      className="session-rename-input"
                      value={renamingSession.title}
                      onChange={(e) => setRenamingSession({ ...renamingSession, title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename();
                        if (e.key === "Escape") setRenamingSession(null);
                      }}
                      onBlur={submitRename}
                      autoFocus
                    />
                  ) : (
                    <button className="session-item-btn" onClick={() => handleSelectSession(s.session_id)}>
                      <span className="chat-session-title">{s.title || "Untitled"}</span>
                      <span className="chat-session-date">{new Date(s.updated_at).toLocaleDateString()}</span>
                    </button>
                  )}
                  <div className="session-actions">
                    <button
                      className="session-menu-btn"
                      onClick={(e) => { e.stopPropagation(); setSessionMenu(sessionMenu === s.session_id ? null : s.session_id); }}
                    >
                      &#8943;
                    </button>
                    {sessionMenu === s.session_id && (
                      <div className="session-menu">
                        <button onClick={() => startRename(s)}>Rename</button>
                        <button className="session-menu-delete" onClick={() => handleDeleteSession(s.session_id)}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {sessions.length === 0 && (
            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem", padding: "1rem" }}>
              No conversations yet
            </p>
          )}
        </div>
      </aside>

      {/* Sidebar resize handle + toggle */}
      {!sidebarCollapsed && (
        <div className="sidebar-resize-handle" onMouseDown={handleSidebarResizeStart} />
      )}
      <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}>
        {sidebarCollapsed ? "\u276F" : "\u276E"}
      </button>

      {/* Main Chat */}
      <div className="chat-main">
        <div className="chat-messages" ref={messagesContainerRef}>
          <div className="messages-column">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">OMNIFEED AI</div>
              <p>Your construction intelligence assistant. Ask about snags, sites, performance, or trends.</p>
              <div className="suggestion-chips">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button key={chip.label} className="chip" onClick={() => handleChipClick(chip.query)} disabled={sending}>
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={msg.id || i} className={`chat-message ${msg.role}`}>
                <div className="chat-avatar">
                  {msg.role === "user" ? initials : "AI"}
                </div>
                <div className="chat-message-body">
                  {/* Thinking block (above bubble for assistant) */}
                  {msg.role === "assistant" && msg.thinking && msg.thinking.length > 0 && (
                    <ThinkingBlock events={msg.thinking} isStreaming={msg.streaming} />
                  )}

                  <div className={`chat-bubble ${msg.streaming ? "streaming" : ""} ${msg.isError ? "error-bubble" : ""}`}>
                    {msg.role === "user" ? (
                      msg.content
                    ) : msg.streaming && !msg.content ? (
                      <div className="streaming-placeholder">
                        <div className="thinking-dots"><span></span><span></span><span></span></div>
                      </div>
                    ) : msg.isError ? (
                      <div className="error-content">
                        <p>{msg.content}</p>
                        <div className="error-actions">
                          <button className="error-retry-btn" onClick={() => handleRetry(i)} disabled={sending}>Retry</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <MessageContent content={msg.content} />
                        {msg.streaming && msg.content && <span className="streaming-cursor" />}
                      </>
                    )}
                  </div>

                  {msg.chart_data && !msg.artifacts && !msg.streaming && (
                    <ChatChart chartData={msg.chart_data} />
                  )}

                  {msg.artifacts && msg.artifacts.length > 0 && !msg.streaming && (
                    <div className="artifact-triggers">
                      {msg.artifacts.map((a, j) => (
                        <button key={j} className="artifact-trigger" onClick={() => openArtifacts(msg.artifacts, j)}>
                          View: {a.title || ARTIFACT_TYPE_LABELS[a.type] || "Artifact"}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.role === "assistant" && !msg.streaming && !msg.isError && (
                    <div className="message-actions">
                      <button className="msg-action-btn" onClick={() => handleCopyMessage(msg.id, msg.content)}>
                        {copiedMsg === msg.id ? "Copied" : "Copy"}
                      </button>
                      <button className="msg-action-btn" onClick={() => handleRetry(i)} disabled={sending}>Retry</button>
                      <button className={`msg-action-btn ${reactions[msg.id] === "up" ? "active" : ""}`} onClick={() => handleReaction(msg.id, "up")}>&#9650;</button>
                      <button className={`msg-action-btn ${reactions[msg.id] === "down" ? "active" : ""}`} onClick={() => handleReaction(msg.id, "down")}>&#9660;</button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          </div>{/* end messages-column */}
        </div>

        {/* Input */}
        <div className="chat-input-bar">
          <div className="input-bar-inner">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sending ? "Generating response..." : "Ask about snags, sites, reports..."}
            rows={1}
            disabled={sending}
          />
          {sending ? (
            <button className="chat-stop-btn" onClick={() => abortRef.current?.abort()}>
              Stop
            </button>
          ) : (
            <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>
              Send
            </button>
          )}
          </div>{/* end input-bar-inner */}
        </div>
        {sending && (
          <div className="chat-hint">Press Esc to stop generation</div>
        )}
      </div>

      {/* Artifact Panel */}
      {panelOpen && panelArtifacts && (
        <ArtifactPanel
          artifacts={panelArtifacts}
          activeTab={activeArtifactTab}
          onTabChange={setActiveArtifactTab}
          onClose={closePanel}
          panelWidth={panelWidth}
          onResizeStart={handleResizeStart}
        />
      )}
    </div>
  );
}
