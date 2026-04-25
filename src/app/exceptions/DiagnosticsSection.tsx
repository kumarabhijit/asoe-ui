/**
 * DiagnosticsSection — Layer 5 of the Exception Detail Panel.
 *
 * Hidden behind a "Show Diagnostics" toggle. Contains:
 *   - Pipeline Progress (WaterfallStepper)
 *   - Trace Evidence (evidence tabs, SAP data, change analysis, resolution data)
 */
"use client";

import { useState } from "react";
import { ChevronDown, Terminal, ClipboardCopy, CheckCircle2 } from "lucide-react";
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("evidence");
  const history = detail.reanalysis_history ?? [];

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
                  allowReplay
                />
              </div>
            )}
          </section>

          {/* Reanalysis History — append-only audit trail of human-triggered
              graph replays. Rendered only when history exists. */}
          {history.length > 0 && (
            <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
              <CollapsibleHeader
                title="Reanalysis History"
                open={historyOpen}
                onToggle={() => setHistoryOpen((v) => !v)}
                badge={`${history.length} attempt${history.length === 1 ? "" : "s"}`}
                badgeVariant="info"
              />
              {historyOpen && (
                <div className="border-t border-border px-16 py-12 flex flex-col gap-12">
                  {history.map((entry) => (
                    <div
                      key={`${entry.attempt}-${entry.triggered_at}`}
                      className="border-l-[3px] border-brand pl-12 py-4"
                    >
                      <div className="flex items-baseline justify-between mb-4">
                        <span className="text-caption font-semibold text-text-primary">
                          Attempt {entry.attempt}
                        </span>
                        <span className="text-label font-mono text-text-tertiary">
                          {new Date(entry.triggered_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-label text-text-quaternary uppercase tracking-wider mb-2">
                        Triggered by
                      </div>
                      <div className="text-caption text-text-secondary mb-6 font-mono">
                        {entry.triggered_by}
                      </div>
                      <div className="text-label text-text-quaternary uppercase tracking-wider mb-2">
                        Reason
                      </div>
                      <p className="text-caption text-text-secondary m-0 mb-8 whitespace-pre-wrap">
                        {entry.reason}
                      </p>
                      {/* Structural omission per CLAUDE.md Guardrail #6:
                          show only the verdict / final-status pair
                          components that are actually present. The
                          previous `?? "—"` rendering created a
                          partial-truth state where an absent
                          prior-verdict looked indistinguishable from
                          a transition where the verdict didn't
                          change. */}
                      <div className="grid grid-cols-2 gap-8 text-label">
                        <ReanalysisTransition
                          label="Prior"
                          verdict={entry.prior_shadow_verdict}
                          status={entry.prior_final_status}
                        />
                        <ReanalysisTransition
                          label="After"
                          verdict={entry.new_shadow_verdict}
                          status={entry.new_final_status}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

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
                  <div className="text-caption text-text-secondary flex flex-col gap-14">
                    {/* Human-facing structured narrative — renders only when
                        the recipe produced these fields. Purely informational;
                        no UI logic branches on their values. */}
                    {trace.narrative && <NarrativeBlock text={trace.narrative} />}
                    {trace.resolution_steps && trace.resolution_steps.length > 0 && (
                      <ResolutionSteps steps={trace.resolution_steps} />
                    )}
                    {trace.sap_actions && trace.sap_actions.length > 0 && (
                      <SAPActionsList actions={trace.sap_actions} />
                    )}
                    {trace.customer_email_draft && (
                      <CustomerEmailDraft body={trace.customer_email_draft} />
                    )}

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
                      {/* Verdict Pillar 2.3 audit-gap surface — present
                          only when build_analysis flagged
                          AUDIT_CONTEXT_MISSING. Auditors see the
                          missing-class + ordered field list directly
                          rather than regexing the explanation. */}
                      {trace.audit_context_missing_fields &&
                        trace.audit_context_missing_fields.length > 0 && (
                        <>
                          <TraceField
                            label="Audit Gap (class)"
                            value={trace.audit_context_missing_class}
                          />
                          <TraceField
                            label="Audit Gap (fields)"
                            value={trace.audit_context_missing_fields.join(", ")}
                          />
                        </>
                      )}
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

/* ── Layer 2 narrative sub-components ───────────────────────────────── */

function NarrativeBlock({ text }: { text: string }) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-6">
        Agent Narrative
      </div>
      {text.split("\n\n").map((para, i) => (
        <p key={i} className="text-caption text-text-secondary leading-normal m-0 mb-8 last:mb-0">
          {para}
        </p>
      ))}
    </div>
  );
}

function ResolutionSteps({ steps }: { steps: string[] }) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-6">
        Resolution Steps
      </div>
      <ol className="list-decimal pl-20 m-0 flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={i} className="text-caption text-text-secondary leading-normal">
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SAPActionsList({ actions }: {
  actions: Array<{ transaction: string; table?: string; field?: string; description: string }>;
}) {
  return (
    <div>
      <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-6">
        Recommended SAP Actions
      </div>
      <div className="rounded-sm border border-border overflow-hidden">
        <table className="w-full text-caption">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="text-left px-10 py-6 text-label font-semibold text-text-tertiary uppercase tracking-wider">Tx</th>
              <th className="text-left px-10 py-6 text-label font-semibold text-text-tertiary uppercase tracking-wider">Table / Field</th>
              <th className="text-left px-10 py-6 text-label font-semibold text-text-tertiary uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-10 py-6 font-mono text-text-primary font-semibold align-top">
                  {a.transaction}
                </td>
                <td className="px-10 py-6 font-mono text-text-tertiary align-top">
                  {/* Structural omission (CLAUDE.md Guardrail #6):
                      empty cell when neither table nor field is
                      present, rather than rendering "—". */}
                  {a.table ?? ""}
                  {a.field && <span className="text-text-quaternary">{a.table ? " / " : ""}{a.field}</span>}
                </td>
                <td className="px-10 py-6 text-text-secondary align-top">
                  {a.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerEmailDraft({ body }: { body: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true);
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }).catch(() => {
      // navigator.clipboard may be unavailable in test environments;
      // swallow silently — the draft is still visible to copy manually.
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <span className="text-label font-bold uppercase tracking-wider text-text-quaternary">
          Customer Email Draft
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-4 px-8 py-2 rounded-sm bg-transparent border border-border text-label text-text-secondary hover:text-text-primary hover:border-text-quaternary cursor-pointer font-sans"
        >
          {copied ? (
            <>
              <CheckCircle2 size={11} className="text-success" />
              Copied
            </>
          ) : (
            <>
              <ClipboardCopy size={11} />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="m-0 p-10 rounded-sm bg-surface-secondary text-caption text-text-secondary font-sans leading-normal whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  );
}

/**
 * Reanalysis-history transition cell — shows only the components of
 * a verdict/status pair that are present. CLAUDE.md Guardrail #6:
 * absent components are structurally omitted (no "—" placeholder)
 * because a partial-truth value here conceals whether the prior
 * value was missing or unchanged.
 */
function ReanalysisTransition({
  label,
  verdict,
  status,
}: {
  label: string;
  verdict?: string;
  status?: string;
}) {
  const parts = [verdict, status].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return (
    <div>
      <span className="text-text-quaternary uppercase tracking-wider">{label}</span>
      {parts.length > 0 && (
        <div className="text-caption text-text-secondary mt-px">
          {parts.join(" / ")}
        </div>
      )}
    </div>
  );
}
