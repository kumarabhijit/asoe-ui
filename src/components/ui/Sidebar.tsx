/**
 * Sidebar — 480px intervention panel, slides right.
 * Section 11.2: primary Layer 2 surface for exception detail.
 */
"use client";

import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { X, Maximize2 } from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  /** Called when the expand button is clicked (opens full-page view) */
  onExpand?: () => void;
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function Sidebar({ open, onClose, onExpand, title, children, style }: SidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap: focus sidebar on open
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.15)",
            zIndex: "var(--z-overlay)",
            animation: "fadeIn var(--dur-fast) var(--ease-out)",
          }}
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Detail panel"}
        tabIndex={-1}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "var(--sidebar-width)",
          maxWidth: "100vw",
          background: "var(--color-surface-primary)",
          boxShadow: open ? "var(--shadow-xl)" : "none",
          borderLeft: "1px solid var(--color-border-default)",
          zIndex: "var(--z-modal)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform var(--dur-normal) var(--ease-out)",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          ...style,
        }}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-16) var(--space-20)",
              borderBottom: "1px solid var(--color-border-default)",
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontSize: "var(--font-size-subhead)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: 0,
              }}
            >
              {title}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              {onExpand && (
                <button
                  onClick={onExpand}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--color-text-tertiary)",
                    padding: "var(--space-4)",
                    display: "flex",
                    borderRadius: "var(--radius-sm)",
                    transition: "color var(--dur-fast)",
                  }}
                  aria-label="Open full page"
                  title="Open full page"
                >
                  <Maximize2 size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--color-text-tertiary)",
                  padding: "var(--space-4)",
                  display: "flex",
                  borderRadius: "var(--radius-sm)",
                  transition: "color var(--dur-fast)",
                }}
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "var(--space-20)",
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
