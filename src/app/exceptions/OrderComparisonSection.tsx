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
    <section className="bg-surface-primary rounded-md shadow-sm p-16">
      {/* Section header */}
      <div className="flex items-center gap-8 mb-12">
        <GitCompare size={14} className="text-text-tertiary" />
        <span className="text-subhead font-semibold text-text-primary">
          Order Comparison
        </span>
        <span className="text-label font-semibold text-text-tertiary bg-surface-secondary px-2 py-px rounded-full">
          {data.orders.length} orders
        </span>
      </div>

      {/* Matching / Differing field badges */}
      <div className="flex gap-16 mb-12 flex-wrap">
        {data.matching_fields.length > 0 && (
          <div>
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4 flex items-center gap-4">
              <Check size={10} className="text-success" />
              Matching Fields
            </div>
            <div className="flex flex-wrap gap-4">
              {data.matching_fields.map((f) => (
                <Badge key={f} variant="success" size="sm">{f.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          </div>
        )}
        {data.differing_fields.length > 0 && (
          <div>
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4 flex items-center gap-4">
              <X size={10} className="text-error" />
              Differing Fields
            </div>
            <div className="flex flex-wrap gap-4">
              {data.differing_fields.map((f) => (
                <Badge key={f} variant="error" size="sm">{f.replace(/_/g, " ")}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Orders side-by-side */}
      <div
        className="grid gap-12"
        style={{ gridTemplateColumns: `repeat(${data.orders.length}, 1fr)` }}
      >
        {data.orders.map((order, i) => (
          <OrderComparisonCard key={order.so_number} order={order} index={i} />
        ))}
      </div>
    </section>
  );
}

function OrderComparisonCard({ order, index }: { order: ComparisonOrder; index: number }) {
  const isDuplicate = index > 0;
  return (
    <div
      className={
        isDuplicate
          ? "p-12 rounded-sm border border-warning bg-warning-subtle"
          : "p-12 rounded-sm border border-border bg-surface-primary"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <span className="font-mono font-bold text-body text-text-primary">
          {order.so_number}
        </span>
        <Badge variant={isDuplicate ? "warning" : "success"} size="sm">
          {isDuplicate ? "Duplicate" : "Original"}
        </Badge>
      </div>

      {/* Order metadata */}
      <div className="flex flex-col gap-4 text-caption mb-10">
        <MetaRow label="PO #" value={order.po_number} mono />
        <MetaRow label="Customer" value={order.customer} />
        <MetaRow label="Created" value={new Date(order.created_date).toLocaleDateString()} mono />
        <MetaRow label="Total" value={fmtPrice(order.total_value)} mono highlight />
        <MetaRow label="Status" value={order.status} />
      </div>

      {/* Line items */}
      {order.lines.length > 0 && (
        <>
          <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
            Line Items
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-caption">
              <thead>
                <tr className="border-b border-border">
                  {["SKU", "Qty", "Price"].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-label font-bold text-text-tertiary ${h !== "SKU" ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.sku} className="border-b border-border-subtle">
                    <td className="px-6 py-4 font-mono text-text-secondary">{line.sku}</td>
                    <td className="px-6 py-4 text-right font-mono">{line.qty.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono">{fmtPrice(line.unit_price)}</td>
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
    <div className="flex justify-between items-center">
      <span className="text-text-tertiary">{label}</span>
      <span
        className={`${mono ? "font-mono" : ""} ${highlight ? "font-bold text-text-primary" : "font-medium text-text-secondary"}`}
      >
        {value}
      </span>
    </div>
  );
}
