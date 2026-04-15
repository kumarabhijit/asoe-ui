/**
 * Shared helper components for exception detail sub-components.
 */
"use client";

import { ChevronDown } from "lucide-react";

/* ── Badge variant styles ──────────────────────────────────────────────── */

const BADGE_VARIANT_STYLES: Record<string, { bg: string; color: string }> = {
  success: { bg: "var(--color-success-subtle)", color: "var(--color-success)" },
  error: { bg: "var(--color-error-subtle)", color: "var(--color-error)" },
  info: { bg: "var(--color-info-subtle)", color: "var(--color-info)" },
  neutral: { bg: "var(--color-surface-secondary)", color: "var(--color-text-tertiary)" },
};

/** Collapsible section header — matches Evidence Detail card pattern */
export function CollapsibleHeader({ title, open, onToggle, badge, badgeVariant = "neutral" }: {
  title: string;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  badgeVariant?: string;
}) {
  const bv = BADGE_VARIANT_STYLES[badgeVariant] ?? BADGE_VARIANT_STYLES.neutral;
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-10) var(--space-16)",
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
        <ChevronDown
          size={14}
          style={{
            color: "var(--color-text-tertiary)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform var(--dur-fast)",
          }}
        />
        <span
          style={{
            fontSize: "var(--font-size-subhead)",
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </span>
        {badge && (
          <span
            style={{
              fontSize: "var(--font-size-label)",
              fontWeight: 600,
              color: bv.color,
              background: bv.bg,
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
            }}
          >
            {badge}
          </span>
        )}
      </div>
    </button>
  );
}

/** Price formatting helper */
export function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
