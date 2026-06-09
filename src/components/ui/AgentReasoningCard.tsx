/**
 * AgentReasoningCard — Layer 1 cognition pattern.
 * Section 11.1:
 *   Layer 1 (always visible): recommendation + confidence bar, key data, action button.
 *   Layer 2 (trace evidence): moved to the Trace Evidence collapsible section
 *   in ExceptionDetailPanel to avoid duplication.
 *
 * Verdict × permission button matrix (Option A — stakeholder approved):
 *   GREEN  → [Override…] (privileged only). GREEN is passive; no Approve.
 *   YELLOW → [Approve] [Reject] [Escalate] for analysts; [Override…] when
 *            the operator has exceptions:override.
 *   RED    → [Override…] [Escalate]. No "Acknowledge" — that was
 *            semantically calling approve silently.
 *   FAILED/isErrored → [Escalate] only.
 *
 * Label history: originally "Override…", renamed briefly to "Decide…" in
 * Phase 3 after voice-of-user research found analysts avoided the button
 * — but the button is only visible to manager+, and that research
 * population never saw it. Reverted to "Override…" in Phase 4 after the
 * UX panel reconvened: managers exercise authority, SOX §404 names this
 * act "management override of controls," and the backend sub_type and
 * audit event (EXCEPTION_RESOLVED sub_type=OVERRIDE) already use the
 * word — keeping a single vocabulary from button to audit row. The
 * destructive (red) button variant pairs naturally with "Override."
 * aria-label and hover tooltip remain "Choose different action" for
 * screen-reader and mouse-over discoverability.
 *
 * Permissions are derived in the parent (`hasPermission('exceptions:*')`)
 * and passed as `canApprove / canOverride / canEscalate`.
 */
"use client";

import { type ReactNode } from "react";
import { Zap, Check, AlertTriangle, ShieldX, XCircle } from "lucide-react";
import { Badge, verdictVariant } from "./Badge";
import { ConfidenceDisplay, type ConfidenceVariant } from "./ConfidenceDisplay";
import { ActionButtonMatrix } from "./ActionButtonMatrix";
import { PolicyHitBadge } from "./PolicyHitBadge";
import { cn } from "@/lib/utils";
import { useIntentLabel } from "@/hooks/useErpProfile";
import type { ShadowVerdict } from "@/types/exceptions";

/**
 * ExecutionError — a backend-reported execution failure distinct from a
 * Compliance Shadow verdict. Raised when a recipe throws, a gateway times
 * out, or the circuit breaker trips. Not the same as RED (policy block).
 */
export interface ExecutionError {
  /** Pipeline node that failed, if known. Open string per
   *  Guardrail #2 — sourced from trace.executed_nodes whose canonical
   *  names come from the compiled-graph topology, not a UI enum. */
  node?: string;
  /** Human-readable failure message from backend (trace.explanation) */
  message: string;
  /** ISO timestamp of the failure */
  failedAt?: string;
}

/**
 * Which mutating action is currently in flight, if any. Used for pessimistic
 * UI: the matching button shows "Verbing…" and is disabled; the others are
 * also disabled to prevent double-submission.
 */
export type ActionInFlight =
  | "approve"
  | "reject"
  | "override"
  | "escalate"
  | "reanalyze"
  // Phase 2 #5 — four-eyes cosign in flight. Owned by the cosign banner
  // in ExceptionDetailPanel, not by AgentReasoningCard itself.
  | "cosign-approve"
  | "cosign-reject"
  | null;

