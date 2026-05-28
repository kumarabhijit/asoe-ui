// ComplianceHitCountChip — non-dismissible count indicator for the
// slim case-header strip.
//
// ADR-041 P3e §2.3, Compliance reversal condition #3: when the
// Compliance Hits section moves out of the main column (the xl
// audit rail), the slim header must surface a persistent count
// chip so the operator never has a layout where Compliance
// presence is invisible. The chip is non-dismissible — there is no
// close button, and it stays on screen whenever `count > 0`.
//
// Returns null when count is 0 (Guardrail #6 — no synthesised "no
// hits" placeholder; absence of the chip IS the zero state).
//
// Click-to-scroll-to-rail behaviour is deferred to Phase 2b along
// with the slim-header restructure; today the chip carries the
// status signal only. The `aria-label` form is the screen-reader
// announce, so SR users hear the count even when the rail is off-
// screen.

"use client";

import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

export interface ComplianceHitCountChipProps {
  count: number;
}

export function ComplianceHitCountChip({ count }: ComplianceHitCountChipProps) {
  if (count <= 0) return null;
  return (
    <Badge
      variant="warning"
      size="sm"
      aria-label={`${count} compliance ${count === 1 ? "hit" : "hits"}`}
    >
      <ShieldAlert size={10} aria-hidden className="mr-4" />
      {count}
    </Badge>
  );
}
