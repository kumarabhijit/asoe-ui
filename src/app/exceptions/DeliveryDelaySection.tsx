/**
 * DeliveryDelaySection — Data-presence-driven enrichment for delivery-delay exceptions.
 *
 * Renders ONLY when `analysis.delivery_delay_analysis` is present.
 * Shows planned-vs-projected timeline, category/reason badge, affected
 * lines and revenue at risk, and ranked alternate delivery options.
 * Intent-agnostic: any intent producing delivery_delay_analysis data
 * renders this section (Guardrail #2).
 */
"use client";

import { useState } from "react";
import { Clock, Truck, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type { DeliveryDelayAnalysisData, AlternateDeliveryOption } from "@/types/exceptions";
import { fmtPrice } from "./shared";

interface DeliveryDelaySectionProps {
  data: DeliveryDelayAnalysisData;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

/* ── Delay timeline bar — visualises planned → projected drift ─────────── */

function DelayTimeline({ plannedIso, projectedIso, daysLate }: {
  plannedIso: string; projectedIso: string; daysLate: number;
}) {
  // Scale the bar so the delayed portion is visible even for small deltas,
  // capped to a sensible max (40% overrun) to avoid visual extremes.
  const overrunPct = Math.min(40, Math.max(6, daysLate * 5));
  return (
    <div>
      <div className="flex items-center justify-between mb-6 text-label font-semibold text-text-quaternary uppercase tracking-wider">
        <span>Planned</span>
        <span>Projected ETA ({daysLate}d late)</span>
      </div>
      <div className="relative h-[28px] bg-surface-secondary rounded-sm overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-success/50 flex items-center px-8"
          style={{ width: "60%" }}
        >
          <span className="text-label font-mono text-text-primary">
            {fmtDate(plannedIso)}
          </span>
        </div>
        <div
          className="absolute inset-y-0 bg-error-subtle flex items-center justify-end px-8"
          style={{ left: "60%", width: `${overrunPct}%` }}
        >
          <span className="text-label font-mono font-semibold text-error">
            {fmtDate(projectedIso)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Alternate option card ─────────────────────────────────────────────── */

function OptionCard({ option, selected, onSelect }: {
  option: AlternateDeliveryOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const costLabel = option.extra_cost > 0
    ? `+${fmtPrice(option.extra_cost)} freight`
    : option.extra_cost < 0
    ? `${fmtPrice(Math.abs(option.extra_cost))} saved`
    : "No freight impact";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-12 rounded-md border bg-surface-primary transition-colors duration-fast",
        selected && "border-brand ring-2 ring-brand-ring/40",
        !selected && option.recommended && "border-success",
        !selected && !option.recommended && "border-border hover:border-text-quaternary",
      )}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-8">
          <span className="text-caption font-semibold text-text-primary">{option.title}</span>
          {option.recommended && (
            <span className="flex items-center gap-2 text-label font-bold text-success">
              <Star size={10} /> Top Pick
            </span>
          )}
        </div>
        <span className="text-label font-mono text-text-tertiary uppercase tracking-wider">
          {option.type}
        </span>
      </div>
      <div className="text-caption text-text-secondary mb-6">{option.description}</div>
      <div className="flex items-center gap-12 text-label">
        <span>
          <span className="text-text-quaternary uppercase tracking-wider mr-4">New ETA</span>
          <span className="font-mono text-text-primary">{fmtDate(option.new_eta)}</span>
        </span>
        <span className="text-border">|</span>
        <span
          className={cn(
            "font-mono",
            option.extra_cost > 0 ? "text-warning"
              : option.extra_cost < 0 ? "text-success"
              : "text-text-tertiary",
          )}
        >
          {costLabel}
        </span>
      </div>
    </button>
  );
}

/* ── Main section ──────────────────────────────────────────────────────── */

export function DeliveryDelaySection({ data }: DeliveryDelaySectionProps) {
  const altOptions = data.alternate_options ?? [];
  const [selectedOption, setSelectedOption] = useState<string | null>(
    altOptions.find((o) => o.recommended)?.id ?? null,
  );

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-16 py-10 border-b border-border">
        <div className="flex items-center gap-8">
          <Truck size={14} className="text-warning" />
          <span className="text-subhead font-semibold text-text-primary">
            Delivery Delay Analysis
          </span>
        </div>
        <span className="text-label font-bold px-6 py-1 rounded-full bg-warning-subtle text-warning">
          {data.days_late}d late
        </span>
      </div>

      <div className="p-16 flex flex-col gap-16">
        {/* Timeline visualisation — audit-bearing inputs guaranteed
            present by composer registry coverage. */}
        <DelayTimeline
          plannedIso={data.planned_date}
          projectedIso={data.projected_eta}
          daysLate={data.days_late}
        />

        {/* Context row — mix of audit-bearing (Category, At Risk +
            affected_lines) and contextual (Rule, Carrier+Route). The
            contextual rows use EvidenceBlock so they STRUCTURALLY OMIT
            when the backend didn't emit them, never render a dash
            (Verdict Pillar 3). */}
        <div className="grid grid-cols-2 gap-12 text-label">
          <div>
            <span className="text-text-quaternary uppercase tracking-wider">Category</span>
            <div className="text-caption font-mono text-text-primary mt-px">
              {data.delay_category}
            </div>
          </div>
          <EvidenceBlock tier="contextual" value={data.rule_id}>
            {(v) => (
              <div>
                <span className="text-text-quaternary uppercase tracking-wider">Rule</span>
                <div className="text-caption font-mono text-text-primary mt-px">
                  {String(v)}
                </div>
              </div>
            )}
          </EvidenceBlock>
          <EvidenceBlock tier="contextual" value={data.carrier}>
            {(carrier) => (
              <div>
                <span className="text-text-quaternary uppercase tracking-wider">Carrier</span>
                <div className="text-caption text-text-primary mt-px">
                  {String(carrier)}
                  {data.route ? (
                    <span className="text-text-tertiary"> ({data.route})</span>
                  ) : null}
                </div>
              </div>
            )}
          </EvidenceBlock>
          {/* At Risk is grandfathered audit-bearing — render the
              row only when the gateway has produced it; otherwise
              show "Context Not Required for Resolution" so the
              operator knows the system deliberately didn't fetch
              the value (vs crashed). */}
          <EvidenceBlock
            tier="conditional"
            value={data.at_risk}
            predicateHolds={typeof data.at_risk === "number"}
            notRequiredLabel="At-risk context not yet wired (gateway gap, deadline 2026-07-21)"
          >
            {(v) => (
              <div>
                <span className="text-text-quaternary uppercase tracking-wider">At Risk</span>
                <div className="text-caption font-mono font-semibold text-error mt-px">
                  {fmtPrice(v as number)}
                  <span className="ml-4 text-text-tertiary font-sans font-normal">
                    ({data.affected_lines} line{data.affected_lines === 1 ? "" : "s"})
                  </span>
                </div>
              </div>
            )}
          </EvidenceBlock>
        </div>

        {/* Delay reason narrative — contextual; structurally omit
            the entire callout block when absent rather than rendering
            an empty box. */}
        <EvidenceBlock tier="contextual" value={data.delay_reason}>
          {(v) => (
            <div className="flex items-start gap-8 p-10 rounded-md border-l-[3px] border-warning bg-warning-subtle">
              <Clock size={14} className="text-warning shrink-0 mt-1" />
              <p className="text-caption text-text-secondary m-0 leading-normal">
                {String(v)}
              </p>
            </div>
          )}
        </EvidenceBlock>

        {/* SLA deadline — grandfathered audit-bearing (gateway gap). */}
        <EvidenceBlock tier="contextual" value={data.sla_deadline}>
          {(v) => (
            <div className="text-label text-text-tertiary">
              <span className="uppercase tracking-wider text-text-quaternary mr-4">
                SLA deadline
              </span>
              <span className="font-mono text-text-primary">
                {fmtDate(String(v))}
              </span>
            </div>
          )}
        </EvidenceBlock>

        {/* Alternate delivery options — registry-conditional on
            resolved_action ∈ {EXPEDITE, SPLIT_SHIP, PARTIAL,
            RESCHEDULE}. Read-only HITL detail panel doesn't have a
            resolved action yet, so we render the list whenever the
            backend produced it (predicate effectively true) and
            omit when empty. */}
        {altOptions.length > 0 && (
          <div>
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
              Alternate delivery options ({altOptions.length})
            </div>
            <div className="flex flex-col gap-8">
              {altOptions.map((opt) => (
                <OptionCard
                  key={opt.id}
                  option={opt}
                  selected={selectedOption === opt.id}
                  onSelect={() => setSelectedOption(opt.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
