/**
 * ContextStrip — Layer 2 of the Exception Detail Panel.
 *
 * Two-column grid: Entity Profile (customer master data) + Impact Metrics (blast radius).
 * Collapsible — default collapsed (user-adjustable). The core decision data
 * lives in Layer 1; this strip is enrichment the reviewer opens on demand.
 */
"use client";

import { useState } from "react";
import { Building2, DollarSign, Shield, Clock, User, MapPin, Package } from "lucide-react";
import { CollapsibleHeader } from "./shared";
import { fmtPrice } from "./shared";
import type { EntityProfile, ImpactMetrics } from "@/types/exceptions";

interface ContextStripProps {
  entityProfile?: EntityProfile | null;
  impactMetrics?: ImpactMetrics | null;
  defaultOpen?: boolean;
}

export function ContextStrip({ entityProfile: ep, impactMetrics: im, defaultOpen = false }: ContextStripProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!ep && !im) return null;

  return (
    <div className="border-b border-border shrink-0">
      <CollapsibleHeader title="Entity Profile" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {/* Entity Profile */}
          <div className="px-16 py-10 border-r border-border bg-surface-primary">
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-6">
              Customer
            </div>
            {ep && (
              <div className="flex flex-col gap-4 text-caption">
                <ContextRow icon={<User size={11} />} label="Customer" value={`${ep.customer_name} (${ep.bp_number})`} />
                {/* CLAUDE.md Guardrail #6: contextual fields use
                    structural omission (render nothing) when absent.
                    `?? "—"` was the partial-truth anti-pattern flagged
                    by the Verdict 2026-04-22 workshop. ContextRow
                    returns null when value is undefined. */}
                <ContextRow icon={<Building2 size={11} />} label="Tier" value={ep.customer_tier} badge={ep.vip_status ? "VIP" : undefined} />
                <ContextRow icon={<Shield size={11} />} label="Credit" value={ep.credit_standing} />
                <ContextRow icon={<MapPin size={11} />} label="Location" value={ep.location} />
              </div>
            )}
          </div>

          {/* Impact Metrics */}
          <div className="px-16 py-10 bg-surface-primary">
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-6">
              Impact & Risk
            </div>
            {im && (
              <div className="flex flex-col gap-4 text-caption">
                <ContextRow icon={<DollarSign size={11} />} label="At Risk" value={fmtPrice(im.revenue_at_risk)} highlight />
                <ContextRow icon={<DollarSign size={11} />} label="Delta" value={`${fmtPrice(im.delta_amount)} (${im.delta_percentage.toFixed(1)}%)`} />
                {im.fulfillment_gap_pct !== undefined && (
                  <ContextRow icon={<Package size={11} />} label="Gap" value={`${im.fulfillment_gap_pct.toFixed(1)}%`} />
                )}
                {/* Priority renders as a plain value row — earlier a duplicate
                    badge was bound to the same string, so Priority appeared
                    twice side-by-side. */}
                <ContextRow icon={<Clock size={11} />} label="Priority" value={im.sla_priority} />
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
  /**
   * Structural omission for contextual entity-profile fields
   * (CLAUDE.md Guardrail #6 / Verdict 2026-04-22). When the
   * field is undefined the entire row is suppressed — no dash,
   * no "—", no placeholder. Operator does not see a column they
   * have no value for.
   */
  value: string | undefined;
  badge?: string;
  highlight?: boolean;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center gap-6 min-w-0">
      <span className="text-text-quaternary shrink-0">{icon}</span>
      <span className="text-text-tertiary min-w-[52px] shrink-0">{label}</span>
      <span
        className={
          highlight
            ? "text-error font-bold font-mono overflow-hidden text-ellipsis whitespace-nowrap"
            : "text-text-primary font-medium overflow-hidden text-ellipsis whitespace-nowrap"
        }
      >
        {value}
      </span>
      {badge && (
        <span className="text-label font-bold px-1.5 py-px rounded-full bg-brand-subtle text-brand uppercase tracking-wider">
          {badge}
        </span>
      )}
    </div>
  );
}
