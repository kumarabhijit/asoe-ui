/**
 * PriceAnalysisSection — Data-presence-driven enrichment for pricing exceptions.
 *
 * Renders ONLY when `analysis.price_analysis` is present.
 * Shows price delta visualization, key metric tiles, and SAP context.
 * Intent-agnostic: any intent producing price_analysis data renders this section.
 */
"use client";

import { useState } from "react";
import { DollarSign, TrendingDown, Package, FileText, AlertTriangle, Tag, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PriceAnalysisData } from "@/types/exceptions";
import { fmtPrice } from "./shared";

interface PriceAnalysisSectionProps {
  data: PriceAnalysisData;
}

export function PriceAnalysisSection({ data }: PriceAnalysisSectionProps) {
  const [showSapContext, setShowSapContext] = useState(false);

  const maxPrice = Math.max(data.erp_unit_price, data.po_unit_price);
  const erpPct = maxPrice > 0 ? (data.erp_unit_price / maxPrice) * 100 : 0;
  const poPct = maxPrice > 0 ? (data.po_unit_price / maxPrice) * 100 : 0;
  const isPoBelow = data.po_unit_price < data.erp_unit_price;

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-16 py-10 border-b border-border">
        <div className="flex items-center gap-8">
          <DollarSign size={14} className="text-brand" />
          <span className="text-subhead font-semibold text-text-primary">
            Price Delta Analysis
          </span>
        </div>
        <span
          className={cn(
            "text-label font-bold px-6 py-1 rounded-full",
            data.variance_pct > 10
              ? "bg-error-subtle text-error"
              : data.variance_pct > 5
                ? "bg-warning-subtle text-warning"
                : "bg-info-subtle text-info",
          )}
        >
          {data.variance_pct.toFixed(1)}% variance
        </span>
      </div>

      <div className="p-16">
        {/* ── Price Delta Visualization ────────────────────────────────── */}
        <div className="mb-16">
          <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
            Price Comparison (per {data.uom})
          </div>

          {/* ERP Price Bar */}
          <div className="flex items-center gap-8 mb-6">
            <span className="text-caption text-text-tertiary w-[52px] shrink-0 text-right">
              ERP
            </span>
            <div className="flex-1 h-[24px] bg-surface-secondary rounded-sm overflow-hidden relative">
              <div
                className="h-full bg-brand rounded-sm transition-all duration-normal"
                style={{ width: `${erpPct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-8 text-caption font-bold text-text-primary">
                {fmtPrice(data.erp_unit_price)}/{data.uom}
              </span>
            </div>
          </div>

          {/* PO Price Bar */}
          <div className="flex items-center gap-8 mb-6">
            <span className="text-caption text-text-tertiary w-[52px] shrink-0 text-right">
              PO
            </span>
            <div className="flex-1 h-[24px] bg-surface-secondary rounded-sm overflow-hidden relative">
              <div
                className={cn(
                  "h-full rounded-sm transition-all duration-normal",
                  isPoBelow ? "bg-warning" : "bg-success",
                )}
                style={{ width: `${poPct}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-end pr-8 text-caption font-bold text-text-primary">
                {fmtPrice(data.po_unit_price)}/{data.uom}
              </span>
            </div>
          </div>

          {/* Delta indicator */}
          {isPoBelow && (
            <div className="flex items-center gap-8 mt-4">
              <span className="w-[52px]" />
              <div className="flex items-center gap-4 text-caption text-error font-medium">
                <TrendingDown size={12} />
                <span>
                  PO is {fmtPrice(data.variance_amount)} below ERP ({data.variance_pct.toFixed(1)}% shortfall)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Metric Tiles ────────────────────────────────────────────── */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-8 mb-16">
          <MetricTile
            icon={<DollarSign size={14} />}
            label="ERP / Unit"
            value={`${fmtPrice(data.erp_unit_price)}`}
          />
          <MetricTile
            icon={<Tag size={14} />}
            label="PO / Unit"
            value={`${fmtPrice(data.po_unit_price)}`}
            highlight={isPoBelow}
          />
          <MetricTile
            icon={<TrendingDown size={14} />}
            label="Variance"
            value={`${data.variance_pct.toFixed(1)}%`}
            highlight={data.variance_pct > 10}
          />
          <MetricTile
            icon={<AlertTriangle size={14} />}
            label="At Risk"
            value={fmtPrice(data.total_at_risk)}
            highlight
          />
        </div>

        {/* ── SAP Context Card (collapsible) ──────────────────────────── */}
        <button
          onClick={() => setShowSapContext((v) => !v)}
          className="flex w-full items-center gap-8 px-12 py-8 rounded-md border border-border bg-surface-secondary hover:bg-surface-row-hover transition-colors cursor-pointer text-left"
        >
          <FileText size={14} className="text-text-tertiary shrink-0" />
          <span className="text-caption font-semibold text-text-secondary flex-1">
            SAP Context
          </span>
          <span className="text-label text-text-quaternary">
            {showSapContext ? "Hide" : "Show"}
          </span>
        </button>

        {showSapContext && (
          <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-16 gap-y-6 px-12 py-10 rounded-md border border-border bg-surface-secondary text-caption">
            <SapRow label="Doc Type" value={data.doc_type} />
            <SapRow label="Doc Number" value={data.doc_number} mono />
            <SapRow label="SKU" value={data.sku} mono />
            <SapRow label="Material" value={data.material_desc} />
            <SapRow label="Quantity" value={`${data.total_quantity.toLocaleString()} ${data.uom}`} />
            <SapRow label="Order Date" value={new Date(data.order_date).toLocaleDateString()} />
            <SapRow label="Rule" value={data.rule_id} mono highlight />
            <SapRow label="Root Cause" value={data.root_cause_category} />
            {data.contract_ref && <SapRow label="Contract" value={data.contract_ref} mono />}
            {data.promotion_ref && (
              <SapRow
                label="Promotion"
                value={data.promotion_ref}
                mono
                icon={<Calendar size={10} className="text-warning" />}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function MetricTile({ icon, label, value, highlight }: {
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
      <span
        className={cn(
          "text-subhead font-bold font-mono",
          highlight ? "text-error" : "text-text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SapRow({ label, value, mono, highlight, icon }: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 min-w-0">
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="text-text-tertiary min-w-[64px] shrink-0">{label}</span>
      <span
        className={cn(
          "overflow-hidden text-ellipsis whitespace-nowrap",
          mono && "font-mono",
          highlight ? "text-brand font-bold" : "text-text-primary font-medium",
        )}
      >
        {value}
      </span>
    </div>
  );
}
