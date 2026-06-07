/**
 * DiagnosticsSection — Layer 5 of the Exception Detail Panel.
 *
 * Hidden behind a "Show Diagnostics" toggle. Contains:
 *   - Pipeline (EventsTimeline default, PipelineDAG behind disclosure;
 *     audit/admin roles get DAG default — ADR-027 Phase E)
 *   - Attempt selector (latest + every reanalysis_history entry —
 *     ADR-027 rev. 3 attempt-scoping)
 *   - Trace Evidence (evidence tabs, SAP data, change analysis, resolution data)
 *
 * Replaces the legacy WaterfallStepper + PIPELINE_NODES rendering. The
 * UI no longer mirrors the topology — both surfaces consume
 * `executed_nodes` from the trace and `PipelineTopology` from the
 * authoritative endpoint.
 */
"use client";

import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { ChevronDown, Terminal, ClipboardCopy, CheckCircle2, GitBranch, ListOrdered } from "lucide-react";
import { CollapsibleHeader, useHashOpen } from "./shared";
import { EventsTimeline } from "@/components/ui/EventsTimeline";
import { useTopology } from "@/hooks/useTopology";
import { cn } from "@/lib/utils";
import type { ExceptionDetail } from "@/types/exceptions";
import type { ExecutedNode, TraceResponse } from "@/types/api";

// PipelineDAG ships dagre + a small SVG renderer; lazy-load so the
// detail-page open path stays light. The audit-default branch
// triggers the chunk on mount; non-audit users only fetch when they
// expand the disclosure.
const PipelineDAG = lazy(() =>
  import("@/components/ui/PipelineDAG").then((m) => ({ default: m.PipelineDAG })),
);

interface DiagnosticsSectionProps {
  detail: ExceptionDetail;
  trace: TraceResponse | null;
  showPreview: boolean;
  /** Optional lazy-load callback fired the first time the Diagnostics
   *  pane opens. Lets the parent defer the trace fetch until the
   *  operator asks to see it (PO request #4). */
  onFirstOpen?: () => void;
  /** Anchor id for the "Jump to" bar (#4). When the hash targets it, the
   *  pane expands (firing onFirstOpen) and scrolls into view. */
  anchorId?: string;
}

interface AttemptOption {
  /** "current" for the latest trace, otherwise the attempt number. */
  id: "current" | number;
  label: string;
  executedNodes: ExecutedNode[];
  finalStatus?: string | null;
  preBackendInstrumentation: boolean;
}

function buildAttemptOptions(
  detail: ExceptionDetail,
  trace: TraceResponse | null,
): AttemptOption[] {
  const options: AttemptOption[] = [];
  // Latest attempt = current trace.executed_nodes.
  const latestNodes = trace?.executed_nodes ?? [];
  options.push({
    id: "current",
    label: detail.reanalysis_history && detail.reanalysis_history.length > 0
      ? `Attempt ${detail.reanalysis_history.length + 1} (current)`
      : "Current trace",
    executedNodes: latestNodes,
    finalStatus: trace?.final_status ?? detail.final_status ?? null,
    preBackendInstrumentation: latestNodes.length === 0,
  });
  // Prior attempts in reverse chronological order so the most recent
  // prior attempt is at the top of the dropdown after "current".
  const history = detail.reanalysis_history ?? [];
  for (const entry of [...history].reverse()) {
    const executed = entry.executed_nodes ?? [];
    options.push({
      id: entry.attempt,
      label: `Attempt ${entry.attempt}`,
      executedNodes: executed,
      finalStatus: entry.new_final_status ?? null,
      preBackendInstrumentation: executed.length === 0,
    });
  }
  return options;
}

