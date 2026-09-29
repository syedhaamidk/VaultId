import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastCtx = createContext(() => {});

/* ToastProvider — wraps your app once; useToast() fires blueprint toasts.
   toast(message) or toast(message, { label, run }) for an action button. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, action) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, action }]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
      );
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 240);
    }, 2800);
  }, []);
  const value = useMemo(() => toast, [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.leaving ? " is-leaving" : ""}`}>
            <span>{t.message}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  if (t.action.run) t.action.run();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
