// VerdictDot — compact R/A/G audit-verdict indicator for queue rows.
//
// ADR-041 P3e §2.4. The shadow-rollup `audit_verdict_color` on
// `CaseListItem` projects R/A/G; this primitive renders that letter
// alongside a colored dot so the indicator fits into a 360px queue
// row next to the existing origin / SLA / status chips.
//
// WCAG 1.4.1 — colour is never the sole carrier. The single-letter
// label is the icon pair; `aria-label` carries the spoken form
// ("Audit verdict: Red") so screen-reader users get the same scan
// signal.

"use client";

import { cn } from "@/lib/utils";

export type VerdictColor = "R" | "A" | "G";

export interface VerdictDotProps {
  color: VerdictColor;
  size?: "sm" | "md";
  className?: string;
}

const COLOR_LABEL: Record<VerdictColor, string> = {
  R: "Red",
  A: "Amber",
  G: "Green",
};

// Bound to existing semantic tokens — Guardrail #2. The dot fill
// and the letter share the same hue so the shape reads as a single
// unit at sm size where the dot is 8px.
const COLOR_TOKEN: Record<VerdictColor, string> = {
  R: "var(--color-error)",
  A: "var(--color-warning)",
  G: "var(--color-success)",
};

const SIZE_CLASS: Record<"sm" | "md", string> = {
  sm: "gap-1 text-label",
  md: "gap-1.5 text-caption",
};

const DOT_SIZE: Record<"sm" | "md", string> = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
};

export function VerdictDot({ color, size = "sm", className }: VerdictDotProps) {
  return (
    <span
      role="img"
      aria-label={`Audit verdict: ${COLOR_LABEL[color]}`}
      className={cn(
        "inline-flex items-center font-semibold leading-snug whitespace-nowrap",
        SIZE_CLASS[size],
        className,
      )}
      style={{ color: COLOR_TOKEN[color] }}
    >
      <span
        aria-hidden
        className={cn("rounded-full inline-block shrink-0", DOT_SIZE[size])}
        style={{ backgroundColor: COLOR_TOKEN[color] }}
      />
      {color}
    </span>
  );
}
