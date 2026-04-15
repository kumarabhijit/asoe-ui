/**
 * PalletConfigSection — Data-presence-driven enrichment for pallet config exceptions.
 *
 * Renders ONLY when `analysis.pallet_analysis` is present.
 * Shows KPI strip, per-line pallet fill bars, and AI suggested plan.
 * Intent-agnostic: any intent producing pallet_analysis data renders this section.
 */
"use client";

import { useState } from "react";
import { Layers, Package, Clock, Truck, ChevronDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PalletAnalysisData, PalletLine } from "@/types/exceptions";
import { fmtPrice } from "./shared";

interface PalletConfigSectionProps {
  data: PalletAnalysisData;
}

export function PalletConfigSection({ data }: PalletConfigSectionProps) {
  const [showPlan, setShowPlan] = useState(true);

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-16 py-10 border-b border-border">
        <div className="flex items-center gap-8">
          <Layers size={14} className="text-warning" />
          <span className="text-subhead font-semibold text-text-primary">
            Pallet Configuration Analysis
          </span>
        </div>
        <span className="text-label font-bold px-6 py-1 rounded-full bg-warning-subtle text-warning">
          {data.loose_cases_total} loose cases
        </span>
      </div>

      <div className="p-16 flex flex-col gap-16">
        {/* ── KPI Strip ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-8">
          <KPITile icon={<Package size={14} />} label="Total Cases" value={data.total_ordered_cases.toLocaleString()} />
          <KPITile icon={<Layers size={14} />} label="Loose Cases" value={data.loose_cases_total.toLocaleString()} highlight />
          <KPITile icon={<Clock size={14} />} label="Extra Labor" value={`${data.extra_labor_est_hrs.toFixed(1)} hrs`} highlight={data.extra_labor_est_hrs > 1} />
          <KPITile icon={<Truck size={14} />} label="Freight Waste" value={`${data.freight_waste_pct.toFixed(1)}%`} highlight={data.freight_waste_pct > 5} />
        </div>

        {/* ── Per-Line Pallet Fill ─────────────────────────────────────── */}
        <div>
          <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
            Line-by-Line Pallet Alignment ({data.lines.length} lines)
          </div>

          <div className="flex flex-col gap-8">
            {data.lines.map((line) => (
              <PalletLineCard key={line.sku} line={line} />
            ))}
          </div>
        </div>

        {/* ── AI Suggested Plan ─────────────────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowPlan((v) => !v)}
            className="flex w-full items-center gap-8 text-left bg-transparent border-none cursor-pointer px-0 py-0 mb-8"
          >
            <Layers size={14} className="text-brand" />
            <span className="text-label font-bold uppercase tracking-wider text-text-quaternary flex-1">
              AI Suggested Plan
            </span>
            <ChevronDown
              size={12}
              className={cn(
                "text-text-quaternary transition-transform duration-fast",
                !showPlan && "-rotate-90",
              )}
            />
          </button>

          {showPlan && (
            <div className="rounded-md border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_72px_72px_56px_56px_56px_1fr] gap-4 px-10 py-6 bg-surface-secondary border-b border-border text-label font-bold uppercase tracking-wider text-text-quaternary">
                <span>SKU</span>
                <span className="text-right">Current</span>
                <span className="text-right">Suggest</span>
                <span className="text-right">Delta</span>
                <span className="text-right">Layers</span>
                <span className="text-right">Pallets</span>
                <span>Reason</span>
              </div>

              {data.suggested_plan.map((row) => (
                <div
                  key={row.sku}
                  className="grid grid-cols-[1fr_72px_72px_56px_56px_56px_1fr] gap-4 px-10 py-6 border-b border-border last:border-b-0 text-caption hover:bg-surface-row-hover transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-text-primary">{row.sku}</span>
                    <span className="text-text-tertiary ml-4 hidden sm:inline">{row.description}</span>
                  </div>
                  <span className="text-right font-mono text-text-tertiary line-through">
                    {row.current.toLocaleString()}
                  </span>
                  <span className="text-right font-mono font-bold text-brand">
                    {row.suggested.toLocaleString()}
                  </span>
                  <span className={cn(
                    "text-right font-mono font-bold",
                    row.delta > 0 ? "text-success" : row.delta < 0 ? "text-error" : "text-text-tertiary",
                  )}>
                    {row.delta > 0 ? `+${row.delta}` : row.delta === 0 ? "0" : row.delta.toString()}
                  </span>
                  <span className="text-right font-mono text-text-primary">{row.layers}</span>
                  <span className="text-right font-mono text-text-primary">{row.full_pallets}</span>
                  <span className="text-text-secondary truncate">{row.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function KPITile({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 p-10 rounded-md border border-border bg-surface-secondary">
      <div className="flex items-center gap-4 text-text-quaternary">
        {icon}
        <span className="text-label font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn(
        "text-subhead font-bold font-mono",
        highlight ? "text-warning" : "text-text-primary",
      )}>
        {value}
      </span>
    </div>
  );
}

function PalletLineCard({ line }: { line: PalletLine }) {
  const fillColor = line.pallet_fill_pct >= 95
    ? "bg-success"
    : line.pallet_fill_pct >= 75
      ? "bg-info"
      : line.pallet_fill_pct >= 50
        ? "bg-warning"
        : "bg-error";

  const violationColor = line.violation_type === "Broken Layer"
    ? "bg-error-subtle text-error"
    : "bg-warning-subtle text-warning";

  return (
    <div className="p-10 rounded-md border border-border bg-surface-secondary">
      {/* SKU header + violation badge */}
      <div className="flex items-center gap-8 mb-6">
        <span className="font-mono font-bold text-text-primary text-caption">{line.sku}</span>
        <span className="text-caption text-text-tertiary flex-1">{line.description}</span>
        <span className={cn("text-label font-bold px-4 py-px rounded-full", violationColor)}>
          {line.violation_type}
        </span>
      </div>

      {/* Pallet fill bar */}
      <div className="flex items-center gap-8 mb-6">
        <span className="text-label text-text-tertiary w-[48px] shrink-0 text-right">Fill</span>
        <div className="flex-1 h-[16px] bg-surface-primary rounded-sm overflow-hidden relative">
          <div
            className={cn("h-full rounded-sm transition-all duration-normal", fillColor)}
            style={{ width: `${Math.min(line.pallet_fill_pct, 100)}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-end pr-6 text-label font-bold text-text-primary">
            {line.pallet_fill_pct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-4 text-label">
        <MetaItem label="Ordered" value={`${line.ordered_qty} ${line.uom}`} />
        <MetaItem label="Layer Qty" value={line.layer_qty.toString()} />
        <MetaItem label="Pallet Qty" value={line.pallet_qty.toString()} />
        <MetaItem label="Full Layers" value={line.complete_layers.toString()} />
        <MetaItem label="Loose" value={line.loose_qty.toString()} highlight={line.loose_qty > 0} />
        <MetaItem label="Full Pallets" value={line.full_pallets.toString()} />
      </div>
    </div>
  );
}

function MetaItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-px">
      <span className="text-text-quaternary uppercase tracking-wider">{label}</span>
      <span className={cn(
        "font-mono font-bold",
        highlight ? "text-warning" : "text-text-primary",
      )}>
        {value}
      </span>
    </div>
  );
}
