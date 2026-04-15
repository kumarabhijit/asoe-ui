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
    <section
      style={{
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--space-16)",
      }}
    >
      {/* The Problem */}
      <div style={{ marginBottom: "var(--space-12)" }}>
        <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
          The Problem
        </div>
        <p style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-secondary)", lineHeight: 1.6, margin: 0 }}>
          {analysis.diagnosis}
        </p>
      </div>

      {/* Root Cause */}
      <div style={{ marginBottom: "var(--space-12)" }}>
        <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
          Root Cause
        </div>
        <div
          style={{
            borderLeft: "3px solid var(--color-warning)",
            paddingLeft: "var(--space-10)",
            fontSize: "var(--font-size-body)",
            fontWeight: 500,
            color: "var(--color-text-primary)",
            lineHeight: 1.5,
          }}
        >
          {analysis.root_cause}
        </div>
      </div>

      {/* Recommendation */}
      <div>
        <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-4)" }}>
          Recommendation
        </div>
        <div
          style={{
            borderLeft: "3px solid var(--color-brand)",
            paddingLeft: "var(--space-10)",
            fontSize: "var(--font-size-body)",
            fontWeight: 600,
            color: "var(--color-brand)",
            lineHeight: 1.5,
          }}
        >
          {analysis.recommendation}
        </div>
      </div>
    </section>
  );
}
