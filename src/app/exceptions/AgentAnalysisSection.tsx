/**
 * AgentAnalysisSection — Layer 3 of the Exception Detail Panel.
 *
 * Three narrative blocks: The Problem, Root Cause, Recommendation.
 * Driven by OrderAnalysis data — intent-agnostic.
 */
"use client";

import type { OrderAnalysis } from "@/types/exceptions";

interface AgentAnalysisSectionProps {
  analysis: OrderAnalysis;
}

export function AgentAnalysisSection({ analysis }: AgentAnalysisSectionProps) {
  return (
    <section className="bg-surface-primary rounded-md shadow-sm p-16">
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
    </section>
  );
}
