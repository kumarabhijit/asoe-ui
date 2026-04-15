/**
 * DiagnosticsSection — Layer 5 of the Exception Detail Panel.
 *
 * Hidden behind a "Show Diagnostics" toggle. Contains:
 *   - Pipeline Progress (WaterfallStepper)
 *   - Trace Evidence (evidence tabs, SAP data, change analysis, resolution data)
 */
"use client";

import { useState } from "react";
import { ChevronDown, Terminal } from "lucide-react";
import { WaterfallStepper, type NodeState } from "@/components/ui/WaterfallStepper";
import { CollapsibleHeader } from "./shared";
import type { ExceptionDetail } from "@/types/exceptions";
import type { TraceResponse } from "@/types/api";

interface DiagnosticsSectionProps {
  detail: ExceptionDetail;
  trace: TraceResponse | null;
  nodeStates: NodeState[];
  showPreview: boolean;
}

export function DiagnosticsSection({ detail, trace, nodeStates, showPreview }: DiagnosticsSectionProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("evidence");

  const DETAIL_TABS = [
    { id: "evidence", label: "Evidence" },
    ...(showPreview ? [
      { id: "sap", label: "SAP Data" },
      { id: "changes", label: "Change Analysis" },
    ] : []),
  ];

  return (
    <>
      {/* Diagnostics toggle */}
      <button
        onClick={() => setDiagnosticsOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-6)",
          width: "100%",
          padding: "var(--space-8) 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: "var(--font-size-caption)",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          transition: "color var(--dur-fast)",
        }}
        aria-expanded={diagnosticsOpen}
      >
        <Terminal size={12} />
        {diagnosticsOpen ? "Hide Diagnostics" : "Show Diagnostics"}
        <ChevronDown
          size={12}
          style={{
            transform: diagnosticsOpen ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform var(--dur-fast)",
          }}
        />
      </button>

      {diagnosticsOpen && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}>
          {/* Pipeline Progress */}
          <section
            style={{
              background: "var(--color-surface-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-sm)",
              overflow: "hidden",
            }}
          >
            <CollapsibleHeader
              title="Pipeline Progress"
              open={pipelineOpen}
              onToggle={() => setPipelineOpen((v) => !v)}
              badge={
                nodeStates.some((n) => n.status === "failed") ? "failed"
                : nodeStates.some((n) => n.status === "started") ? "in progress"
                : nodeStates.every((n) => n.status === "completed" || n.status === "skipped") ? "complete"
                : "pending"
              }
              badgeVariant={
                nodeStates.some((n) => n.status === "failed") ? "error"
                : nodeStates.some((n) => n.status === "started") ? "info"
                : nodeStates.every((n) => n.status === "completed" || n.status === "skipped") ? "success"
                : "neutral"
              }
            />
            {pipelineOpen && (
              <div style={{ borderTop: "1px solid var(--color-border-default)", padding: "var(--space-12) var(--space-16)" }}>
                <WaterfallStepper
                  nodes={nodeStates}
                  intent={detail.intent ?? undefined}
                />
              </div>
            )}
          </section>

          {/* Trace Evidence */}
          <section
            style={{
              background: "var(--color-surface-primary)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-sm)",
              overflow: "hidden",
            }}
          >
            <CollapsibleHeader
              title="Trace Evidence"
              open={traceOpen}
              onToggle={() => setTraceOpen((v) => !v)}
            />
            {traceOpen && (
              <div style={{ borderTop: "1px solid var(--color-border-default)", padding: "var(--space-12) var(--space-16)" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-4)",
                    borderBottom: "1px solid var(--color-border-default)",
                    marginBottom: "var(--space-10)",
                  }}
                >
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setDetailTab(tab.id)}
                      style={{
                        padding: "var(--space-6) var(--space-12)",
                        background: "none",
                        border: "none",
                        borderBottom: detailTab === tab.id ? "2px solid var(--color-brand)" : "2px solid transparent",
                        cursor: "pointer",
                        fontSize: "var(--font-size-caption)",
                        fontWeight: detailTab === tab.id ? 600 : 400,
                        color: detailTab === tab.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {detailTab === "evidence" && trace && (
                  <div style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-secondary)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
                      <TraceField label="Trace ID" value={trace.trace_id} mono />
                      <TraceField label="Skill" value={trace.skill_name} />
                      <TraceField label="Intent" value={trace.intent_selected} />
                      <TraceField label="Shadow Verdict" value={trace.shadow_verdict} />
                      {trace.shadow_policy_hits.length > 0 && (
                        <TraceField label="Policy Hits" value={trace.shadow_policy_hits.join(", ")} />
                      )}
                      <TraceField label="Recipe" value={trace.recipe_name} />
                      {trace.gateway_calls.length > 0 && (
                        <TraceField label="Gateway Calls" value={trace.gateway_calls.join(", ")} />
                      )}
                      <TraceField label="Final Status" value={trace.final_status} />
                    </div>
                  </div>
                )}
                {showPreview && detailTab === "sap" && (
                  <div style={{ padding: "var(--space-12)", color: "var(--color-text-quaternary)", fontSize: "var(--font-size-caption)", fontStyle: "italic", background: "var(--color-surface-secondary)", borderRadius: "var(--radius-sm)" }}>
                    SAP condition records and master data will be available here — integrating with SAP ECC/S4HANA pricing procedures, condition tables, and master data views.
                  </div>
                )}
                {showPreview && detailTab === "changes" && (
                  <div style={{ padding: "var(--space-12)", color: "var(--color-text-quaternary)", fontSize: "var(--font-size-caption)", fontStyle: "italic", background: "var(--color-surface-secondary)", borderRadius: "var(--radius-sm)" }}>
                    Change analysis and audit diff will surface here — showing field-level before/after comparisons, change initiators, and approval chains.
                  </div>
                )}
                {detail.resolution_data && Object.keys(detail.resolution_data).length > 0 && (
                  <div style={{ marginTop: "var(--space-12)" }}>
                    <div style={{ fontSize: "var(--font-size-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-quaternary)", marginBottom: "var(--space-6)" }}>
                      Resolution Data
                    </div>
                    <pre
                      style={{
                        background: "var(--color-surface-secondary)",
                        padding: "var(--space-12)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--font-size-caption)",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-secondary)",
                        overflow: "auto",
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(detail.resolution_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

/** Trace field — label + value pair */
function TraceField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <span
        style={{
          color: "var(--color-text-quaternary)",
          fontSize: "var(--font-size-label)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          color: "var(--color-text-secondary)",
          marginTop: 2,
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: "var(--font-size-caption)",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}
