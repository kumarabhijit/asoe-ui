/**
 * BackOrderSection — Data-presence-driven enrichment for back-order/OOS exceptions.
 *
 * Renders ONLY when `analysis.backorder_analysis` is present.
 * Shows gap visualization, DC inventory snapshot, substitute SKUs,
 * and ranked resolution options with multi-dimensional scoring.
 * Intent-agnostic: any intent producing backorder_analysis data renders this section.
 */
"use client";

import { useState } from "react";
import { Package, Warehouse, ArrowRight, Truck, Star, ChevronDown, Factory, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { GapBar } from "@/components/ui/GapBar";
import type { BackOrderAnalysisData, ResolutionOption } from "@/types/exceptions";
import { fmtPrice } from "./shared";

interface BackOrderSectionProps {
  data: BackOrderAnalysisData;
}

export function BackOrderSection({ data }: BackOrderSectionProps) {
  const [showInventory, setShowInventory] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(
    data.resolution_options.find((o) => o.recommended)?.id ?? null,
  );

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-16 py-10 border-b border-border">
        <div className="flex items-center gap-8">
          <Package size={14} className="text-warning" />
          <span className="text-subhead font-semibold text-text-primary">
            Back-Order / OOS Analysis
          </span>
        </div>
        <span className="text-label font-bold px-6 py-1 rounded-full bg-error-subtle text-error">
          {data.gap_pct.toFixed(0)}% gap
        </span>
      </div>

      <div className="p-16 flex flex-col gap-16">
        {/* ── Gap Visualization ────────────────────────────────────────── */}
        <div>
          <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
            Inventory Gap
          </div>
          <GapBar
            primaryQty={data.ordered_qty}
            primaryLabel="Ordered"
            secondaryQty={data.available_qty}
            secondaryLabel="Available"
            uom={data.uom}
            mode="shortfall"
          />
          <div className="flex items-center gap-8 mt-8 text-caption text-text-tertiary">
            <span>ATP Date: <strong className="text-text-primary font-mono">{new Date(data.atp_date).toLocaleDateString()}</strong></span>
            <span className="text-border">|</span>
            <span>At Risk: <strong className="text-error font-mono">{fmtPrice(data.at_risk)}</strong></span>
          </div>
        </div>

        {/* ── DC Inventory Snapshot ────────────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowInventory((v) => !v)}
            className="flex w-full items-center gap-8 text-left bg-transparent border-none cursor-pointer px-0 py-0"
          >
            <Warehouse size={14} className="text-text-tertiary" />
            <span className="text-caption font-semibold text-text-secondary flex-1">
              DC Inventory ({1 + data.alternate_warehouses.length} locations)
            </span>
            <ChevronDown
              size={12}
              className={cn(
                "text-text-quaternary transition-transform duration-fast",
                !showInventory && "-rotate-90",
              )}
            />
          </button>

          {showInventory && (
            <div className="mt-8 rounded-md border border-border overflow-hidden">
              {/* Primary DC */}
              <div className="flex items-center gap-8 px-12 py-8 bg-brand-subtle border-b border-border">
                <Star size={12} className="text-brand shrink-0" />
                <span className="text-caption font-bold text-text-primary flex-1">
                  {data.primary_dc.name}
                </span>
                <span className="text-caption text-text-tertiary">{data.primary_dc.region}</span>
                <span className="text-caption font-bold font-mono text-text-primary">
                  {data.primary_dc.qty.toLocaleString()} {data.uom}
                </span>
              </div>

              {/* Alternate warehouses */}
              {data.alternate_warehouses.map((wh) => (
                <div
                  key={wh.plant}
                  className="flex items-center gap-8 px-12 py-6 border-b border-border last:border-b-0 hover:bg-surface-row-hover transition-colors"
                >
                  <Truck size={12} className="text-text-quaternary shrink-0" />
                  <span className="text-caption text-text-primary flex-1">{wh.name}</span>
                  <span className="text-label text-text-tertiary">{wh.region}</span>
                  <span className="text-caption font-mono text-text-primary">{wh.qty.toLocaleString()} {data.uom}</span>
                  <span className="text-label text-text-tertiary">{wh.eta_days}d</span>
                  <span className={cn(
                    "text-label font-mono",
                    wh.freight_delta_per_unit > 0 ? "text-warning" : "text-success",
                  )}>
                    {wh.freight_delta_per_unit > 0 ? "+" : ""}{fmtPrice(wh.freight_delta_per_unit)}/u
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Production & Substitutes ─────────────────────────────────── */}
        {(data.production || data.inbound_po || data.substitutes.length > 0) && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-8">
            {data.production && (
              <div className="p-10 rounded-md border border-border bg-surface-secondary">
                <div className="flex items-center gap-4 text-text-quaternary mb-4">
                  <Factory size={12} />
                  <span className="text-label font-bold uppercase tracking-wider">Production</span>
                </div>
                <div className="text-caption text-text-primary">
                  <span className="font-mono font-bold">{data.production.qty.toLocaleString()} {data.uom}</span>
                  <span className="text-text-tertiary"> due </span>
                  <span className="font-mono">{new Date(data.production.date).toLocaleDateString()}</span>
                </div>
              </div>
            )}
            {data.inbound_po && (
              <div className="p-10 rounded-md border border-border bg-surface-secondary">
                <div className="flex items-center gap-4 text-text-quaternary mb-4">
                  <Package size={12} />
                  <span className="text-label font-bold uppercase tracking-wider">Inbound PO</span>
                </div>
                <div className="text-caption text-text-primary">
                  <span className="font-mono font-bold">{data.inbound_po.po_num}</span>
                  <span className="text-text-tertiary"> — </span>
                  <span className="font-mono">{data.inbound_po.qty.toLocaleString()} {data.uom}</span>
                  <span className="text-text-tertiary"> ETA </span>
                  <span className="font-mono">{new Date(data.inbound_po.eta).toLocaleDateString()}</span>
                </div>
              </div>
            )}
            {data.substitutes.length > 0 && (
              <div className="p-10 rounded-md border border-border bg-surface-secondary col-span-full">
                <div className="flex items-center gap-4 text-text-quaternary mb-6">
                  <Tag size={12} />
                  <span className="text-label font-bold uppercase tracking-wider">Substitute SKUs</span>
                </div>
                <div className="flex flex-col gap-4">
                  {data.substitutes.map((sub) => (
                    <div key={sub.sku} className="flex items-center gap-6 text-caption">
                      <span className="font-mono text-brand font-bold">{sub.sku}</span>
                      <span className="text-text-primary flex-1">{sub.description}</span>
                      <span className="font-mono text-text-secondary">{sub.available_qty.toLocaleString()} avail</span>
                      <span className={cn(
                        "font-mono",
                        sub.price_delta_pct > 0 ? "text-error" : sub.price_delta_pct < 0 ? "text-success" : "text-text-tertiary",
                      )}>
                        {sub.price_delta_pct > 0 ? "+" : ""}{sub.price_delta_pct.toFixed(1)}%
                      </span>
                      <span className="text-text-tertiary">{(sub.acceptance_rate * 100).toFixed(0)}% accept</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Resolution Options (Ranked) ──────────────────────────────── */}
        {data.resolution_options.length > 0 && (
          <div>
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
              Resolution Options ({data.resolution_options.length} ranked)
            </div>
            <div className="flex flex-col gap-8">
              {data.resolution_options.map((option, i) => (
                <ResolutionOptionCard
                  key={option.id}
                  option={option}
                  rank={i + 1}
                  selected={selectedOption === option.id}
                  onSelect={() => setSelectedOption(option.id)}
                  uom={data.uom}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Resolution Option Card ──────────────────────────────────────────── */

function ResolutionOptionCard({ option, rank, selected, onSelect, uom }: {
  option: ResolutionOption;
  rank: number;
  selected: boolean;
  onSelect: () => void;
  uom: string;
}) {
  const scoreColor = (score: number) =>
    score >= 0.8 ? "text-success" : score >= 0.5 ? "text-warning" : "text-error";

  const scoreBg = (score: number) =>
    score >= 0.8 ? "bg-success" : score >= 0.5 ? "bg-warning" : "bg-error";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-12 rounded-md border-2 transition-all cursor-pointer bg-surface-primary",
        selected ? "border-brand shadow-sm" : "border-border hover:border-brand-ring",
        option.recommended && !selected && "border-success",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-8 mb-8">
        <span className={cn(
          "w-[24px] h-[24px] rounded-full flex items-center justify-center text-label font-bold",
          option.recommended ? "bg-success [color:white]" : "bg-surface-secondary text-text-secondary",
        )}>
          {rank}
        </span>
        <span className="text-caption font-bold text-text-primary flex-1">
          {option.title}
        </span>
        {option.recommended && (
          <span className="text-label font-bold px-4 py-px rounded-full bg-success-subtle text-success">
            Top Pick
          </span>
        )}
        <span className={cn("text-subhead font-bold font-mono", scoreColor(option.composite_score))}>
          {(option.composite_score * 100).toFixed(0)}%
        </span>
      </div>

      {/* Description */}
      <p className="text-caption text-text-secondary leading-relaxed m-0 mb-8">
        {option.description}
      </p>

      {/* Score bars */}
      <div className="grid grid-cols-4 gap-6">
        {(Object.entries(option.scores) as [string, number][]).map(([dim, score]) => (
          <div key={dim} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-label text-text-quaternary capitalize">{dim}</span>
              <span className={cn("text-label font-bold font-mono", scoreColor(score))}>
                {(score * 100).toFixed(0)}
              </span>
            </div>
            <div className="h-[4px] bg-surface-secondary rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-normal", scoreBg(score))}
                style={{ width: `${score * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* SAP Steps */}
      {option.sap_steps.length > 0 && (
        <div className="flex items-center gap-4 mt-8 flex-wrap">
          <ArrowRight size={10} className="text-text-quaternary" />
          {option.sap_steps.map((step) => (
            <span
              key={step}
              className="text-label font-mono px-4 py-px rounded bg-surface-secondary text-text-secondary"
            >
              {step}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
