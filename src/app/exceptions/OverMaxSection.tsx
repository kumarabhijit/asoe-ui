/**
 * OverMaxSection — Data-presence-driven enrichment for Over Max exceptions.
 *
 * Renders ONLY when `analysis.overmax_analysis` is present.
 * Shows exceedance gap bar, order lines table, and AI trim plan.
 * Intent-agnostic: any intent producing overmax_analysis data renders this section.
 */
"use client";

import { useState } from "react";
import { ArrowUpRight, Scissors, ChevronDown, Check, SkipForward, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type { OverMaxAnalysisData, TrimPlanLine } from "@/types/exceptions";
import { fmtPrice } from "./shared";

interface OverMaxSectionProps {
  data: OverMaxAnalysisData;
}

export function OverMaxSection({ data }: OverMaxSectionProps) {
  const [showLines, setShowLines] = useState(false);

  const maxVal = Math.max(data.total_ordered, data.max_qty, 1);
  const orderedPct = (data.total_ordered / maxVal) * 100;
  const maxPct = (data.max_qty / maxVal) * 100;

  const trimmedTotal = data.trim_plan.reduce((s, l) => s + l.trimmed_to, 0);
  const deltaTotal = data.trim_plan.reduce((s, l) => s + l.delta, 0);

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-16 py-10 border-b border-border">
        <div className="flex items-center gap-8">
          <ArrowUpRight size={14} className="text-error" />
          <span className="text-subhead font-semibold text-text-primary">
            Over Max Analysis
          </span>
        </div>
        <span className="text-label font-bold px-6 py-1 rounded-full bg-error-subtle text-error">
          {data.exceedance_pct.toFixed(0)}% over limit
        </span>
      </div>

      <div className="p-16 flex flex-col gap-16">
        {/* ── Exceedance Gap Bar ───────────────────────────────────────── */}
        <div>
          <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
            Quantity Exceedance
          </div>

          {/* Ordered bar */}
          <div className="flex items-center gap-8 mb-6">
            <span className="text-caption text-text-tertiary w-[60px] shrink-0 text-right">
              Ordered
            </span>
            <div className="flex-1 h-[24px] bg-surface-secondary rounded-sm overflow-hidden relative">
              <div
                className="h-full bg-error rounded-sm transition-all duration-normal"
                style={{ width: `${orderedPct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-8 text-caption font-bold text-text-primary">
                {data.total_ordered.toLocaleString()} {data.uom}
              </span>
            </div>
          </div>

          {/* Max bar */}
          <div className="flex items-center gap-8 mb-6">
            <span className="text-caption text-text-tertiary w-[60px] shrink-0 text-right">
              Max
            </span>
            <div className="flex-1 h-[24px] bg-surface-secondary rounded-sm overflow-hidden relative">
              <div
                className="h-full bg-success rounded-sm transition-all duration-normal"
                style={{ width: `${maxPct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-8 text-caption font-bold text-text-primary">
                {data.max_qty.toLocaleString()} {data.uom}
              </span>
            </div>
          </div>

          {/* Excess indicator */}
          <div className="flex items-center gap-8">
            <span className="w-[60px]" />
            <div className="flex items-center gap-6 text-caption text-error font-medium">
              <ArrowUpRight size={12} />
              <span>
                Excess: {data.excess_qty.toLocaleString()} {data.uom} ({data.exceedance_pct.toFixed(1)}%) — At Risk: {fmtPrice(data.at_risk)}
              </span>
            </div>
          </div>

          {/* Block info — all three fields are grandfathered audit-bearing
              (overmax_gateway_gap clause, deadline 2026-07-21). Render
              with EvidenceBlock so the row collapses cleanly when the
              SAP block / contract gateway hasn't populated them, rather
              than rendering empty pills. */}
          <div className="flex items-center gap-8 mt-8">
            <span className="w-[60px]" />
            <div className="flex items-center gap-4 text-caption">
              <EvidenceBlock tier="contextual" value={data.block_status}>
                {(v) => (
                  <span className="text-label font-mono px-4 py-px rounded bg-error-subtle text-error">
                    {String(v)}
                  </span>
                )}
              </EvidenceBlock>
              <EvidenceBlock tier="contextual" value={data.block_reason}>
                {(v) => (
                  <span className="text-text-tertiary">{String(v)}</span>
                )}
              </EvidenceBlock>
              <EvidenceBlock tier="contextual" value={data.contract_ref}>
                {(v) => (
                  <span className="text-label font-mono px-4 py-px rounded bg-surface-secondary text-text-secondary">
                    {String(v)}
                  </span>
                )}
              </EvidenceBlock>
            </div>
          </div>
        </div>

        {/* ── Order Lines (collapsible) ────────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowLines((v) => !v)}
            className="flex w-full items-center gap-8 text-left bg-transparent border-none cursor-pointer px-0 py-0"
          >
            <span className="text-caption font-semibold text-text-secondary flex-1">
              Order Lines ({data.order_lines.length})
            </span>
            <ChevronDown
              size={12}
              className={cn(
                "text-text-quaternary transition-transform duration-fast",
                !showLines && "-rotate-90",
              )}
            />
          </button>

          {showLines && (
            <div className="mt-8 rounded-md border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_56px] gap-4 px-10 py-6 bg-surface-secondary border-b border-border text-label font-bold uppercase tracking-wider text-text-quaternary">
                <span>SKU</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Max</span>
                <span className="text-right">Excess</span>
                <span className="text-center">Layer</span>
              </div>
              {data.order_lines.map((line) => (
                <div
                  key={line.sku}
                  className="grid grid-cols-[1fr_80px_80px_80px_56px] gap-4 px-10 py-6 border-b border-border last:border-b-0 text-caption hover:bg-surface-row-hover transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-text-primary">{line.sku}</span>
                    <span className="text-text-tertiary ml-4">{line.description}</span>
                  </div>
                  <span className="text-right font-mono text-text-primary">{line.qty.toLocaleString()}</span>
                  <span className="text-right font-mono text-text-secondary">{line.max_line_qty.toLocaleString()}</span>
                  <span className={cn(
                    "text-right font-mono font-bold",
                    line.excess > 0 ? "text-error" : "text-success",
                  )}>
                    {line.excess > 0 ? `+${line.excess.toLocaleString()}` : "OK"}
                  </span>
                  <span className="text-center">
                    {line.is_even_layer_item ? (
                      <span className="text-label px-2 py-px rounded-full bg-info-subtle text-info">EL</span>
                    ) : (
                      <span className="text-text-quaternary">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── AI Trim Plan ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-8 mb-8">
            <Scissors size={14} className="text-brand" />
            <span className="text-label font-bold uppercase tracking-wider text-text-quaternary">
              AI Trim Plan
            </span>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_72px] gap-4 px-10 py-6 bg-surface-secondary border-b border-border text-label font-bold uppercase tracking-wider text-text-quaternary">
              <span>SKU</span>
              <span className="text-right">Ordered</span>
              <span className="text-right">Trim To</span>
              <span className="text-right">Delta</span>
              <span className="text-center">Action</span>
            </div>

            {data.trim_plan.map((line) => (
              <TrimPlanRow key={line.sku} line={line} uom={data.uom} />
            ))}

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_72px] gap-4 px-10 py-8 bg-surface-secondary border-t-2 border-border text-caption font-bold">
              <span className="text-text-primary">TOTAL</span>
              <span className="text-right font-mono text-text-primary">
                {data.total_ordered.toLocaleString()}
              </span>
              <span className="text-right font-mono text-brand">
                {trimmedTotal.toLocaleString()}
              </span>
              <span className="text-right font-mono text-error">
                {deltaTotal > 0 ? `-${deltaTotal.toLocaleString()}` : "0"}
              </span>
              <span />
            </div>
          </div>

          {/* Human-in-loop callout */}
          <div className="mt-8 flex items-start gap-8 p-10 rounded-md border border-warning bg-warning-subtle">
            <AlertTriangle size={14} className="text-warning shrink-0 mt-px" />
            <div className="text-caption text-text-secondary leading-relaxed">
              <strong>Human-in-loop:</strong> Trim actions exceeding $10,000 or affecting VIP accounts require manual approval. Lines marked SKIP need Sales Manager review before trimming.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function TrimPlanRow({ line, uom }: { line: TrimPlanLine; uom: string }) {
  const actionIcon = {
    TRIM: <Scissors size={10} />,
    SKIP: <SkipForward size={10} />,
    OK: <Check size={10} />,
  }[line.action];

  const actionColor = {
    TRIM: "bg-warning-subtle text-warning",
    SKIP: "bg-error-subtle text-error",
    OK: "bg-success-subtle text-success",
  }[line.action];

  return (
    <div className="grid grid-cols-[1fr_80px_80px_80px_72px] gap-4 px-10 py-6 border-b border-border last:border-b-0 text-caption hover:bg-surface-row-hover transition-colors">
      <div className="min-w-0">
        <span className="font-mono font-bold text-text-primary">{line.sku}</span>
        <span className="text-text-tertiary ml-4">{line.description}</span>
      </div>
      <span className="text-right font-mono text-text-primary">{line.ordered.toLocaleString()}</span>
      <span className={cn(
        "text-right font-mono font-bold",
        line.action === "TRIM" ? "text-brand" : "text-text-primary",
      )}>
        {line.trimmed_to.toLocaleString()}
      </span>
      <span className={cn(
        "text-right font-mono",
        line.delta > 0 ? "text-error font-bold" : "text-text-tertiary",
      )}>
        {line.delta > 0 ? `-${line.delta.toLocaleString()}` : "0"}
      </span>
      <span className="flex items-center justify-center">
        <span className={cn("inline-flex items-center gap-2 text-label font-bold px-4 py-px rounded-full", actionColor)}>
          {actionIcon}
          {line.action}
        </span>
      </span>
    </div>
  );
}
