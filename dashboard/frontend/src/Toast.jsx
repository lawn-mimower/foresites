import React, { useEffect, useState } from "react";

export function showToast(message, type = "info", durationMs = 3000, action = null) {
  const event = new CustomEvent("app:toast", {
    detail: { id: Math.random().toString(36).slice(2), message, type, durationMs, action },
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
      // Skip auto-dismiss for action toasts (durationMs === 0)
      if (!toast.action && toast.durationMs !== 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, toast.durationMs || 3000);
      }
    };
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }, []);

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'grid', gap: 6, zIndex: 9999 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => {
            if (t.action) {
              t.action();
              dismiss(t.id);
            }
          }}
          style={{
            background: 'var(--ink-900)',
            color: 'white',
            padding: '12px 16px',
            borderLeft: `3px solid ${borderFor(t.type)}`,
            boxShadow: 'var(--shadow-lg)',
            minWidth: 260,
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: t.action ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={t.action ? { textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.4)', textUnderlineOffset: '2px' } : undefined}>
            {t.message}
          </span>
          {t.action && (
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 2px',
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
