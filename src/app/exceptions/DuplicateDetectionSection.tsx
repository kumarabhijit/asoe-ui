/**
 * DuplicateDetectionSection — Data-presence-driven enrichment.
 *
 * Renders ONLY when analysis.duplicate_detection is present.
 * Shows: original vs duplicate order, detection method, confidence,
 * recommended action, and autonomy level applied.
 *
 * Intent-agnostic: any intent that produces duplicate_detection data
 * will automatically render this section — zero code changes.
 */
"use client";

import { Copy, ArrowRight, Shield, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { fmtPrice } from "./shared";
import type { DuplicateDetectionData, OrderSnapshot } from "@/types/exceptions";

interface DuplicateDetectionSectionProps {
  data: DuplicateDetectionData;
}

/**
 * Registry classification (compliance/audit_bearing_registry.yaml::DuplicateDetectionData):
 * - audit-bearing: days_between, confidence, recommended_action,
 *   cancellation_target, autonomy_applied, original_order, duplicate_order.
 *   The composer routes missing values to AUDIT_CONTEXT_MISSING upstream;
 *   absence here is a registry/adapter bug. EvidenceBlock fails closed
 *   (structural omission) and dev-warns.
 * - contextual: detection_method (regenerable from signal_scores).
 *   Wrapped in EvidenceBlock tier="contextual" — absent → render nothing.
 */

export function DuplicateDetectionSection({ data }: DuplicateDetectionSectionProps) {
  return (
    <section className="bg-surface-primary rounded-md shadow-sm p-16">
      {/* Section header */}
      <div className="flex items-center gap-8 mb-12">
        <Copy size={14} className="text-text-tertiary" />
        <span className="text-subhead font-semibold text-text-primary">
          Duplicate Detection
        </span>
        <Badge variant="warning" size="sm">
          {data.confidence}% confidence
        </Badge>
      </div>

      {/* Original vs Duplicate side-by-side */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-12 mb-16 items-start">
        <OrderCard label="Original Order" order={data.original_order} />
        <div className="flex flex-col items-center justify-center pt-24 text-text-quaternary">
          <ArrowRight size={20} />
          <span className="text-label mt-4">
            {data.days_between}d apart
          </span>
        </div>
        <OrderCard label="Duplicate Order" order={data.duplicate_order} highlight />
      </div>

      {/* Detection method (contextual — regenerable from signal_scores) */}
      <EvidenceBlock tier="contextual" value={data.detection_method}>
        {(method) => (
          <div className="mb-12">
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
              Detection Method
            </div>
            <div className="flex items-center gap-8 text-body text-text-secondary">
              <Shield size={14} className="text-text-tertiary shrink-0" />
              {String(method)}
            </div>
          </div>
        )}
      </EvidenceBlock>

      {/* Recommended action (audit-bearing) */}
      <EvidenceBlock tier="audit-bearing" value={data.recommended_action}>
        {(action) => (
          <div className="mb-12">
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
              Recommended Action
            </div>
            <div className="border-l-[3px] border-brand pl-10 text-body font-semibold text-brand leading-normal">
              {String(action)}
            </div>
            <EvidenceBlock tier="audit-bearing" value={data.cancellation_target}>
              {(target) => (
                <div className="mt-4 pl-10 flex items-center gap-6 text-caption text-text-tertiary">
                  <span className="font-mono font-semibold">Cancel target:</span>
                  <span className="font-mono text-error font-semibold">{String(target)}</span>
                </div>
              )}
            </EvidenceBlock>
          </div>
        )}
      </EvidenceBlock>

      {/* Autonomy level (audit-bearing) */}
      <EvidenceBlock tier="audit-bearing" value={data.autonomy_applied}>
        {(autonomy) => (
          <div className="flex items-center gap-8 px-12 py-8 bg-surface-secondary rounded-sm text-caption">
            <Clock size={12} className="text-text-tertiary" />
            <span className="text-text-tertiary font-semibold">Autonomy:</span>
            <span className="text-text-secondary">{String(autonomy)}</span>
          </div>
        )}
      </EvidenceBlock>
    </section>
  );
}

/** Compact order snapshot card */
function OrderCard({ label, order, highlight }: { label: string; order: OrderSnapshot; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? "p-12 rounded-sm border border-warning bg-warning-subtle"
          : "p-12 rounded-sm border border-border bg-surface-primary"
      }
    >
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
        {label}
      </div>
      <div className="flex flex-col gap-4 text-caption">
        <div className="flex justify-between">
          <span className="text-text-tertiary">SO #</span>
          <span className="font-mono font-semibold text-text-primary">{order.so_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">PO #</span>
          <span className="font-mono font-semibold text-text-primary">{order.po_number}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Created</span>
          <span className="font-mono text-text-secondary">{new Date(order.created_date).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Value</span>
          <span className="font-mono font-semibold text-text-primary">{fmtPrice(order.total_value)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Lines</span>
          <span className="font-mono text-text-secondary">{order.line_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-tertiary">Status</span>
          <Badge variant="neutral" size="sm">{order.status}</Badge>
        </div>
      </div>
    </div>
  );
}
