/**
 * AgentReasoningCard — Layer 1 cognition pattern.
 * Section 11.1:
 *   Layer 1 (always visible): recommendation + confidence bar, key data, action button.
 *   Layer 2 (trace evidence): moved to the Trace Evidence collapsible section
 *   in ExceptionDetailPanel to avoid duplication.
 *
 * Verdict-specific behavior:
 *   GREEN  → standard review actions
 *   YELLOW → reviewer needs context, Approve/Reject/Escalate
 *   RED    → blocked by policy, primary CTA removed
 */
"use client";

import { useState, type ReactNode } from "react";
import { Zap, Check, AlertTriangle, ShieldX, MessageSquare, XCircle, RotateCcw } from "lucide-react";
import { Badge, verdictVariant } from "./Badge";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import type { ShadowVerdict, PipelineNode } from "@/types/exceptions";

/**
 * ExecutionError — a backend-reported execution failure distinct from a
 * Compliance Shadow verdict. Raised when a recipe throws, a gateway times
 * out, or the circuit breaker trips. Not the same as RED (policy block).
 */
export interface ExecutionError {
  /** Pipeline node that failed, if known */
  node?: PipelineNode;
  /** Human-readable failure message from backend (trace.explanation) */
  message: string;
  /** ISO timestamp of the failure */
  failedAt?: string;
}

interface AgentReasoningCardProps {
  verdict: ShadowVerdict;
  /** When present, overrides verdict display with an execution-error surface. */
  executionError?: ExecutionError;
  intent?: string;
  confidence?: number;
  recipeName?: string;
  explanation?: string;
  policyHits?: string[];
  onApprove?: (comment: string) => void;
  onReject?: (comment: string) => void;
  onEscalate?: () => void;
  onOverride?: () => void;
  /** Fires when the user confirms a Re-analyze request with a mandatory reason.
   *  Parent is responsible for calling exceptionsApi.reanalyze and refreshing. */
  onReanalyze?: (reason: string) => void;
  /** Number of reanalyses already performed — compared against reanalyzeMax
   *  to disable the button when exhausted. */
  reanalyzeAttempts?: number;
  /** Max re-analyses allowed per exception (mirrors contracts/policy.py). */
  reanalyzeMax?: number;
  actionLoading?: boolean;
  isAdmin?: boolean;
  className?: string;
}

const VERDICT_CONFIG: Record<ShadowVerdict, { label: string; icon: ReactNode }> = {
  GREEN: { label: "Auto-resolved", icon: <Check size={14} /> },
  YELLOW: { label: "Review Required", icon: <AlertTriangle size={14} /> },
  RED: { label: "Blocked by Policy", icon: <ShieldX size={14} /> },
};

const NODE_LABELS: Partial<Record<PipelineNode, string>> = {
  ingest: "Ingest Event",
  classify: "Classify Intent",
  load_skill: "Load Skill",
  validate_circuit_breaker: "Circuit Breaker",
  shadow_audit: "Compliance Shadow",
  select_recipe: "Select Recipe",
  validate_types: "Validate Types",
  resolve_dependencies: "Resolve Dependencies",
  execute_recipe: "Execute Recipe",
  apply_effects: "Apply Effects",
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-8 flex-1">
      <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-normal ease-out",
            pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-error",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-label font-mono text-text-tertiary font-semibold min-w-[32px] text-right">
        {pct}%
      </span>
    </div>
  );
}

