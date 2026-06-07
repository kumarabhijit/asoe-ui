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

import { useEffect, useRef, useState } from "react";
import { CollapsibleHeader } from "./shared";
import type { OrderAnalysis } from "@/types/exceptions";

interface AgentAnalysisSectionProps {
  analysis: OrderAnalysis;
  defaultOpen?: boolean;
  /**
   * ADR-041 P3e Phase 3 sign-off gate #5 — telemetry observer
   * for "analysis scroll depth". Called with the fraction of the
   * section content that has scrolled into the operator's
   * viewport (0..1). The parent (`ExceptionDetailPanel`) wires
   * this to `useCaseTelemetry.trackAnalysisScroll`; the hook
   * keeps the max value and reports on unmount.
   *
   * Optional — when omitted the section behaves identically to
   * pre-Phase-3 code. No observer mounts, no scroll listener.
   */
  onScrollDepth?: (pct: number) => void;
}

export function AgentAnalysisSection({
  analysis,
  defaultOpen = false,
  onScrollDepth,
}: AgentAnalysisSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  // Container ref for the scroll-depth observer (Phase 3 §gate
  // #5). We measure how far the section's content has been
  // scrolled INTO the operator's viewport, not how far the
  // section itself has been scrolled internally — the right-pane
  // is the scrolling ancestor, so we observe the section's
  // bounding rect vs. the pane.
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Wire the scroll-depth observer when the section is open and a
  // callback is supplied. The observer is detached on close, on
  // unmount, and on prop change. SSR-safe — `IntersectionObserver`
  // is only constructed inside the `useEffect` body.
  useEffect(() => {
    if (!open || !onScrollDepth) return;
    const el = contentRef.current;
    if (el === null) return;
    if (typeof IntersectionObserver === "undefined") return;

    // Threshold sweep — IntersectionObserverEntry.intersectionRatio
    // is 0..1 directly. We use a 21-step threshold so updates fire
    // every ~5% scroll; cheap, plenty of resolution for the
    // telemetry rollup.
    const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          onScrollDepth(entry.intersectionRatio);
        }
      },
      { threshold: thresholds },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, onScrollDepth]);

  return (
    <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
      <CollapsibleHeader
        title="Agent Analysis"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && (
        <div ref={contentRef} className="border-t border-border px-16 py-16">
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
