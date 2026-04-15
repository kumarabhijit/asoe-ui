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
}

export function EvidenceGrid({
  lineItems,
  analysis,
  selectedLine,
  onSelectLine,
  selectedAnalysis,
  totalErp,
  totalPo,
}: EvidenceGridProps) {
  const [expanded, setExpanded] = useState(false);

  if (lineItems.length === 0) return null;

  return (
    <section
      style={{
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-10) var(--space-16)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
          <ChevronDown
            size={14}
            style={{
              color: "var(--color-text-tertiary)",
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform var(--dur-fast)",
            }}
          />
          <span style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)" }}>
            Evidence Detail
          </span>
          <span
            style={{
              fontSize: "var(--font-size-label)",
              fontWeight: 600,
              color: "var(--color-text-tertiary)",
              background: "var(--color-surface-secondary)",
              padding: "2px 8px",
              borderRadius: "var(--radius-full)",
            }}
          >
            {lineItems.length} line{lineItems.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)", fontSize: "var(--font-size-caption)" }}>
          <span style={{ color: "var(--color-text-tertiary)" }}>
            ERP <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--color-text-primary)" }}>{fmtPrice(totalErp)}</span>
          </span>
          <span style={{ color: "var(--color-text-tertiary)" }}>
            PO <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: totalPo !== totalErp ? "var(--color-error)" : "var(--color-text-primary)" }}>{fmtPrice(totalPo)}</span>
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--color-border-default)", padding: "var(--space-12) var(--space-16)" }}>
          {/* Line item table */}
          <div style={{ overflowX: "auto", marginBottom: "var(--space-12)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-caption)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-default)" }}>
                  {["Line", "SKU", "Description", "Qty", "ERP", "PO", "Root Cause"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "var(--space-6) var(--space-8)",
                        textAlign: ["Qty", "ERP", "PO"].includes(h) ? "right" : "left",
                        fontSize: "var(--font-size-label)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "var(--color-text-tertiary)",
                      }}
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
                    style={{
                      borderBottom: "1px solid var(--color-border-subtle)",
                      cursor: "pointer",
                      background: selectedLine === item.line_id ? "var(--color-surface-row-active)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "var(--space-6) var(--space-8)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{item.line_id}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>{item.sku}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", color: "var(--color-text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{item.quantity.toLocaleString()}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtPrice(item.erp_price)}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)", textAlign: "right", fontFamily: "var(--font-mono)", color: item.po_price !== item.erp_price ? "var(--color-error)" : "var(--color-text-primary)", fontWeight: item.po_price !== item.erp_price ? 600 : 400 }}>{fmtPrice(item.po_price)}</td>
                    <td style={{ padding: "var(--space-6) var(--space-8)" }}>
                      {item.root_cause && <Badge variant={rootCauseVariant(item.root_cause)} size="sm" icon={null}>{item.root_cause.replace(/_/g, " ")}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Line selector pills (for waterfall) */}
          {analysis && analysis.lines.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-10)" }}>
              {lineItems.map((item) => {
                const la = analysis.lines.find((l) => l.line_id === item.line_id);
                const isSelected = selectedLine === item.line_id;
                return (
                  <button
                    key={item.line_id}
                    onClick={() => onSelectLine(item.line_id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-4)",
                      padding: "var(--space-4) var(--space-10)",
                      borderRadius: "var(--radius-full)",
                      border: isSelected ? "2px solid var(--color-brand)" : "1px solid var(--color-border-default)",
                      background: isSelected ? "var(--color-brand-subtle)" : "var(--color-surface-primary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--font-size-caption)",
                      transition: "all var(--dur-fast)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-text-primary)" }}>{item.line_id}</span>
                    {la && <Badge variant={rootCauseVariant(item.root_cause)} size="sm" icon={null}>{la.risk}</Badge>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Pricing Waterfall for selected line */}
          {selectedAnalysis && selectedAnalysis.waterfall.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-6)" }}>
                <h4 style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
                  <FileText size={14} color="var(--color-text-tertiary)" />
                  ERP Pricing Waterfall
                </h4>
                <span style={{ fontSize: "var(--font-size-label)", color: "var(--color-text-tertiary)", background: "var(--color-surface-secondary)", padding: "2px 8px", borderRadius: "var(--radius-full)" }}>
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
