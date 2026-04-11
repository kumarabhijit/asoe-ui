/**
 * Toast — 4.5s auto-dismiss, status-colored.
 * Section 11.2: the only solid-fill element in the design system.
 */
"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { X, Check, AlertTriangle, ShieldX, Info } from "lucide-react";

type ToastVariant = "success" | "warning" | "error" | "info";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (variant: ToastVariant, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: ReactNode }> = {
  success: { bg: "var(--color-success)", icon: <Check size={16} /> },
  warning: { bg: "var(--color-warning)", icon: <AlertTriangle size={16} /> },
  error: { bg: "var(--color-error)", icon: <ShieldX size={16} /> },
  info: { bg: "var(--color-info)", icon: <Info size={16} /> },
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const v = VARIANT_STYLES[item.variant];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.duration || 4500);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-10)",
        padding: "var(--space-12) var(--space-16)",
        background: v.bg,
        color: "#fff",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-lg)",
        fontSize: "var(--font-size-body)",
        fontWeight: 500,
        animation: "toastSlideIn var(--dur-normal) var(--ease-out)",
        maxWidth: 400,
      }}
    >
      <span style={{ flexShrink: 0, display: "flex" }}>{v.icon}</span>
      <span style={{ flex: 1 }}>{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.8)",
          padding: 2,
          display: "flex",
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((variant: ToastVariant, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, variant, message, duration }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "var(--space-24)",
            right: "var(--space-24)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-8)",
            zIndex: "var(--z-toast)",
          }}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
