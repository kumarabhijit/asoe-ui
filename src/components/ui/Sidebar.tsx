/**
 * Sidebar — 480px intervention panel, slides right.
 * Section 11.2: primary Layer 2 surface for exception detail.
 */
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onExpand?: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Sidebar({ open, onClose, onExpand, title, children, className }: SidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/15 z-sidebar animate-in fade-in duration-fast"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Detail panel"}
        tabIndex={-1}
        className={cn(
          "fixed top-0 right-0 bottom-0 w-[var(--sidebar-width)] max-w-[100vw] bg-surface-primary border-l border-border z-modal flex flex-col outline-none transition-transform duration-normal ease-out",
          open ? "translate-x-0 shadow-xl" : "translate-x-full",
          className,
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-20 py-16 border-b border-border shrink-0">
            <h2 className="text-subhead font-semibold text-text-primary m-0">
              {title}
            </h2>
            <div className="flex items-center gap-4">
              {onExpand && (
                <button
                  onClick={onExpand}
                  className="bg-transparent border-none cursor-pointer text-text-tertiary flex items-center justify-center min-w-[44px] min-h-[44px] rounded-sm transition-colors duration-fast hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                  aria-label="Open full page"
                  title="Open full page"
                >
                  <Maximize2 size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="bg-transparent border-none cursor-pointer text-text-tertiary flex items-center justify-center min-w-[44px] min-h-[44px] rounded-sm transition-colors duration-fast hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring"
                aria-label="Close panel"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-20">
          {children}
        </div>
      </div>
    </>
  );
}