interface AgentReasoningCardProps {
  verdict: ShadowVerdict;
  /** When present, overrides verdict display with an execution-error surface. */
  executionError?: ExecutionError;
  intent?: string;
  /** Council 2026-06-07 — whether to show the intent in Layer 1. Sourced
   *  from `analysis.presentation.show_intent` (backend-owned): true only
   *  when the intent DISCRIMINATES the decision (CREDIT_BLOCK, DUPLICATE_PO),
   *  false when it merely restates the arrival channel (MANUAL_ORDER_INTAKE).
   *  The card honors this; it never re-decides (Guardrail #0). The raw enum
   *  is always available in the Diagnostics surface. */
  showIntent?: boolean;
  confidence?: number;
  /** Backend calibration claim for `confidence` (ADR-032). When omitted /
   *  false, ConfidenceDisplay frames the score as a raw model score rather
   *  than a validated probability. Sourced from
   *  `analysis.confidence_signal.calibrated`. */
  confidenceCalibrated?: boolean;
  /** Confidence renderer (cockpit-refactor). Defaults to the Layer-1 `bar`;
   *  the cockpit composition passes `ring` for the hero gauge. Purely
   *  presentational — same value, scale, and calibration posture. */
  confidenceVariant?: ConfidenceVariant;
  explanation?: string;
  policyHits?: string[];
  /** Agent's recommended action (from record.resolution_data.recommended_action).
   *  Surfaced on the Approve button as a hover tooltip so the reviewer sees
   *  exactly which action will be applied — e.g. "Apply contract price $9.80".
   *  Optional: when absent, Approve shows its generic label only. */
  recommendedAction?: string;
  // S2 finding #7 (sprint 2026-05-28) — Approve/Reject callbacks
  // gain an optional `reasonTagOverride`. The card itself does not
  // surface a tag picker — it proxies the prop to the matrix when
  // mounted inline (legacy path), and the matrix surfaces the
  // picker on YELLOW/RED.
  onApprove?: (comment: string, reasonTagOverride?: string) => void;
  onReject?: (comment: string, reasonTagOverride?: string) => void;
  // ADR-045 CP3 — Escalate reason captured by the matrix dialog.
  onEscalate?: (reason: string) => void;
  onOverride?: () => void;
  /** Fires when the user confirms a Re-analyze request with a mandatory reason.
   *  Parent is responsible for calling exceptionsApi.reanalyze and refreshing. */
  onReanalyze?: (reason: string) => void;
  /** Number of reanalyses already performed — compared against reanalyzeMax
   *  to disable the button when exhausted. */
  reanalyzeAttempts?: number;
  /** Max re-analyses allowed per exception (mirrors contracts/policy.py). */
  reanalyzeMax?: number;
  /** Legacy broad "a mutation is pending" flag. Prefer `actionInFlight` for
   *  per-action labelling; this is still honoured for callers that have not
   *  migrated. */
  actionLoading?: boolean;
  /** Pessimistic UI — which action is currently in flight, if any. */
  actionInFlight?: ActionInFlight;
  /** Caller has `exceptions:approve` — shows Approve / Reject on YELLOW. */
  canApprove?: boolean;
  /** Caller has `exceptions:override` — shows Override… on GREEN/YELLOW/RED. */
  canOverride?: boolean;
  /** Caller has `exceptions:escalate` — shows Escalate. */
  canEscalate?: boolean;
  /** Caller has `exceptions:override` — shows Re-analyze in overflow. */
  canReanalyze?: boolean;
  /** @deprecated Use `canOverride` instead. Retained for migration safety —
   *  treated as a fallback when `canOverride` is not provided. */
  isAdmin?: boolean;
  /**
   * S2 finding #7 — reason-tag vocabulary for the mandatory tag
   * Select shown by `ActionButtonMatrix` on YELLOW/RED Approve/
   * Reject. Sourced from `useHealth` upstream. Proxied through the
   * card untouched; absent means the matrix keeps today's optional-
   * comment-only behaviour.
   */
  availableReasonTags?: readonly string[];
  className?: string;
}

/**
 * Cap on the primary action buttons rendered in any single verdict
 * branch. The verdict × permission matrix above tops out at 3
 * (YELLOW + canApprove + canEscalate → Approve / Reject / Escalate);
 * a fourth primary CTA produces the button-soup anti-pattern the UX
 * panel flagged. Source-grep-locked by
 * tests/architectural/ux_clutter_invariants.test.ts.
 */
export const MAX_PRIMARY_ACTIONS = 3;

const VERDICT_CONFIG: Record<ShadowVerdict, { label: string; icon: ReactNode }> = {
  GREEN: { label: "Auto-resolved", icon: <Check size={14} /> },
  YELLOW: { label: "Review Required", icon: <AlertTriangle size={14} /> },
  RED: { label: "Blocked by Policy", icon: <ShieldX size={14} /> },
};

/** Title-case snake_case node ids for display. Node names are sourced
 *  from the compiled-graph topology (open set per Guardrail #2), not
 *  from a closed UI enum — so this is a pure transform, not a mapping. */
