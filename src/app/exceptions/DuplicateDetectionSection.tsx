/**
 * DuplicateDetectionSection — Data-presence-driven enrichment.
 *
 * Renders ONLY when analysis.duplicate_detection is present.
 * Shows: original vs duplicate order, detection method, confidence,
 * recommended action, and autonomy level applied.
 *
 * Intent-agnostic: any intent that produces duplicate_detection data
 * will automatically render this section — zero code changes.
 */
"use client";

import { Copy, ArrowRight, Shield, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { fmtPrice } from "./shared";
import type { DuplicateDetectionData, OrderSnapshot } from "@/types/exceptions";

interface DuplicateDetectionSectionProps {
  data: DuplicateDetectionData;
}

export function DuplicateDetectionSection({ data }: DuplicateDetectionSectionProps) {
  return (
    <section
      style={{
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--space-16)",
      }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", marginBottom: "var(--space-12)" }}>
        <Copy size={14} style={{ color: "var(--color-text-tertiary)" }} />
        <span style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)" }}>
          Duplicate Detection
        </span>
        <Badge variant="warning" size="sm">
          {data.confidence}% confidence
        </Badge>
      </div>

      {/* Original vs Duplicate side-by-side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: "var(--space-12)",
          marginBottom: "var(--space-16)",
          alignItems: "start",
        }}
      >
        <OrderCard label="Original Order" order={data.original_order} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: "var(--space-24)",
            color: "var(--color-text-quaternary)",
          }}
        >
          <ArrowRight size={20} />
          <span style={{ fontSize: "var(--font-size-label)", marginTop: "var(--space-4)" }}>
            {data.days_between}d apart
          </span>
        </div>
        <OrderCard label="Duplicate Order" order={data.duplicate_order} highlight />
      </div>

      {/* Detection method */}
      <div style={{ marginBottom: "var(--space-12)" }}>
        <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
          Detection Method
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-8)",
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-secondary)",
          }}
        >
          <Shield size={14} style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }} />
          {data.detection_method}
        </div>
      </div>

      {/* Recommended action */}
      <div style={{ marginBottom: "var(--space-12)" }}>
        <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
          Recommended Action
        </div>
        <div
          style={{
            borderLeft: "3px solid var(--color-brand)",
            paddingLeft: "var(--space-10)",
            fontSize: "var(--font-size-body)",
            fontWeight: 600,
            color: "var(--color-brand)",
            lineHeight: 1.5,
          }}
        >
          {data.recommended_action}
        </div>
        <div
          style={{
            marginTop: "var(--space-4)",
            paddingLeft: "var(--space-10)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-6)",
            fontSize: "var(--font-size-caption)",
            color: "var(--color-text-tertiary)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
            Cancel target:
          </span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-error)", fontWeight: 600 }}>
            {data.cancellation_target}
          </span>
        </div>
      </div>

      {/* Autonomy level */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          padding: "var(--space-8) var(--space-12)",
          background: "var(--color-surface-secondary)",
          borderRadius: "var(--radius-sm)",
          fontSize: "var(--font-size-caption)",
        }}
      >
        <Clock size={12} style={{ color: "var(--color-text-tertiary)" }} />
        <span style={{ color: "var(--color-text-tertiary)", fontWeight: 600 }}>Autonomy:</span>
        <span style={{ color: "var(--color-text-secondary)" }}>{data.autonomy_applied}</span>
      </div>
    </section>
  );
}

/** Compact order snapshot card */
function OrderCard({ label, order, highlight }: { label: string; order: OrderSnapshot; highlight?: boolean }) {
  return (
    <div
      style={{
        padding: "var(--space-12)",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${highlight ? "var(--color-warning)" : "var(--color-border-default)"}`,
        background: highlight ? "var(--color-warning-subtle)" : "var(--color-surface-primary)",
      }}
    >
      <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-8)" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", fontSize: "var(--font-size-caption)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>SO #</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>{order.so_number}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>PO #</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>{order.po_number}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>Created</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{new Date(order.created_date).toLocaleDateString()}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>Value</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>{fmtPrice(order.total_value)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>Lines</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{order.line_count}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>Status</span>
          <Badge variant="neutral" size="sm">{order.status}</Badge>
        </div>
      </div>
    </div>
  );
}
