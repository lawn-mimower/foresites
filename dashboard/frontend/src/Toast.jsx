import React, { useEffect, useState } from "react";

export function showToast(message, type = "info", durationMs = 3000) {
  const event = new CustomEvent("app:toast", {
    detail: { id: Math.random().toString(36).slice(2), message, type, durationMs },
  });
  window.dispatchEvent(event);
}

const borderFor = (type) => {
  if (type === "success") return "var(--success)";
  if (type === "error") return "var(--brand-red)";
  if (type === "warning") return "var(--warning)";
  return "var(--info)";
};

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const toast = e.detail;
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.durationMs || 3000);
    };
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }, []);

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'grid', gap: 6, zIndex: 9999 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: 'var(--ink-900)',
          color: 'white',
          padding: '12px 16px',
          borderLeft: `3px solid ${borderFor(t.type)}`,
          boxShadow: 'var(--shadow-lg)',
          minWidth: 260,
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