export function AgentReasoningCard({
  verdict,
  executionError,
  intent,
  confidence,
  recipeName,
  explanation,
  policyHits,
  onApprove,
  onReject,
  onEscalate,
  onOverride,
  onReanalyze,
  reanalyzeAttempts = 0,
  reanalyzeMax = 3,
  actionLoading = false,
  isAdmin = false,
  className,
}: AgentReasoningCardProps) {
  const isErrored = executionError !== undefined;
  const config = VERDICT_CONFIG[verdict];
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "reanalyze" | null>(null);
  const [comment, setComment] = useState("");
  // Re-analyze is eligible when the agent's prior outcome warrants review:
  // YELLOW/RED compliance verdict, or an execution crash. Not shown for GREEN
  // (auto-resolved) — matches the backend eligibility gate and closes the
  // outcome-shopping vector flagged in the expert debate.
  const canReanalyze =
    onReanalyze !== undefined
    && (verdict === "YELLOW" || verdict === "RED" || isErrored)
    && reanalyzeAttempts < reanalyzeMax;

  function confirmAction() {
    if (pendingAction === "approve" && onApprove) onApprove(comment);
    else if (pendingAction === "reject" && onReject) onReject(comment);
    else if (pendingAction === "reanalyze" && onReanalyze) onReanalyze(comment);
    setPendingAction(null);
    setComment("");
  }

  function cancelAction() {
    setPendingAction(null);
    setComment("");
  }

  return (
    <div className={cn("bg-surface-primary rounded-md shadow-sm overflow-hidden", className)}>
      {/* ── Layer 1: Always visible ─────────────────────────────────── */}
      <div className="px-20 py-16">
        {/* Header row */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-8">
            <Zap size={16} className="text-brand" />
            <span className="text-subhead font-semibold text-text-primary">Agent Analysis</span>
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
                  ? `Failed at ${NODE_LABELS[executionError.node] ?? executionError.node}`
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

        {/* Confidence bar */}
        {confidence !== undefined && (
          <div className="mb-12">
            <span className="block text-label text-text-tertiary font-semibold tracking-wider uppercase mb-4">
              Confidence
            </span>
            <ConfidenceBar value={confidence} />
          </div>
        )}

        {/* Key data points */}
        <div className="flex gap-16 mb-12 flex-wrap">
          {intent && (
            <div>
              <span className="text-label text-text-quaternary uppercase tracking-wider font-semibold">Intent</span>
              <div className="text-body font-semibold text-text-primary mt-px">{intent.replace(/_/g, " ")}</div>
            </div>
          )}
          {recipeName && (
            <div>
              <span className="text-label text-text-quaternary uppercase tracking-wider font-semibold">Recipe</span>
              <div className="text-body font-medium text-text-primary mt-px">{recipeName.replace(".py", "")}</div>
            </div>
          )}
        </div>

        {/* Explanation — suppressed when errored to avoid misleading success text */}
        {!isErrored && explanation && (
          <p className="text-body text-text-secondary leading-normal m-0 mb-12">
            {explanation}
          </p>
        )}

        {/* Policy hits for RED */}
        {verdict === "RED" && policyHits && policyHits.length > 0 && (
          <div className="px-12 py-8 bg-error-subtle rounded-sm mb-12">
            <span className="text-label text-error font-semibold">Blocking Policy Rules</span>
            <ul className="mt-4 mb-0 pl-16 text-caption text-error">
              {policyHits.map((hit) => (
                <li key={hit}>{hit}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        {!pendingAction && (
          <div className="flex gap-8 flex-wrap">
            {isErrored ? (
              // Approve/Reject are not meaningful against a crashed execution;
              // route operator to Escalate for triage.
              onEscalate && (
                <Button variant="neutral" size="sm" disabled={actionLoading} onClick={onEscalate}>
                  Escalate for Triage
                </Button>
              )
            ) : (
              <>
                {verdict === "YELLOW" && (
                  <>
                    {onApprove && <Button variant="brand" size="sm" disabled={actionLoading} onClick={() => setPendingAction("approve")}>Approve</Button>}
                    {onReject && <Button variant="neutral" size="sm" disabled={actionLoading} onClick={() => setPendingAction("reject")}>Reject</Button>}
                    {onEscalate && <Button variant="ghost" size="sm" disabled={actionLoading} onClick={onEscalate}>Escalate</Button>}
                  </>
                )}
                {verdict === "RED" && (
                  <>
                    <Button variant="neutral" size="sm" disabled={actionLoading} onClick={() => setPendingAction("approve")}>Acknowledge</Button>
                    {isAdmin && onOverride && <Button variant="destructive" size="sm" disabled={actionLoading} onClick={onOverride}>Override</Button>}
                    {onEscalate && <Button variant="ghost" size="sm" disabled={actionLoading} onClick={onEscalate}>Escalate</Button>}
                  </>
                )}
              </>
            )}
            {canReanalyze && (
              <Button
                variant="ghost"
                size="sm"
                disabled={actionLoading}
                onClick={() => setPendingAction("reanalyze")}
                title={`Re-run this exception through a fresh Compliance Shadow (attempt ${reanalyzeAttempts + 1} of ${reanalyzeMax})`}
              >
                <RotateCcw size={13} className="mr-1" />
                Re-analyze
                <span className="ml-1 font-mono opacity-60">
                  {reanalyzeAttempts}/{reanalyzeMax}
                </span>
              </Button>
            )}
          </div>
        )}

        {/* Comment input — reanalyze requires a non-empty reason (SOX). */}
        {pendingAction && (
          <div
            className="flex flex-col gap-8 p-12 bg-surface-secondary rounded-sm"
            role={pendingAction === "reanalyze" ? "dialog" : undefined}
            aria-modal={pendingAction === "reanalyze" ? true : undefined}
            aria-label={pendingAction === "reanalyze" ? "Reanalyze reason required" : undefined}
          >
            <div className="flex items-center gap-6 text-caption font-semibold text-text-secondary">
              <MessageSquare size={14} />
              {pendingAction === "approve"
                ? "Approval Comment"
                : pendingAction === "reject"
                ? "Rejection Comment"
                : "Reanalyze Reason (required)"}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                pendingAction === "approve"
                  ? "Add approval notes (optional)..."
                  : pendingAction === "reject"
                  ? "Provide rejection reason..."
                  : "Why should this be re-run? (e.g., new contract uploaded, gateway was down)"
              }
              autoFocus
              rows={3}
              className="w-full px-12 py-8 border border-border rounded-sm text-caption font-sans text-text-primary bg-surface-primary resize-y outline-none focus:border-brand"
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) confirmAction(); }}
              required={pendingAction === "reanalyze"}
            />
            <div className="flex gap-8 justify-end">
              <Button variant="ghost" size="sm" onClick={cancelAction}>Cancel</Button>
              <Button
                variant={pendingAction === "approve" ? "brand" : "neutral"}
                size="sm"
                disabled={
                  actionLoading
                  // Reanalyze reason is mandatory — mirrors the backend
                  // ReanalyzeRequest schema requirement.
                  || (pendingAction === "reanalyze" && comment.trim().length === 0)
                }
                onClick={confirmAction}
              >
                {actionLoading
                  ? "Processing..."
                  : pendingAction === "approve"
                  ? "Confirm Approval"
                  : pendingAction === "reject"
                  ? "Confirm Rejection"
                  : "Confirm Re-analyze"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