function humanizeNode(id: string): string {
  return id
    .split("_")
    .map((p) => (p.length === 0 ? "" : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

/** Human-friendly rendering of an AllowedResolutionAction code for the
 *  Approve-button tooltip. ALLOW_BOTH → "Allow both". The action code itself
 *  is still passed to the backend unchanged — this is a display-layer
 *  transform only. */
function formatActionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function AgentReasoningCard({
  verdict,
  executionError,
  intent,
  showIntent = false,
  confidence,
  confidenceCalibrated,
  confidenceVariant = "bar",
  explanation,
  policyHits,
  recommendedAction,
  onApprove,
  onReject,
  onEscalate,
  onOverride,
  onReanalyze,
  reanalyzeAttempts = 0,
  reanalyzeMax = 3,
  actionLoading = false,
  actionInFlight = null,
  canApprove,
  canOverride,
  canEscalate,
  canReanalyze,
  isAdmin = false,
  availableReasonTags,
  className,
}: AgentReasoningCardProps) {
  const isErrored = executionError !== undefined;
  const config = VERDICT_CONFIG[verdict];
  const intentLabel = useIntentLabel(intent);

  return (
    <div className={cn("bg-surface-primary rounded-md shadow-sm overflow-hidden", className)}>
      {/* ── Layer 1: Always visible ─────────────────────────────────── */}
      <div className="px-20 py-16">
        {/* Header row */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-8">
            <Zap size={16} className="text-brand" />
            <span className="text-subhead font-semibold text-text-primary">Agent Recommendation</span>
          </div>
          {isErrored ? (
            <Badge variant="error" icon={<XCircle size={14} />}>Execution Failed</Badge>
          ) : (
            <Badge variant={verdictVariant(verdict)} icon={config.icon}>
              {config.label}
            </Badge>
          )}
        </div>

        {/* Execution error banner — present only when the backend reported a
            runtime failure (recipe threw, gateway timed out, circuit breaker).
            Distinct from RED verdict, which is a compliance decision. */}
        {isErrored && (
          <div
            role="alert"
            aria-live="polite"
            className="px-12 py-10 bg-error-subtle border border-error-border rounded-sm mb-12"
          >
            <div className="flex items-center gap-6 mb-4">
              <XCircle size={14} className="text-error shrink-0" />
              <span className="text-label font-semibold text-error uppercase tracking-wider">
                {executionError.node
                  ? `Failed at ${humanizeNode(executionError.node)}`
                  : "Pipeline failure"}
              </span>
            </div>
            <p className="text-caption text-error m-0 leading-normal">
              {executionError.message}
            </p>
            {executionError.failedAt && (
              <p className="text-label text-error font-mono opacity-70 m-0 mt-4">
                {new Date(executionError.failedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Confidence bar — canonical cross-case renderer. `confidence`
            reaches the card already normalised to 0–1 (the parent divides
            the 0–100 OrderAnalysis.confidence via toCanonicalConfidence). */}
        {confidence !== undefined && (
          <div className="mb-12">
            <span className="block text-label text-text-tertiary font-semibold tracking-wider uppercase mb-4">
              Confidence
            </span>
            <ConfidenceDisplay
              value={confidence}
              scale="unit"
              variant={confidenceVariant}
              calibrated={confidenceCalibrated}
            />
          </div>
        )}

        {/* Key data points. Council 2026-06-07: the intent is shown only
            when it DISCRIMINATES the decision (backend show_intent); a
            channel-restating intent (MANUAL_ORDER_INTAKE) adds no L1
            value and stays out. The recipe name is an engine internal —
            it is never operator-facing L1; it lives in the Diagnostics
            surface (DiagnosticsSection renders trace.recipe_name). Both
            remain available there (Guardrail #7), just not front-and-
            center (Guardrail #0). */}
        {intent && showIntent && (
          <div className="flex gap-16 mb-12 flex-wrap">
            <div>
              <span className="text-label text-text-quaternary uppercase tracking-wider font-semibold">Intent</span>
              <div className="text-body font-semibold text-text-primary mt-px">{intentLabel}</div>
            </div>
          </div>
        )}

        {/* Explanation — suppressed when errored to avoid misleading success text */}
        {!isErrored && explanation && (
          <p className="text-body text-text-secondary leading-normal m-0 mb-12">
            {explanation}
          </p>
        )}

        {/* Policy hits for RED — distinguishes L1 (rule-based) from L2
            (LLM-based) sources via PolicyHitBadge per ADR-039 §4.5. */}
        {verdict === "RED" && policyHits && policyHits.length > 0 && (
          <div className="px-12 py-8 bg-error-subtle rounded-sm mb-12">
            <span className="text-label text-error font-semibold">Blocking Policy Rules</span>
            <ul className="mt-4 mb-0 pl-0 list-none flex flex-col gap-4">
              {policyHits.map((hit) => (
                <li key={hit}>
                  <PolicyHitBadge hit={hit} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action surface — verdict × permission matrix. ADR-045 CP3:
            this card is the SOLE action host (the separate
            StickyActionRibbon is retired), so the matrix always renders
            inline here. `<ActionButtonMatrix>` remains the single source
            of truth for the verdict × permission logic. */}
        <ActionButtonMatrix
          verdict={verdict}
          executionError={executionError}
          recommendedAction={recommendedAction}
          onApprove={onApprove}
          onReject={onReject}
          onEscalate={onEscalate}
          onOverride={onOverride}
          onReanalyze={onReanalyze}
          reanalyzeAttempts={reanalyzeAttempts}
          reanalyzeMax={reanalyzeMax}
          actionLoading={actionLoading}
          actionInFlight={actionInFlight}
          canApprove={canApprove}
          canOverride={canOverride}
          canEscalate={canEscalate}
          canReanalyze={canReanalyze}
          isAdmin={isAdmin}
          availableReasonTags={availableReasonTags}
        />
      </div>
    </div>
  );
}
