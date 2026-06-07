"use client";

/**
 * ImpactBar — Priority-1 financial/business-impact summary.
 *
 * Surfaces the quantitative blast radius (`impact_metrics`) as an
 * always-visible strip directly under the HeaderRibbon, so the operator
 * sees revenue-at-risk + delta the moment the record opens — without
 * expanding the (collapsed-by-default) ContextStrip. This is the impact
 * half of the two-pane ContextStrip lifted to the top of the viewport;
 * ContextStrip then carries the customer entity profile only, so the same
 * figure is not rendered twice (S1 redundancy posture).
 *
 * Dumb projector (Guardrail #6): renders `impact_metrics` as given. No
 * blending of event/gateway data, no dash/placeholder fallbacks — a metric
 * that is structurally absent renders nothing rather than a partial-truth
 * placeholder. Crucially, "absent" means BOTH `undefined` AND `null`: the
 * backend types every optional metric as `Optional[float] = None`, which
 * FastAPI serialises to JSON `null` (not an omitted key). `fulfillment_gap_pct`
 * is `null` on every record without a fulfilment shortfall (most pricing /
 * EDI / duplicate exceptions), so the cells must guard on `Number.isFinite`,
 * never on `!== undefined` — a `null.toFixed()` would throw and, because this
 * strip is always-visible, take the whole detail pane down with it.
 * Returns null when no metric is renderable.
 *
 * Accessibility: each cell is label + value (never value alone), and the
 * at-risk emphasis is weight + the explicit "At risk" label, not colour
 * alone (WCAG 1.4.1).
 */

import type { ReactNode } from "react";
import { DollarSign, TrendingUp, Package, Clock } from "lucide-react";
import { fmtPrice } from "./shared";
import { fmtSignedPrice } from "@/lib/format";
import type { ImpactMetrics } from "@/types/exceptions";

interface ImpactBarProps {
  impactMetrics?: ImpactMetrics | null;
}

/** True only for a real, finite number — rejects null / undefined / NaN so a
 *  number method (`.toFixed`) is never called on a non-number. */
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function ImpactBar({ impactMetrics: im }: ImpactBarProps) {
  if (!im) return null;

  const cells: {
    icon: ReactNode;
    label: string;
    value: string;
    emphasis?: boolean;
  }[] = [];

  if (isNum(im.revenue_at_risk)) {
    cells.push({
      icon: <DollarSign size={12} />,
      label: "At risk",
      value: fmtPrice(im.revenue_at_risk),
      emphasis: true,
    });
  }
  if (isNum(im.delta_amount) && isNum(im.delta_percentage)) {
    cells.push({
      icon: <TrendingUp size={12} />,
      label: "Delta",
      value: `${fmtSignedPrice(im.delta_amount)} (${im.delta_percentage.toFixed(1)}%)`,
    });
  }
  if (isNum(im.fulfillment_gap_pct)) {
    cells.push({
      icon: <Package size={12} />,
      label: "Fulfillment gap",
      value: `${im.fulfillment_gap_pct.toFixed(1)}%`,
    });
  }
  if (typeof im.sla_priority === "string" && im.sla_priority.trim() !== "") {
    cells.push({
      icon: <Clock size={12} />,
      label: "Priority",
      value: im.sla_priority,
    });
  }

  if (cells.length === 0) return null;

  return (
    <dl
      aria-label="Business impact"
      className="flex flex-wrap items-stretch gap-x-24 gap-y-8 px-16 py-10 border-b border-border bg-surface-secondary shrink-0"
    >
      {cells.map((c) => (
        <ImpactCell key={c.label} icon={c.icon} label={c.label} value={c.value} emphasis={c.emphasis} />
      ))}
    </dl>
  );
}

/** One impact metric — icon + dt label + dd value. Value is required
 *  (callers gate optional metrics before mounting the cell), so there is
 *  no dash/placeholder partial-truth branch here. */
function ImpactCell({
  icon,
  label,
  value,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-px min-w-0">
      <dt className="flex items-center gap-4 text-label uppercase tracking-wider text-text-quaternary">
        <span className="shrink-0">{icon}</span>
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? "text-subhead font-bold font-mono text-error"
            : "text-caption font-semibold font-mono text-text-primary"
        }
      >
        {value}
      </dd>
    </div>
  );
}
