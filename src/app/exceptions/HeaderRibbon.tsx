/**
 * HeaderRibbon — Layer 1 of the Exception Detail Panel.
 *
 * Breadcrumb-style context: Reference ID > Customer > Location > Primary SKU.
 * Status row: lifecycle badge + event type + shadow verdict (read-only) + total value.
 */
"use client";

import { ChevronRight } from "lucide-react";
import { Badge, lifecycleVariant, verdictVariant } from "@/components/ui/Badge";
import { fmtPrice } from "./shared";
import type { ExceptionDetail, EntityProfile } from "@/types/exceptions";

interface HeaderRibbonProps {
  detail: ExceptionDetail;
  entityProfile?: EntityProfile | null;
  primarySkuLabel: string;
  totalPo: number;
  delta: number;
}

export function HeaderRibbon({ detail, entityProfile: ep, primarySkuLabel, totalPo, delta }: HeaderRibbonProps) {
  return (
    <div className="px-16 py-10 border-b border-border bg-surface-primary shrink-0">
      {/* Breadcrumb row */}
      <div className="flex items-center gap-6 text-caption text-text-tertiary mb-6 flex-wrap min-w-0">
        <span className="font-mono font-bold text-text-primary">
          {detail.order_id}
        </span>
        <ChevronRight size={10} />
        <span className="font-medium text-text-secondary">
          {ep?.customer_name ?? detail.tenant_id}
        </span>
        <ChevronRight size={10} />
        <span>{ep?.location ?? "—"}</span>
        <ChevronRight size={10} />
        <span>{primarySkuLabel}</span>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-6 flex-wrap">
        <Badge variant={lifecycleVariant(detail.lifecycle_state)} size="sm">
          {detail.lifecycle_state.replace(/_/g, " ")}
        </Badge>
        <span className="text-caption text-text-tertiary">
          {detail.event_type.replace(/_/g, " ")}
        </span>
        {detail.shadow_verdict && (
          <Badge variant={verdictVariant(detail.shadow_verdict)} size="sm">
            {detail.shadow_verdict}
          </Badge>
        )}
        <div className="flex-1" />
        <span className="font-mono font-bold text-body text-text-primary">
          {fmtPrice(totalPo)}
        </span>
        {delta !== 0 && (
          <span className="font-mono font-semibold text-caption text-error">
            {"\u0394"} {fmtPrice(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  );
}
