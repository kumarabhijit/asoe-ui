/**
 * ReviewQualityPanel — the real-data slice of the Autonomy program.
 *
 * Renders the backend's automation-bias SLIs (review scrutiny) — the
 * "are operators genuinely reviewing, or rubber-stamping?" signal that gates a
 * safe path to autonomy. Presentational: it projects a backend-authoritative
 * `ReviewerActivitySnapshot` and computes nothing the backend didn't measure
 * (per-bucket counts are a pure arithmetic decomposition of the cumulative
 * histogram the backend emitted — not a synthesised metric).
 *
 * Honesty (the whole point of this slice): two autonomy surfaces have NO
 * request-time data source yet — the counterfactual straight-through-processing
 * view (needs a persisted shadow-decision log) and the calibration reliability
 * diagram (ECE/Brier runs nightly, not exposed). They render as explicit
 * "not measurable yet" cards naming the missing source — never as an empty or
 * fabricated chart.
 */
"use client";

import {
  Eye, Gauge, Timer, ShieldCheck, AlertTriangle, Info, TrendingDown,
} from "lucide-react";

import { MetricTile } from "@/components/ui/MetricTile";
import type { ReviewerActivitySnapshot } from "@/lib/api";

export interface ReviewQualityPanelProps {
  data: ReviewerActivitySnapshot;
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Per-bucket counts from the cumulative histogram + a human dwell label.
 *  Pure decomposition of the backend's cumulative buckets. */
function dwellBars(data: ReviewerActivitySnapshot): { label: string; count: number }[] {
  const h = data.dwell_seconds_histogram;
  const bars: { label: string; count: number }[] = [];
  let prevEdge = 0;
  let prevCount = 0;
  for (const b of h) {
    const count = Math.max(0, b.count - prevCount);
    const label = b.le_seconds === null ? `> ${prevEdge}s` : `≤ ${b.le_seconds}s`;
    bars.push({ label, count });
    prevCount = b.count;
    if (b.le_seconds !== null) prevEdge = b.le_seconds;
  }
  return bars;
}

export function ReviewQualityPanel({ data }: ReviewQualityPanelProps) {
  const bars = dwellBars(data);
  const maxBar = Math.max(1, ...bars.map((b) => b.count));
  const cohortShown = data.by_highlight.shown;
  const cohortNot = data.by_highlight.not_shown;
  // ADR-043 §2.7 — a DROP in scrutiny when an evidence highlight is shown is
  // the automation-bias regression signal (the operator leans on the highlight
  // instead of reading the document).
  const highlightRegression =
    cohortShown.decisions > 0 &&
    cohortNot.decisions > 0 &&
    cohortShown.layer2_open_rate < cohortNot.layer2_open_rate;

  return (
    <div className="flex flex-col gap-16">
      {/* Honest scope caveat — these are instance-local counters. */}
      <div
        role="note"
        className="flex items-start gap-8 p-12 bg-surface-secondary rounded-sm border border-border-subtle"
      >
        <Info size={14} className="text-text-tertiary shrink-0 mt-2" aria-hidden />
        <p className="m-0 text-caption text-text-secondary leading-normal">
          Process-local counters since this instance restarted. The
          fleet-aggregated, time-series view lives in Grafana over the
          Prometheus scrape — these tiles are a live read of the same SLIs, not
          a historical record.
        </p>
      </div>

      {/* Review-scrutiny tiles (real). */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-12">
        <MetricTile
          icon={<Eye size={20} />}
          label="Decisions observed"
          value={data.decisions}
          subtitle="Operator dispositions this instance"
        />
        <MetricTile
          icon={<Gauge size={20} />}
          label="Evidence-scrutiny rate"
          value={pct(data.layer2_open_rate)}
          subtitle="Opened the evidence before acting — low values flag rubber-stamping"
          tint={data.layer2_open_rate >= 0.5 ? "var(--color-success)" : "var(--color-warning)"}
        />
        <MetricTile
          icon={<Timer size={20} />}
          label="Total dwell"
          value={`${Math.round(data.dwell_seconds_sum)}s`}
          subtitle="Summed time operators spent before deciding"
        />
      </div>

      {/* Scrutiny-by-highlight cohort (real; the automation-bias A/B). */}
      <section
        aria-label="Scrutiny by evidence-highlight cohort"
        className="bg-surface-primary rounded-md shadow-sm p-16"
      >
        <div className="flex items-center gap-8 mb-12">
          <ShieldCheck size={14} className="text-text-tertiary" aria-hidden />
          <span className="text-subhead font-semibold text-text-primary">
            Scrutiny by evidence highlight
          </span>
        </div>
        <div className="grid grid-cols-2 gap-12">
          <CohortStat label="Highlight shown" rate={cohortShown.layer2_open_rate} n={cohortShown.decisions} />
          <CohortStat label="No highlight" rate={cohortNot.layer2_open_rate} n={cohortNot.decisions} />
        </div>
        <div
          className={
            "mt-12 flex items-start gap-8 p-10 rounded-sm border text-caption leading-normal " +
            (highlightRegression
              ? "bg-warning-subtle border-warning-border text-warning"
              : "bg-surface-secondary border-border-subtle text-text-secondary")
          }
          role={highlightRegression ? "alert" : "note"}
        >
          {highlightRegression ? (
            <TrendingDown size={14} className="shrink-0 mt-2" aria-hidden />
          ) : (
            <Info size={14} className="shrink-0 mt-2 text-text-tertiary" aria-hidden />
          )}
          <span>
            {highlightRegression
              ? "Scrutiny drops when a highlight is shown — operators may be leaning on the highlight instead of reading the source. This is the automation-bias regression signal (ADR-043 §2.7)."
              : "Scrutiny holds or rises when a highlight is shown — no automation-bias regression from highlighting."}
          </span>
        </div>
      </section>

      {/* Decision-dwell distribution (real). */}
      <section
        aria-label="Decision dwell distribution"
        className="bg-surface-primary rounded-md shadow-sm p-16"
      >
        <div className="flex items-center gap-8 mb-12">
          <Timer size={14} className="text-text-tertiary" aria-hidden />
          <span className="text-subhead font-semibold text-text-primary">
            Decision dwell distribution
          </span>
        </div>
        <ul className="m-0 p-0 list-none flex flex-col gap-6">
          {bars.map((b) => (
            <li key={b.label} className="flex items-center gap-10">
              <span className="font-mono text-caption text-text-tertiary w-64 shrink-0 text-right">
                {b.label}
              </span>
              <div className="flex-1 h-3 bg-surface-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(b.count / maxBar) * 100}%` }}
                />
              </div>
              <span className="font-mono text-caption text-text-secondary w-32 shrink-0">
                {b.count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Honest "not measurable yet" surfaces — named missing source, never a
          fabricated chart. */}
      <section aria-label="Not yet measurable" className="flex flex-col gap-10">
        <span className="text-label font-bold uppercase tracking-wider text-text-quaternary">
          Not yet measurable
        </span>
        <NotAvailableCard
          title="Straight-through-processing (counterfactual)"
          reason="Needs a persisted shadow-decision log — what the system would have auto-approved vs. what the operator decided. No request-time source exists yet."
        />
        <NotAvailableCard
          title="Calibration reliability (ECE / Brier)"
          reason="The calibration harness runs nightly over the replay dataset and is not exposed at request time. The reliability diagram lives in the offline eval report; until it is published as a read surface this stays blank rather than fabricated."
        />
      </section>
    </div>
  );
}

function CohortStat({ label, rate, n }: { label: string; rate: number; n: number }) {
  return (
    <div className="px-12 py-10 bg-surface-secondary rounded-sm border border-border-subtle">
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
        {label}
      </div>
      <div className="flex items-baseline gap-8">
        <span className="text-display font-bold text-text-primary leading-tight">{pct(rate)}</span>
        <span className="text-caption text-text-tertiary">scrutiny · n={n}</span>
      </div>
    </div>
  );
}

function NotAvailableCard({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex items-start gap-8 p-12 bg-surface-secondary rounded-sm border border-border-subtle">
      <AlertTriangle size={14} className="text-text-tertiary shrink-0 mt-2" aria-hidden />
      <div>
        <div className="text-body font-semibold text-text-primary">{title}</div>
        <div className="text-caption text-text-tertiary mt-2 leading-normal">{reason}</div>
        <div className="mt-4 text-label font-semibold uppercase tracking-wider text-text-quaternary">
          No data source yet
        </div>
      </div>
    </div>
  );
}
