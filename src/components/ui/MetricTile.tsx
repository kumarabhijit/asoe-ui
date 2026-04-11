/**
 * MetricTile — KPI display: icon (40x40 tinted bg) + label + monospace value + subtitle.
 * Section 11.2: part of the metrics strip on the Exception Queue page.
 */
"use client";

import type { ReactNode, CSSProperties } from "react";

interface MetricTileProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  tint?: string; // CSS color for icon background tint
  style?: CSSProperties;
}

export function MetricTile({ icon, label, value, subtitle, tint, style }: MetricTileProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-12)",
        padding: "var(--space-16)",
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        minWidth: 180,
        ...style,
      }}
    >
      {/* Icon container — 40x40 with tinted background */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-sm)",
          background: tint || "var(--color-surface-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: tint ? "var(--color-surface-primary)" : "var(--color-text-secondary)",
        }}
      >
        {icon}
      </div>

      {/* Text content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          className="label"
          style={{
            color: "var(--color-text-tertiary)",
            fontSize: "var(--font-size-label)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <span
          className="mono-data"
          style={{
            fontSize: "var(--font-size-heading)",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
            lineHeight: 1.2,
          }}
        >
          {value}
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: "var(--font-size-label)",
              color: "var(--color-text-quaternary)",
              fontWeight: 500,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
