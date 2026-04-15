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
import { cn } from "@/lib/utils";
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
        className="flex items-center justify-center gap-6 w-full py-8 bg-transparent border-none cursor-pointer font-sans text-caption font-semibold text-text-tertiary transition-colors duration-fast"
        aria-expanded={diagnosticsOpen}
      >
        <Terminal size={12} />
        {diagnosticsOpen ? "Hide Diagnostics" : "Show Diagnostics"}
        <ChevronDown
          size={12}
          className={cn(
            "transition-transform duration-fast",
            !diagnosticsOpen && "-rotate-90",
          )}
        />
      </button>

      {diagnosticsOpen && (
        <div className="flex flex-col gap-12">
          {/* Pipeline Progress */}
          <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
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
              <div className="border-t border-border px-16 py-12">
                <WaterfallStepper
                  nodes={nodeStates}
                  intent={detail.intent ?? undefined}
                />
              </div>
            )}
          </section>

          {/* Trace Evidence */}
          <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
            <CollapsibleHeader
              title="Trace Evidence"
              open={traceOpen}
              onToggle={() => setTraceOpen((v) => !v)}
            />
            {traceOpen && (
              <div className="border-t border-border px-16 py-12">
                <div className="flex gap-4 border-b border-border mb-10">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setDetailTab(tab.id)}
                      className={cn(
                        "px-12 py-6 bg-transparent border-none cursor-pointer text-caption font-sans",
                        detailTab === tab.id
                          ? "font-semibold text-text-primary border-b-2 border-brand"
                          : "text-text-tertiary border-b-2 border-transparent",
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {detailTab === "evidence" && trace && (
                  <div className="text-caption text-text-secondary">
                    <div className="flex flex-col gap-8">
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
                  <div className="p-12 text-text-quaternary text-caption italic bg-surface-secondary rounded-sm">
                    SAP condition records and master data will be available here — integrating with SAP ECC/S4HANA pricing procedures, condition tables, and master data views.
                  </div>
                )}
                {showPreview && detailTab === "changes" && (
                  <div className="p-12 text-text-quaternary text-caption italic bg-surface-secondary rounded-sm">
                    Change analysis and audit diff will surface here — showing field-level before/after comparisons, change initiators, and approval chains.
                  </div>
                )}
                {detail.resolution_data && Object.keys(detail.resolution_data).length > 0 && (
                  <div className="mt-12">
                    <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-6">
                      Resolution Data
                    </div>
                    <pre className="bg-surface-secondary p-12 rounded-sm text-caption font-mono text-text-secondary overflow-auto m-0">
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
      <span className="text-text-quaternary text-label font-semibold uppercase tracking-wider">
        {label}
      </span>
      <div className={cn("text-text-secondary mt-px text-caption break-all", mono && "font-mono")}>
        {value}
      </div>
    </div>
  );
}
