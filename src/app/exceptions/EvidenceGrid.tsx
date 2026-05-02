/**
 * EvidenceGrid — Layer 4 of the Exception Detail Panel.
 *
 * Collapsible evidence grid: line-item table + pricing waterfall.
 * Collapsed by default to reduce cognitive load.
 * Intent-agnostic — renders whatever line items and analysis are present.
 */
"use client";

import { useState } from "react";
import { FileText, ChevronDown } from "lucide-react";
import { PricingWaterfall } from "@/components/ui/PricingWaterfall";
import { Badge, rootCauseVariant } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { fmtPrice } from "./shared";
import type { LineItem, OrderAnalysis, LineItemAnalysis } from "@/types/exceptions";

interface EvidenceGridProps {
  lineItems: LineItem[];
  analysis: OrderAnalysis | null;
  selectedLine: string | null;
  onSelectLine: (id: string) => void;
  selectedAnalysis?: LineItemAnalysis;
  totalErp: number;
  totalPo: number;
  /** Optional lazy-load callback fired the first time the pane opens.
   *  Used by the parent to defer the lineItems API call until the
   *  operator actually opens this section (PO request #4). */
  onFirstOpen?: () => void;
}

export function EvidenceGrid({
  lineItems,
  analysis,
  selectedLine,
  onSelectLine,
  selectedAnalysis,
  totalErp,
  totalPo,
  onFirstOpen,
}: EvidenceGridProps) {
  const [expanded, setExpanded] = useState(false);

  // Allow the section to render even when lineItems hasn't loaded yet
  // — the operator can open it and the parent's lazy fetcher kicks in.
  // The "no lines" branch below handles the empty state.

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (next && onFirstOpen) onFirstOpen();
        }}
        className="flex w-full items-center justify-between px-16 py-10 bg-transparent border-none cursor-pointer font-sans"
      >
        <div className="flex items-center gap-8">
          <ChevronDown
            size={14}
            className={cn(
              "text-text-tertiary transition-transform duration-fast",
              !expanded && "-rotate-90",
            )}
          />
          <span className="text-subhead font-semibold text-text-primary">
            Evidence Detail
          </span>
          <span className="text-label font-semibold text-text-tertiary bg-surface-secondary px-2 py-px rounded-full">
            {lineItems.length === 0
              ? "—"
              : `${lineItems.length} line${lineItems.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-12 text-caption">
          <span className="text-text-tertiary">
            ERP <span className="font-mono font-semibold text-text-primary">{fmtPrice(totalErp)}</span>
          </span>
          <span className="text-text-tertiary">
            PO <span className={cn("font-mono font-semibold", totalPo !== totalErp ? "text-error" : "text-text-primary")}>{fmtPrice(totalPo)}</span>
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-16 py-12">
          {lineItems.length === 0 && (
            <div className="text-caption text-text-tertiary italic mb-12">
              Loading line items…
            </div>
          )}
          {/* Line item table */}
          <div className="overflow-x-auto mb-12">
            <table className="w-full border-collapse text-caption">
              <thead>
                <tr className="border-b border-border">
                  {["Line", "SKU", "Description", "Qty", "ERP", "PO", "Root Cause"].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "px-8 py-6 text-label font-bold uppercase tracking-wider text-text-tertiary",
                        ["Qty", "ERP", "PO"].includes(h) ? "text-right" : "text-left",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr
                    key={item.line_id}
                    onClick={() => onSelectLine(item.line_id)}
                    className={cn(
                      "border-b border-border-subtle cursor-pointer",
                      selectedLine === item.line_id && "bg-surface-row-active",
                    )}
                  >
                    <td className="px-8 py-6 font-mono font-semibold">{item.line_id}</td>
                    <td className="px-8 py-6 font-mono text-text-tertiary">{item.sku}</td>
                    <td className="px-8 py-6 text-text-secondary max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{item.description}</td>
                    <td className="px-8 py-6 text-right font-mono">{item.quantity.toLocaleString()}</td>
                    <td className="px-8 py-6 text-right font-mono">{fmtPrice(item.erp_price)}</td>
                    <td className={cn("px-8 py-6 text-right font-mono", item.po_price !== item.erp_price ? "text-error font-semibold" : "text-text-primary")}>
                      {fmtPrice(item.po_price)}
                    </td>
                    <td className="px-8 py-6">
                      {item.root_cause && <Badge variant={rootCauseVariant(item.root_cause)} size="sm" icon={null}>{item.root_cause.replace(/_/g, " ")}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Line selector pills (for waterfall) */}
          {analysis && analysis.lines.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-10">
              {lineItems.map((item) => {
                const la = analysis.lines.find((l) => l.line_id === item.line_id);
                const isSelected = selectedLine === item.line_id;
                return (
                  <button
                    key={item.line_id}
                    onClick={() => onSelectLine(item.line_id)}
                    className={cn(
                      "flex items-center gap-4 px-10 py-4 rounded-full cursor-pointer font-sans text-caption transition-all duration-fast",
                      isSelected
                        ? "border-2 border-brand bg-brand-subtle"
                        : "border border-border bg-surface-primary",
                    )}
                  >
                    <span className="font-mono font-bold text-text-primary">{item.line_id}</span>
                    {la && <Badge variant={rootCauseVariant(item.root_cause)} size="sm" icon={null}>{la.risk}</Badge>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Pricing Waterfall for selected line */}
          {selectedAnalysis && selectedAnalysis.waterfall.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-subhead font-semibold text-text-primary m-0 flex items-center gap-6">
                  <FileText size={14} className="text-text-tertiary" />
                  ERP Pricing Waterfall
                </h4>
                <span className="text-label text-text-tertiary bg-surface-secondary px-2 py-px rounded-full">
                  {selectedAnalysis.waterfall.length} step{selectedAnalysis.waterfall.length !== 1 ? "s" : ""}
                </span>
              </div>
              <PricingWaterfall steps={selectedAnalysis.waterfall} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