export function DiagnosticsSection({ detail, trace, showPreview, onFirstOpen, anchorId }: DiagnosticsSectionProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailTab, setDetailTab] = useState("evidence");
  // Audit users default to the DAG view per ADR-027 Phase E. The
  // available roles are analyst | manager | admin | viewer | partner;
  // admin is the closest to the documented audit role and is what
  // triggers the DAG default until a dedicated `audit` role lands
  // (tracked in ADR-027 Open Question §4 RESOLVED).
  // Default to the operator-first timeline view for everyone. The
  // toggle remains visible so admin / audit users can switch to the
  // DAG when they need the full topology overlay; the role-based
  // default from ADR-027 Phase E was reverted on operator feedback —
  // the timeline answers "where did this halt and why" in one glance,
  // which is the cognitive load even audit users hit first.
  const [view, setView] = useState<"timeline" | "dag">("timeline");
  const { topology } = useTopology();
  const history = detail.reanalysis_history ?? [];

  const attemptOptions = useMemo(
    () => buildAttemptOptions(detail, trace),
    [detail, trace],
  );
  const [selectedAttemptId, setSelectedAttemptId] = useState<"current" | number>(
    "current",
  );
  const selectedAttempt =
    attemptOptions.find((o) => o.id === selectedAttemptId) ?? attemptOptions[0];

  const DETAIL_TABS = [
    { id: "evidence", label: "Evidence" },
    ...(showPreview ? [
      { id: "sap", label: "SAP Data" },
      { id: "changes", label: "Change Analysis" },
    ] : []),
  ];

  // Pipeline status badge — sourced from final_status with a fallback
  // for unknown values. Per CLAUDE.md Guardrail #1: visual mapping
  // functions over API-provided strings (with a default branch) are
  // allowed; this is not an enum gate, just display.
  const pipelineStatus = pipelineStatusBadge(
    selectedAttempt.finalStatus ?? null,
    selectedAttempt.preBackendInstrumentation,
    selectedAttempt.executedNodes,
  );

  // Expand + scroll when the "Jump to → Diagnostics" link targets this pane.
  useHashOpen(anchorId, toggleRef, () =>
    setDiagnosticsOpen((v) => {
      if (!v && onFirstOpen) onFirstOpen();
      return true;
    }),
  );

  return (
    <>
      {/* Diagnostics toggle */}
      <button
        ref={toggleRef}
        id={anchorId}
        onClick={() => {
          const next = !diagnosticsOpen;
          setDiagnosticsOpen(next);
          if (next && onFirstOpen) onFirstOpen();
        }}
        className="scroll-mt-[var(--nav-height)] flex items-center justify-center gap-6 w-full py-8 bg-transparent border-none cursor-pointer font-sans text-caption font-semibold text-text-tertiary transition-colors duration-fast"
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
          {/* Pipeline */}
          <section className="bg-surface-primary rounded-md shadow-sm overflow-hidden">
            <CollapsibleHeader
              title="Pipeline"
              open={pipelineOpen}
              onToggle={() => setPipelineOpen((v) => !v)}
              badge={pipelineStatus.label}
              badgeVariant={pipelineStatus.variant}
            />
            {pipelineOpen && (
              <div className="border-t border-border px-16 py-12 flex flex-col gap-12">
                {/* Attempt selector + view toggle */}
                <div className="flex items-center gap-12 flex-wrap">
                  {attemptOptions.length > 1 && (
                    <label className="flex items-center gap-6 text-label">
                      <span className="text-text-quaternary uppercase tracking-wider font-semibold">
                        Attempt
                      </span>
                      <select
                        value={String(selectedAttemptId)}
                        onChange={(e) =>
                          setSelectedAttemptId(
                            e.target.value === "current"
                              ? "current"
                              : Number(e.target.value),
                          )
                        }
                        className="bg-surface-secondary border border-border rounded-sm px-8 py-4 text-caption text-text-primary cursor-pointer"
                      >
                        {attemptOptions.map((opt) => (
                          <option key={String(opt.id)} value={String(opt.id)}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div
                    className="flex items-center rounded-sm border border-border overflow-hidden ml-auto"
                    role="group"
                    aria-label="Pipeline view mode"
                  >
                    <ViewToggleButton
                      label="Timeline"
                      icon={<ListOrdered size={11} />}
                      active={view === "timeline"}
                      onClick={() => setView("timeline")}
                    />
                    <ViewToggleButton
                      label="DAG"
                      icon={<GitBranch size={11} />}
                      active={view === "dag"}
                      onClick={() => setView("dag")}
                    />
                  </div>
                </div>

                {selectedAttempt.preBackendInstrumentation && (
                  <div className="px-12 py-10 rounded-sm bg-warning-subtle text-caption text-warning">
                    Executed-path evidence not available for this attempt — entry
                    pre-dates per-node tracking. (ADR-027 Phase B migration window.)
                  </div>
                )}

                {view === "timeline" && (
                  <EventsTimeline
                    executedNodes={selectedAttempt.executedNodes}
                    finalStatus={selectedAttempt.finalStatus}
                  />
                )}
                {view === "dag" && topology && (
                  <Suspense fallback={
                    <div className="text-caption text-text-tertiary px-12 py-16">
                      Loading DAG view…
                    </div>
                  }>
                    <PipelineDAG
                      topology={topology}
                      executedNodes={selectedAttempt.executedNodes}
                      finalStatus={selectedAttempt.finalStatus}
                    />
                  </Suspense>
                )}
                {view === "dag" && !topology && (
                  <div className="text-caption text-text-tertiary px-12 py-16">
                    Fetching topology…
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Reanalysis History — preserved for audit detail; the
              attempt selector above is the operator-facing view. */}
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
                <div role="tablist" aria-label="Trace evidence views" className="flex gap-4 border-b border-border mb-10">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`trace-tab-${tab.id}`}
                      aria-selected={detailTab === tab.id}
                      aria-controls={`trace-panel-${tab.id}`}
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
                  <div
                    role="tabpanel"
                    id="trace-panel-evidence"
                    aria-labelledby="trace-tab-evidence"
                    className="text-caption text-text-secondary flex flex-col gap-16"
                  >
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

                    {/* ADR-045 zone split: this is the AUDIT zone. Trace
                        fields render the raw machine tokens verbatim
                        (intent_selected = "MANUAL_ORDER_INTAKE", recipe_name =
                        "ManualOrderIntakeRecipe.py") on purpose — they are the
                        SOX evidence. Humanising them here would destroy
                        auditability. The operator-facing humanised labels live
                        in the summary zone (HeaderRibbon, record list). */}
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
                  <div
                    role="tabpanel"
                    id="trace-panel-sap"
                    aria-labelledby="trace-tab-sap"
                    className="p-12 text-text-quaternary text-caption italic bg-surface-secondary rounded-sm"
                  >
                    SAP condition records and master data will be available here — integrating with SAP ECC/S4HANA pricing procedures, condition tables, and master data views.
                  </div>
                )}
                {showPreview && detailTab === "changes" && (
                  <div
                    role="tabpanel"
                    id="trace-panel-changes"
                    aria-labelledby="trace-tab-changes"
                    className="p-12 text-text-quaternary text-caption italic bg-surface-secondary rounded-sm"
                  >
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

/**
 * Map a TerminalStatus value to the section-header badge: a short human
 * label + a CSS variant. Per CLAUDE.md Guardrail #1 / Badge.tsx
 * convention, this is a visual-mapping function over an
 * API-provided string with a default branch — no enum gate, just
 * display. Adding a new TerminalStatus on the asoe2 side without
 * touching this map ships as the safe `executed` neutral pill.
 */
function pipelineStatusBadge(
  finalStatus: string | null,
  preBackendInstrumentation: boolean,
  executedNodes: ExecutedNode[],
): { label: string; variant: string } {
  // Prefer the terminal-status label when we have one — it's
  // authoritative regardless of whether per-node trace evidence has
  // loaded yet. The trace fetch is deferred behind the Diagnostics
  // toggle (ExceptionDetailPanel.ensureTraceLoaded), so on first
  // expansion `executedNodes` is briefly empty even though the
  // backend has already written a final_status. Without this guard
  // the badge flickers from "no trace" → real status as the trace
  // arrives, which is what shows up to the operator as "the label
  // only comes after clicking it" on the live deployment.
  if (finalStatus) {
    switch (finalStatus) {
      case "COMPLETE":
      case "COMPLETE_WITH_CHILDREN":
        return { label: "complete", variant: "success" };
      case "BLOCKED":
        return { label: "blocked", variant: "error" };
      case "REJECTED":
        return { label: "rejected", variant: "error" };
      case "FAIL_TO_HUMAN":
        return { label: "failed", variant: "error" };
      case "MANUAL_REVIEW_REQUIRED":
        return { label: "review required", variant: "info" };
      case "AUDIT_CONTEXT_MISSING":
        return { label: "audit gap", variant: "error" };
    }
    // Unknown final_status — the asoe2 vocabulary expanded; render
    // it raw rather than swallow.
    return { label: finalStatus.toLowerCase(), variant: "neutral" };
  }
  // Only fall through to "no trace" when we genuinely have neither
  // a final_status nor any trace nodes — i.e. the record is
  // pre-backend-instrumentation (legacy attempts that ran before
  // ADR-027 Phase B's per-node tracking landed).
  if (preBackendInstrumentation) {
    return { label: "no trace", variant: "neutral" };
  }
  // No final_status yet (in-flight). Surface what we can from the
  // executed_nodes status field.
  const errored = executedNodes.some((n) => n.status === "errored");
  if (errored) return { label: "errored", variant: "error" };
  const halted = executedNodes.some((n) => n.status === "halted");
  if (halted) return { label: "halted", variant: "info" };
  if (executedNodes.length > 0) {
    return { label: "executed", variant: "neutral" };
  }
  return { label: "no trace", variant: "neutral" };
}


function ViewToggleButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-4 px-10 py-4 bg-transparent border-none cursor-pointer text-label font-sans transition-colors duration-fast",
        active
          ? "bg-brand text-white"
          : "text-text-tertiary hover:text-text-primary",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

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
    }).catch(() => {});
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
