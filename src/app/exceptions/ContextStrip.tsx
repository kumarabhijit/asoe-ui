/**
 * ContextStrip — Layer 2 of the Exception Detail Panel.
 *
 * Two-column grid: Entity Profile (customer master data) + Impact Metrics (blast radius).
 * Collapsible — default expanded.
 */
"use client";

import { useState } from "react";
import { Building2, DollarSign, Shield, Clock, User, MapPin, Package } from "lucide-react";
import { CollapsibleHeader } from "./shared";
import type { EntityProfile, ImpactMetrics } from "@/types/exceptions";

interface ContextStripProps {
  entityProfile?: EntityProfile | null;
  impactMetrics?: ImpactMetrics | null;
  defaultOpen?: boolean;
}

function fmtPrice(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ContextStrip({ entityProfile: ep, impactMetrics: im, defaultOpen = true }: ContextStripProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!ep && !im) return null;

  return (
    <div style={{ borderBottom: "1px solid var(--color-border-default)", flexShrink: 0 }}>
      <CollapsibleHeader title="Entity Profile" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {/* Entity Profile */}
          <div
            style={{
              padding: "var(--space-10) var(--space-16)",
              borderRight: "1px solid var(--color-border-default)",
              background: "var(--color-surface-primary)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-6)" }}>
              Customer
            </div>
            {ep && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", fontSize: "var(--font-size-caption)" }}>
                <ContextRow icon={<User size={11} />} label="Customer" value={`${ep.customer_name} (${ep.bp_number})`} />
                <ContextRow icon={<Building2 size={11} />} label="Tier" value={ep.customer_tier ?? "—"} badge={ep.vip_status ? "VIP" : undefined} />
                <ContextRow icon={<Shield size={11} />} label="Credit" value={ep.credit_standing ?? "—"} />
                <ContextRow icon={<MapPin size={11} />} label="Location" value={ep.location ?? "—"} />
              </div>
            )}
          </div>

          {/* Impact Metrics */}
          <div
            style={{
              padding: "var(--space-10) var(--space-16)",
              background: "var(--color-surface-primary)",
            }}
          >
            <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-6)" }}>
              Impact & Risk
            </div>
            {im && (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", fontSize: "var(--font-size-caption)" }}>
                <ContextRow icon={<DollarSign size={11} />} label="At Risk" value={fmtPrice(im.revenue_at_risk)} highlight />
                <ContextRow icon={<DollarSign size={11} />} label="Delta" value={`${fmtPrice(im.delta_amount)} (${im.delta_percentage.toFixed(1)}%)`} />
                {im.fulfillment_gap_pct !== undefined && (
                  <ContextRow icon={<Package size={11} />} label="Gap" value={`${im.fulfillment_gap_pct.toFixed(1)}%`} />
                )}
                <ContextRow icon={<Clock size={11} />} label="Priority" value={im.sla_priority} badge={im.sla_priority} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Context strip row — icon + label + value + optional badge */
function ContextRow({ icon, label, value, badge, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", minWidth: 0 }}>
      <span style={{ color: "var(--color-text-quaternary)", flexShrink: 0 }}>{icon}</span>
      <span style={{ color: "var(--color-text-tertiary)", minWidth: 52, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: highlight ? "var(--color-error)" : "var(--color-text-primary)",
          fontWeight: highlight ? 700 : 500,
          fontFamily: highlight ? "var(--font-mono)" : "var(--font-sans)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      {badge && (
        <span
          style={{
            fontSize: "var(--font-size-label)",
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: "var(--radius-full)",
            background: "var(--color-brand-subtle)",
            color: "var(--color-brand)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
