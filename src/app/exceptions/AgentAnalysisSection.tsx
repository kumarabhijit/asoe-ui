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
          {/* The Problem */}
          <div className="mb-12">
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
              The Problem
            </div>
            <p className="text-body text-text-secondary leading-relaxed m-0">
              {analysis.diagnosis}
            </p>
          </div>

          {/* Root Cause */}
          <div className="mb-12">
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
              Root Cause
            </div>
            <div className="border-l-[3px] border-warning pl-10 text-body font-medium text-text-primary leading-normal">
              {analysis.root_cause}
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
              Recommendation
            </div>
            <div className="border-l-[3px] border-brand pl-10 text-body font-semibold text-brand leading-normal">
              {analysis.recommendation}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
