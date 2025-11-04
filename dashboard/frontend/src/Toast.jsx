import React, { useEffect, useState } from "react";

export function showToast(message, type = "info", durationMs = 3000) {
  const event = new CustomEvent("app:toast", {
    detail: { id: Math.random().toString(36).slice(2), message, type, durationMs },
  });
  window.dispatchEvent(event);
}

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

  const bgFor = (type) => {
    if (type === "success") return "#16a34a";
    if (type === "error") return "#dc2626";
    if (type === "warning") return "#f59e0b";
    return "#2563eb";
  };

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'grid', gap: 8, zIndex: 9999 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: bgFor(t.type), color: 'white', padding: '10px 14px', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 240 }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}


