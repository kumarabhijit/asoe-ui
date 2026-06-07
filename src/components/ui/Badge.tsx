/**
 * Badge/Pill — tinted background + colored text at rest.
 * Section 11.2: muted tint rules differ from Shadcn Badge.
 *
 * Renders status with icon + text label (WCAG 1.4.1: never color alone).
 */
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, AlertTriangle, ShieldX, Clock, Zap, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full font-semibold leading-snug tracking-wide",
  {
    variants: {
      variant: {
        success: "bg-success-subtle text-success",
        warning: "bg-warning-subtle text-warning",
        error: "bg-error-subtle text-error",
        info: "bg-info-subtle text-info",
        neutral: "bg-surface-secondary text-text-secondary border border-border",
        brand: "bg-brand-subtle text-brand",
      },
      size: {
        sm: "gap-1 px-2 py-px text-label",
        md: "gap-1.5 px-2.5 py-0.5 text-caption",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "sm",
    },
  },
);

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "brand";

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: "sm" | "md";
}

/* ── Variant mappers (visual mapping with default fallback) ────────── */

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
    case "PENDING_ADMIN_REVIEW":
    case "PENDING_COSIGN":
    case "AUDITING":
      return "warning";
    case "BLOCKED":
    case "REJECTED":
    case "FAILED":
      return "error";
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

/** Map a badge variant to its primary CSS colour token, for non-badge
 *  surfaces (bars, sparklines, dots) that need the raw colour rather than
 *  the tinted badge classes. Default-safe via the BadgeVariant union, so
 *  callers route enum→colour through {@link verdictVariant} et al. instead
 *  of branching on raw enum literals (Guardrail #2). */
const VARIANT_COLOR_VAR: Record<BadgeVariant, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  info: "var(--color-info)",
  brand: "var(--color-brand)",
  neutral: "var(--color-text-tertiary)",
};

export function variantColorVar(variant: BadgeVariant): string {
  return VARIANT_COLOR_VAR[variant];
}

/** Default icon per variant (WCAG: status not conveyed by color alone) */
const DEFAULT_ICONS: Record<BadgeVariant, React.ReactNode> = {
  success: <Check size={12} />,
  warning: <AlertTriangle size={12} />,
  error: <ShieldX size={12} />,
  info: <Info size={12} />,
  neutral: <Clock size={12} />,
  brand: <Zap size={12} />,
};

function Badge({ className, variant = "neutral", size = "sm", children, icon, ...props }: BadgeProps) {
  const displayIcon = icon !== undefined ? icon : DEFAULT_ICONS[variant];

  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {displayIcon}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps, BadgeVariant };
