/**
 * HeaderRibbon — Layer 1 of the Exception Detail Panel.
 *
 * Breadcrumb-style context: Reference ID > Customer > Location > Primary SKU.
 * Status row: lifecycle badge + event type + shadow verdict (read-only) + total value.
 */
"use client";

import { ChevronRight } from "lucide-react";
import { Badge, lifecycleVariant, verdictVariant } from "@/components/ui/Badge";
import type { ExceptionDetail, EntityProfile } from "@/types/exceptions";

interface HeaderRibbonProps {
  detail: ExceptionDetail;
  entityProfile?: EntityProfile | null;
  primarySkuLabel: string;
  totalPo: number;
  delta: number;
}

function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function HeaderRibbon({ detail, entityProfile: ep, primarySkuLabel, totalPo, delta }: HeaderRibbonProps) {
  return (
    <div
      style={{
        padding: "var(--space-10) var(--space-16)",
        borderBottom: "1px solid var(--color-border-default)",
        background: "var(--color-surface-primary)",
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-6)",
          fontSize: "var(--font-size-caption)",
          color: "var(--color-text-tertiary)",
          marginBottom: "var(--space-6)",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-text-primary)" }}>
          {detail.order_id}
        </span>
        <ChevronRight size={10} />
        <span style={{ fontWeight: 500, color: "var(--color-text-secondary)" }}>
          {ep?.customer_name ?? detail.tenant_id}
        </span>
        <ChevronRight size={10} />
        <span>{ep?.location ?? "—"}</span>
        <ChevronRight size={10} />
        <span>{primarySkuLabel}</span>
      </div>

      {/* Status row: lifecycle + event type + shadow verdict read-only */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", flexWrap: "wrap" }}>
        <Badge variant={lifecycleVariant(detail.lifecycle_state)} size="sm">
          {detail.lifecycle_state.replace(/_/g, " ")}
        </Badge>
        <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-tertiary)" }}>
          {detail.event_type.replace(/_/g, " ")}
        </span>
        {detail.shadow_verdict && (
          <Badge variant={verdictVariant(detail.shadow_verdict)} size="sm">
            {detail.shadow_verdict}
          </Badge>
        )}
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "var(--font-size-body)",
            color: "var(--color-text-primary)",
          }}
        >
          {fmtPrice(totalPo)}
        </span>
        {delta !== 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              fontSize: "var(--font-size-caption)",
              color: "var(--color-error)",
            }}
          >
            {"\u0394"} {fmtPrice(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  );
}
