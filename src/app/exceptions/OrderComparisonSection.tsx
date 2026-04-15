/**
 * OrderComparisonSection — Data-presence-driven enrichment.
 *
 * Renders ONLY when analysis.order_comparison is present.
 * Shows side-by-side or stacked order comparison with matching
 * and differing fields highlighted.
 *
 * Intent-agnostic: any intent that produces order_comparison data
 * will automatically render this section — zero code changes.
 */
"use client";

import { GitCompare, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { fmtPrice } from "./shared";
import type { OrderComparisonData, ComparisonOrder } from "@/types/exceptions";

interface OrderComparisonSectionProps {
  data: OrderComparisonData;
}

export function OrderComparisonSection({ data }: OrderComparisonSectionProps) {
  return (
    <section
      style={{
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--space-16)",
      }}
    >
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", marginBottom: "var(--space-12)" }}>
        <GitCompare size={14} style={{ color: "var(--color-text-tertiary)" }} />
        <span style={{ fontSize: "var(--font-size-subhead)", fontWeight: 600, color: "var(--color-text-primary)" }}>
          Order Comparison
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
          {data.orders.length} orders
        </span>
      </div>

      {/* Matching / Differing field badges */}
      <div style={{ display: "flex", gap: "var(--space-16)", marginBottom: "var(--space-12)", flexWrap: "wrap" }}>
        {data.matching_fields.length > 0 && (
          <div>
            <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <Check size={10} style={{ color: "var(--color-success)" }} />
              Matching Fields
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
              {data.matching_fields.map((f) => (
                <Badge key={f} variant="success" size="sm">{f.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          </div>
        )}
        {data.differing_fields.length > 0 && (
          <div>
            <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)", display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <X size={10} style={{ color: "var(--color-error)" }} />
              Differing Fields
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
              {data.differing_fields.map((f) => (
                <Badge key={f} variant="error" size="sm">{f.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Orders side-by-side */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${data.orders.length}, 1fr)`,
          gap: "var(--space-12)",
        }}
      >
        {data.orders.map((order, i) => (
          <OrderComparisonCard key={order.so_number} order={order} index={i} />
        ))}
      </div>
    </section>
  );
}

function OrderComparisonCard({ order, index }: { order: ComparisonOrder; index: number }) {
  return (
    <div
      style={{
        padding: "var(--space-12)",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${index === 0 ? "var(--color-border-default)" : "var(--color-warning)"}`,
        background: index === 0 ? "var(--color-surface-primary)" : "var(--color-warning-subtle)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-8)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "var(--font-size-body)", color: "var(--color-text-primary)" }}>
          {order.so_number}
        </span>
        <Badge variant={index === 0 ? "success" : "warning"} size="sm">
          {index === 0 ? "Original" : "Duplicate"}
        </Badge>
      </div>

      {/* Order metadata */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", fontSize: "var(--font-size-caption)", marginBottom: "var(--space-10)" }}>
        <MetaRow label="PO #" value={order.po_number} mono />
        <MetaRow label="Customer" value={order.customer} />
        <MetaRow label="Created" value={new Date(order.created_date).toLocaleDateString()} mono />
        <MetaRow label="Total" value={fmtPrice(order.total_value)} mono highlight />
        <MetaRow label="Status" value={order.status} />
      </div>

      {/* Line items */}
      {order.lines.length > 0 && (
        <>
          <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
            Line Items
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--font-size-caption)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border-default)" }}>
                  {["SKU", "Qty", "Price"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "var(--space-4) var(--space-6)",
                        textAlign: h === "SKU" ? "left" : "right",
                        fontSize: "var(--font-size-label)",
                        fontWeight: 700,
                        color: "var(--color-text-tertiary)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.sku} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    <td style={{ padding: "var(--space-4) var(--space-6)", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>{line.sku}</td>
                    <td style={{ padding: "var(--space-4) var(--space-6)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{line.qty.toLocaleString()}</td>
                    <td style={{ padding: "var(--space-4) var(--space-6)", textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtPrice(line.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function MetaRow({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "var(--color-text-tertiary)" }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontWeight: highlight ? 700 : 500,
          color: highlight ? "var(--color-text-primary)" : "var(--color-text-secondary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
