/**
 * Badge/Pill — tinted background + colored text at rest.
 * Section 11.2: muted tint rules differ from Shadcn Badge.
 *
 * Renders status with icon + text label (WCAG 1.4.1: never color alone).
 */
"use client";

import { Check, AlertTriangle, ShieldX, Clock, Zap, Info } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "brand";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "md";
  style?: CSSProperties;
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  success: {
    bg: "var(--color-success-subtle)",
    color: "var(--color-success)",
    border: "transparent",
  },
  warning: {
    bg: "var(--color-warning-subtle)",
    color: "var(--color-warning)",
    border: "transparent",
  },
  error: {
    bg: "var(--color-error-subtle)",
    color: "var(--color-error)",
    border: "transparent",
  },
  info: {
    bg: "var(--color-info-subtle)",
    color: "var(--color-info)",
    border: "transparent",
  },
  neutral: {
    bg: "var(--color-surface-secondary)",
    color: "var(--color-text-secondary)",
    border: "var(--color-border-default)",
  },
  brand: {
    bg: "rgba(90, 75, 214, 0.08)",
    color: "var(--color-brand)",
    border: "transparent",
  },
};

/** Map shadow verdict strings to badge variants */
export function verdictVariant(verdict?: string): BadgeVariant {
  switch (verdict) {
    case "GREEN": return "success";
    case "YELLOW": return "warning";
    case "RED": return "error";
    default: return "neutral";
  }
}

/** Map lifecycle state to badge variant */
export function lifecycleVariant(state?: string): BadgeVariant {
  switch (state) {
    case "RESOLVED":
    case "CLOSED":
      return "success";
    case "PENDING_REVIEW":
    case "ESCALATED":
    case "AUDITING":
      return "warning";
    case "BLOCKED":
    case "REJECTED":
    case "FAILED":
      return "error";
    case "EXECUTING":
    case "CLASSIFYING":
      return "info";
    default:
      return "neutral";
  }
}

/** Map root cause strings to badge variants (visual mapping with fallback) */
export function rootCauseVariant(cause?: string): BadgeVariant {
  switch (cause) {
    case "PROMO_EXPIRED": return "warning";
    case "ERP_NOT_LOADED": return "error";
    case "MASTER_DATA": return "brand";
    case "CONTRACT_GAP": return "info";
    case "EDI_MISMATCH": return "info";
    case "UOM_ERROR": return "error";
    default: return "neutral";
  }
}

/** Map inbox category strings to badge variants (visual mapping with fallback) */
export function categoryVariant(category?: string): BadgeVariant {
  switch (category) {
    case "ORDER_CHANGE": return "brand";
    case "SHIPMENT_INQUIRY": return "info";
    case "NEW_ORDER": return "success";
    case "COMPLAINT": return "error";
    case "INVOICE_QUERY": return "warning";
    default: return "neutral";
  }
}

/** Map inbox status strings to badge variants (visual mapping with fallback) */
export function inboxStatusVariant(status?: string): BadgeVariant {
  switch (status) {
    case "NEEDS_APPROVAL": return "warning";
    case "IN_QUEUE": return "neutral";
    case "AUTO_RESOLVED": return "success";
    case "ESCALATED": return "error";
    case "ANALYZING": return "info";
    default: return "neutral";
  }
}

/** Default icon per variant (WCAG: status not conveyed by color alone) */
const DEFAULT_ICONS: Record<BadgeVariant, ReactNode> = {
  success: <Check size={12} />,
  warning: <AlertTriangle size={12} />,
  error: <ShieldX size={12} />,
  info: <Info size={12} />,
  neutral: <Clock size={12} />,
  brand: <Zap size={12} />,
};

export function Badge({ variant = "neutral", children, icon, size = "sm", style }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  const displayIcon = icon !== undefined ? icon : DEFAULT_ICONS[variant];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size === "sm" ? 4 : 6,
        padding: size === "sm" ? "2px 8px" : "4px 10px",
        borderRadius: "var(--radius-full)",
        background: v.bg,
        color: v.color,
        border: v.border !== "transparent" ? `1px solid ${v.border}` : "none",
        fontSize: size === "sm" ? "var(--font-size-label)" : "var(--font-size-caption)",
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {displayIcon}
      {children}
    </span>
  );
}
