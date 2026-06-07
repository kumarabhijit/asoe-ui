/**
 * Toast — 4.5s auto-dismiss, status-colored.
 * Section 11.2: the only solid-fill element in the design system.
 */
"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { X, Check, AlertTriangle, ShieldX, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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

const VARIANT_CONFIG: Record<ToastVariant, { className: string; icon: ReactNode }> = {
  success: { className: "bg-success", icon: <Check size={16} /> },
  warning: { className: "bg-warning", icon: <AlertTriangle size={16} /> },
  error: { className: "bg-error", icon: <ShieldX size={16} /> },
  info: { className: "bg-info", icon: <Info size={16} /> },
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const v = VARIANT_CONFIG[item.variant];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.duration || 4500);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  // Errors/warnings interrupt (assertive + alert); success/info wait their
  // turn (polite + status). A failure the operator must act on shouldn't sit
  // silently behind other announcements.
  const isUrgent = item.variant === "error" || item.variant === "warning";

  return (
    <div
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
      className={cn(
        "flex items-center gap-10 px-16 py-12 [color:white] rounded-md shadow-lg text-body font-medium max-w-[400px] animate-in slide-in-from-right-6 duration-normal",
        v.className,
      )}
    >
      <span className="shrink-0 flex">{v.icon}</span>
      <span className="flex-1">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss"
        className="bg-transparent border-none cursor-pointer text-white/80 p-px flex shrink-0 hover:text-white"
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
      {toasts.length > 0 && (
        <div className="fixed bottom-24 right-24 flex flex-col gap-8 z-toast">
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
