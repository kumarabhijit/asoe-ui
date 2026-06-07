/**
 * MetricTile — KPI display: icon (40x40 tinted bg) + label + monospace value + subtitle.
 * Section 11.2: part of the metrics strip on the Exception Queue page.
 */
"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface MetricTileProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  /**
   * Icon-container background. Contract: pass a **saturated/dark** colour —
   * the icon is rendered in `--color-surface-primary` on top of it, so a
   * light tint (e.g. a `--color-*-subtle` token) would make the icon read
   * light-on-light and effectively invisible. When omitted, the tile falls
   * back to the neutral secondary-surface treatment with a readable icon.
   */
  tint?: string;
  className?: string;
}

export function MetricTile({ icon, label, value, subtitle, tint, className }: MetricTileProps) {
  // One composed accessible name so a screen reader announces the tile as a
  // single coherent stop ("Open exceptions: 42, last 24h") instead of three
  // loose, unassociated spans. Mirrors ConfidenceDisplay's group treatment.
  const groupLabel = [label, String(value), subtitle].filter(Boolean).join(": ");
  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn("flex items-center gap-12 p-16 bg-surface-primary rounded-md shadow-sm min-w-[180px]", className)}
    >
      {/* Icon container — 40x40 with tinted background */}
      <div
        aria-hidden="true"
        className="w-[40px] h-[40px] rounded-sm flex items-center justify-center shrink-0"
        style={{
          background: tint || "var(--color-surface-secondary)",
          color: tint ? "var(--color-surface-primary)" : "var(--color-text-secondary)",
        }}
      >
        {icon}
      </div>

      {/* Text content */}
      <div className="flex flex-col gap-px min-w-0">
        <span className="text-label font-semibold uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
        {/* The dedicated monospace-metric scale (24px) the token set intends
            for KPI numbers — was under-emphasised at `--font-size-heading`. */}
        <span
          className="text-text-primary font-mono"
          style={{
            fontSize: "var(--font-size-mono-metric)",
            fontWeight: "var(--font-weight-mono-metric)",
            lineHeight: "var(--line-height-mono-metric)",
          }}
        >
          {value}
        </span>
        {subtitle && (
          <span className="text-label text-text-quaternary font-medium">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
