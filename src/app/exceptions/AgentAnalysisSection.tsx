/**
 * AgentAnalysisSection — Layer 3 of the Exception Detail Panel.
 *
 * Three narrative blocks: The Problem, Root Cause, Recommendation.
 * Driven by OrderAnalysis data — intent-agnostic.
 *
 * Pane behavior (TRB ruling):
 * Collapsed by default to keep the detail surface focused on the
 * Recommendation card (Layer 1). Auto-expands when the exception is in
 * a Human-in-the-Loop lifecycle state (PENDING_REVIEW, ESCALATED,
 * PENDING_ADMIN_REVIEW, PENDING_COSIGN) so the reviewer sees the
 * problem narrative the moment they open a row that needs their
 * judgement.
 */
"use client";

import { useState } from "react";
import { CollapsibleHeader } from "./shared";
import type { OrderAnalysis } from "@/types/exceptions";

interface AgentAnalysisSectionProps {
  analysis: OrderAnalysis;
  defaultOpen?: boolean;
}

export function AgentAnalysisSection({
  analysis,
  defaultOpen = false,
}: AgentAnalysisSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      <CollapsibleHeader
        title="Agent Analysis"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="border-t border-border px-16 py-14">
          {/* Each block renders only when its prose is present
              (CLAUDE.md Guardrail #6 — structural omission, not a
              "—" or empty colored bar). On Azure today, root_cause
              and recommendation are populated by the asoe2
              `profile_composer.compose_narrative` from
              `record.resolution_data` / trace.narrative; when the
              recipe / trace doesn't carry that prose, the operator
              sees a smaller card rather than empty headings. */}
          {analysis.diagnosis && (
            <div className="mb-12 last:mb-0">
              <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
                The Problem
              </div>
              <p className="text-body text-text-secondary leading-relaxed m-0">
                {analysis.diagnosis}
              </p>
            </div>
          )}

          {analysis.root_cause && (
            <div className="mb-12 last:mb-0">
              <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
                Root Cause
              </div>
              <div className="border-l-[3px] border-warning pl-10 text-body font-medium text-text-primary leading-normal">
                {analysis.root_cause}
              </div>
            </div>
          )}

          {analysis.recommendation && (
            <div className="last:mb-0">
              <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
                Recommendation
              </div>
              <div className="border-l-[3px] border-brand pl-10 text-body font-semibold text-brand leading-normal">
                {analysis.recommendation}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
