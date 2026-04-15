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
  tint?: string;
  className?: string;
}

export function MetricTile({ icon, label, value, subtitle, tint, className }: MetricTileProps) {
  return (
    <div className={cn("flex items-center gap-12 p-16 bg-surface-primary rounded-md shadow-sm min-w-[180px]", className)}>
      {/* Icon container — 40x40 with tinted background */}
      <div
        className="w-10 h-10 rounded-sm flex items-center justify-center shrink-0"
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
        <span className="text-heading font-bold text-text-primary font-mono leading-tight">
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
