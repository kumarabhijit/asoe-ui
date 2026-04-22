/**
 * MOQSection — Data-presence-driven enrichment for Min Order Qty exceptions.
 *
 * Renders ONLY when `analysis.moq_analysis` is present.
 * Shows shortfall gap bar, SAP V4082 block detail, AI round-up plan,
 * and SAP execution steps.
 * Intent-agnostic: any intent producing moq_analysis data renders this section.
 */
"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUp, AlertTriangle, ChevronDown, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type { MOQAnalysisData, RoundUpPlanLine } from "@/types/exceptions";
import { fmtPrice } from "./shared";

interface MOQSectionProps {
  data: MOQAnalysisData;
}

export function MOQSection({ data }: MOQSectionProps) {
  const [showSteps, setShowSteps] = useState(false);

  const maxVal = Math.max(data.ordered_qty, data.moq_qty, 1);
  const orderedPct = (data.ordered_qty / maxVal) * 100;
  const moqPct = (data.moq_qty / maxVal) * 100;

  const roundedTotal = data.round_up_plan.reduce((s, l) => s + l.round_up_to, 0);
  const deltaTotal = data.round_up_plan.reduce((s, l) => s + l.delta, 0);

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-16 py-10 border-b border-border">
        <div className="flex items-center gap-8">
          <ArrowDownRight size={14} className="text-warning" />
          <span className="text-subhead font-semibold text-text-primary">
            Min Order Qty Analysis
          </span>
        </div>
        <span className="text-label font-bold px-6 py-1 rounded-full bg-warning-subtle text-warning">
          {data.shortfall_pct.toFixed(0)}% below MOQ
        </span>
      </div>

      <div className="p-16 flex flex-col gap-16">
        {/* ── Shortfall Gap Bar ────────────────────────────────────────── */}
        <div>
          <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
            Order Shortfall
          </div>

          {/* Ordered bar */}
          <div className="flex items-center gap-8 mb-6">
            <span className="text-caption text-text-tertiary w-[60px] shrink-0 text-right">
              Ordered
            </span>
            <div className="flex-1 h-[24px] bg-surface-secondary rounded-sm overflow-hidden relative">
              <div
                className="h-full bg-warning rounded-sm transition-all duration-normal"
                style={{ width: `${orderedPct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-8 text-caption font-bold text-text-primary">
                {data.ordered_qty.toLocaleString()} {data.uom}
              </span>
            </div>
          </div>

          {/* MOQ bar */}
          <div className="flex items-center gap-8 mb-6">
            <span className="text-caption text-text-tertiary w-[60px] shrink-0 text-right">
              MOQ
            </span>
            <div className="flex-1 h-[24px] bg-surface-secondary rounded-sm overflow-hidden relative">
              <div
                className="h-full bg-brand rounded-sm transition-all duration-normal"
                style={{ width: `${moqPct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-8 text-caption font-bold text-text-primary">
                {data.moq_qty.toLocaleString()} {data.uom}
              </span>
            </div>
          </div>

          {/* Shortfall indicator */}
          <div className="flex items-center gap-8">
            <span className="w-[60px]" />
            <div className="flex items-center gap-6 text-caption text-warning font-medium">
              <ArrowDownRight size={12} />
              <span>
                Shortfall: {data.shortfall_qty.toLocaleString()} {data.uom} ({data.shortfall_pct.toFixed(1)}%) — At Risk: {fmtPrice(data.at_risk)}
              </span>
            </div>
          </div>
        </div>

        {/* ── SAP V4082 Block Detail ─────────────────────────────────────
            Block detail is the SAP / contract gateway view —
            grandfathered audit-bearing per moq_gateway_gap clause
            (deadline 2026-07-21). Each row uses EvidenceBlock so it
            structurally omits when the gateway hasn't populated it.
            We only render the outer card if AT LEAST ONE of the
            block-detail fields is present. */}
        {(data.block_status || data.block_message || data.moq_source ||
          data.channel || data.contract_ref) && (
          <div className="p-12 rounded-md border border-error bg-error-subtle">
            <EvidenceBlock tier="contextual" value={data.block_status}>
              {(v) => (
                <div className="flex items-center gap-6 mb-6">
                  <AlertTriangle size={14} className="text-error shrink-0" />
                  <span className="text-caption font-bold text-error">
                    SAP Block: {String(v)}
                  </span>
                </div>
              )}
            </EvidenceBlock>
            <EvidenceBlock tier="contextual" value={data.block_message}>
              {(v) => (
                <p className="text-caption text-text-secondary leading-relaxed m-0 mb-6">
                  {String(v)}
                </p>
              )}
            </EvidenceBlock>
            <div className="flex flex-wrap gap-6 text-label">
              <EvidenceBlock tier="contextual" value={data.moq_source}>
                {(v) => (
                  <span className="font-mono px-4 py-px rounded bg-surface-primary text-text-secondary">
                    MOQ Source: {String(v)}
                  </span>
                )}
              </EvidenceBlock>
              <EvidenceBlock tier="contextual" value={data.channel}>
                {(v) => (
                  <span className="font-mono px-4 py-px rounded bg-surface-primary text-text-secondary">
                    Channel: {String(v)}
                  </span>
                )}
              </EvidenceBlock>
              <EvidenceBlock tier="contextual" value={data.contract_ref}>
                {(v) => (
                  <span className="font-mono px-4 py-px rounded bg-surface-primary text-text-secondary">
                    Contract: {String(v)}
                  </span>
                )}
              </EvidenceBlock>
            </div>
          </div>
        )}

        {/* ── AI Round-Up Plan ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-8 mb-8">
            <ArrowUp size={14} className="text-brand" />
            <span className="text-label font-bold uppercase tracking-wider text-text-quaternary">
              AI Round-Up Plan
            </span>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_88px] gap-4 px-10 py-6 bg-surface-secondary border-b border-border text-label font-bold uppercase tracking-wider text-text-quaternary">
              <span>SKU</span>
              <span className="text-right">Ordered</span>
              <span className="text-right">Round Up</span>
              <span className="text-right">Delta</span>
              <span className="text-center">Action</span>
            </div>

            {data.round_up_plan.map((line) => (
              <RoundUpRow key={line.sku} line={line} uom={data.uom} />
            ))}

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_80px_80px_80px_88px] gap-4 px-10 py-8 bg-surface-secondary border-t-2 border-border text-caption font-bold">
              <span className="text-text-primary">TOTAL</span>
              <span className="text-right font-mono text-text-primary">
                {data.ordered_qty.toLocaleString()}
              </span>
              <span className="text-right font-mono text-brand">
                {roundedTotal.toLocaleString()}
              </span>
              <span className="text-right font-mono text-success">
                +{deltaTotal.toLocaleString()}
              </span>
              <span />
            </div>
          </div>
        </div>

        {/* ── SAP Execution Steps (collapsible) ──────────────────────────
            sap_steps is a UI-only legacy field; the backend doesn't
            currently produce it. Render only when present (mock fixtures
            still supply it for demo). Per CLAUDE.md Guardrail 6, do not
            synthesise these in the UI. */}
        {(data.sap_steps?.length ?? 0) > 0 && (
          <div>
            <button
              onClick={() => setShowSteps((v) => !v)}
              className="flex w-full items-center gap-8 text-left bg-transparent border-none cursor-pointer px-0 py-0"
            >
              <Database size={14} className="text-text-tertiary" />
              <span className="text-caption font-semibold text-text-secondary flex-1">
                SAP Execution Steps ({(data.sap_steps ?? []).length})
              </span>
              <ChevronDown
                size={12}
                className={cn(
                  "text-text-quaternary transition-transform duration-fast",
                  !showSteps && "-rotate-90",
                )}
              />
            </button>

            {showSteps && (
              <div className="mt-8 rounded-md border border-border overflow-hidden">
                {(data.sap_steps ?? []).map((step) => (
                  <div
                    key={step.step}
                    className="flex items-center gap-8 px-10 py-6 border-b border-border last:border-b-0 text-caption hover:bg-surface-row-hover transition-colors"
                  >
                    <span className="w-[20px] h-[20px] rounded-full bg-brand-subtle text-brand text-label font-bold flex items-center justify-center shrink-0">
                      {step.step}
                    </span>
                    <span className="text-text-primary flex-1">{step.description}</span>
                    <span className="font-mono px-4 py-px rounded bg-info-subtle text-info text-label shrink-0">
                      {step.transaction}
                    </span>
                    <span className="font-mono px-4 py-px rounded bg-surface-secondary text-text-secondary text-label shrink-0">
                      {step.table}
                    </span>
                    <span className="font-mono px-4 py-px rounded bg-surface-secondary text-text-tertiary text-label shrink-0">
                      {step.field}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Human-in-loop callout */}
        <div className="flex items-start gap-8 p-10 rounded-md border border-warning bg-warning-subtle">
          <AlertTriangle size={14} className="text-warning shrink-0 mt-px" />
          <div className="text-caption text-text-secondary leading-relaxed">
            <strong>Human-in-loop:</strong> Round-up actions have a 24-hour timeout. Lines marked ESCALATE require Sales Manager approval. KNMT waiver requests need written justification.
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function RoundUpRow({ line, uom }: { line: RoundUpPlanLine; uom: string }) {
  const actionColor = {
    ROUND_UP: "bg-success-subtle text-success",
    ACCEPT_BELOW: "bg-info-subtle text-info",
    ESCALATE: "bg-error-subtle text-error",
  }[line.action];

  const actionIcon = {
    ROUND_UP: <ArrowUp size={10} />,
    ACCEPT_BELOW: <ArrowDownRight size={10} />,
    ESCALATE: <AlertTriangle size={10} />,
  }[line.action];

  return (
    <div className="grid grid-cols-[1fr_80px_80px_80px_88px] gap-4 px-10 py-6 border-b border-border last:border-b-0 text-caption hover:bg-surface-row-hover transition-colors">
      <div className="min-w-0">
        <span className="font-mono font-bold text-text-primary">{line.sku}</span>
        <span className="text-text-tertiary ml-4">{line.description}</span>
      </div>
      <span className="text-right font-mono text-text-primary line-through text-text-tertiary">
        {line.ordered.toLocaleString()}
      </span>
      <span className={cn(
        "text-right font-mono font-bold",
        line.action === "ROUND_UP" ? "text-brand" : "text-text-primary",
      )}>
        {line.round_up_to.toLocaleString()}
      </span>
      <span className="text-right font-mono text-success font-bold">
        {line.delta > 0 ? `+${line.delta.toLocaleString()}` : "0"}
      </span>
      <span className="flex items-center justify-center">
        <span className={cn("inline-flex items-center gap-2 text-label font-bold px-4 py-px rounded-full whitespace-nowrap", actionColor)}>
          {actionIcon}
          {line.action.replace("_", " ")}
        </span>
      </span>
    </div>
  );
}
