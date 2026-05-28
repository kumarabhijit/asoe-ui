// ActionButtonMatrix — shared verdict × permission action surface.
//
// ADR-041 P3e §2.2. Single source of truth for the HITL action
// buttons (Approve / Reject / Override / Escalate / Re-analyze)
// and the comment-input swap that gates Approve / Reject /
// Reanalyze on a typed comment. Two consumers:
//
//   1. `AgentReasoningCard` — Layer 1 cognition surface; mounts the
//      matrix inline (legacy, flag off).
//   2. `StickyActionRibbon` — sticky-at-top chrome at the top of
//      the right-pane scroll container (flag on); keeps Approve
//      above the fold no matter the Analysis-section length.
//
// The verdict × permission matrix MUST stay identical between the
// two mount points — divergence is a SOX failure mode (an operator
// approving via one mount sees different buttons than via the
// other). This component is the lock: both consumers render
// `<ActionButtonMatrix />`; the matrix has no caller-supplied
// JSX overrides.
//
// State (pendingAction + comment) is local to each mount. In V2
// mode only StickyActionRibbon mounts the matrix; in legacy mode
// only AgentReasoningCard does. They never both mount at once, so
// there is no state-sync concern.

"use client";

import { useState } from "react";
import { MessageSquare, RotateCcw } from "lucide-react";

import { Button } from "./Button";
import { actionLabel as resolveActionLabel } from "@/lib/cases";
import { cn } from "@/lib/utils";
import type { ShadowVerdict } from "@/types/exceptions";
import type { ActionInFlight, ExecutionError } from "./AgentReasoningCard";

/**
 * Cap on the primary action buttons rendered in any single verdict
 * branch. Mirror of `AgentReasoningCard.MAX_PRIMARY_ACTIONS` so the
 * source-grep lock at
 * `tests/architectural/ux_clutter_invariants.test.ts` continues to
 * find a single canonical value.
 */
export const MAX_PRIMARY_ACTIONS = 3;

export interface ActionButtonMatrixProps {
  verdict: ShadowVerdict;
  executionError?: ExecutionError;
  recommendedAction?: string;
  onApprove?: (comment: string) => void;
  onReject?: (comment: string) => void;
  onEscalate?: () => void;
  onOverride?: () => void;
  onReanalyze?: (reason: string) => void;
  reanalyzeAttempts?: number;
  reanalyzeMax?: number;
  actionLoading?: boolean;
  actionInFlight?: ActionInFlight;
  canApprove?: boolean;
  canOverride?: boolean;
  canEscalate?: boolean;
  canReanalyze?: boolean;
  isAdmin?: boolean;
  className?: string;
}

function formatActionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function ingForm(label: string): string {
  const verb = label.split(/\s+/)[0] || label;
  if (verb.endsWith("e")) return verb.slice(0, -1) + "ing";
  return verb + "ing";
}

export function ActionButtonMatrix({
  verdict,
  executionError,
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
  canReanalyze: canReanalyzeProp,
  isAdmin = false,
  className,
}: ActionButtonMatrixProps) {
  const isErrored = executionError !== undefined;
  const [pendingAction, setPendingAction] = useState<
    "approve" | "reject" | "reanalyze" | null
  >(null);
  const [comment, setComment] = useState("");

  const effectiveCanOverride = canOverride ?? isAdmin;
  const effectiveCanApprove = canApprove ?? true;
  const effectiveCanEscalate = canEscalate ?? true;

  const reanalyzeAllowedByPermission = canReanalyzeProp ?? effectiveCanOverride;
  const canReanalyze =
    onReanalyze !== undefined &&
    reanalyzeAllowedByPermission &&
    (verdict === "YELLOW" || verdict === "RED" || isErrored) &&
    reanalyzeAttempts < reanalyzeMax;

  const anyActionInFlight = actionInFlight !== null || actionLoading;

  const action = recommendedAction ? resolveActionLabel(recommendedAction) : null;
  const primaryLabel = action?.primary ?? "Approve";
  const secondaryLabel = action?.secondary ?? "Reject";
  const actionCaption = action?.caption;
  const primaryInProgress = ingForm(primaryLabel);
  const secondaryInProgress = ingForm(secondaryLabel);

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

  function visibleLabel(
    base: string,
    inProgress: string,
    key: Exclude<ActionInFlight, null>,
  ): string {
    return actionInFlight === key ? `${inProgress}…` : base;
  }

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {/* YELLOW caption — non-obvious side effect for the recommended
          action ("Send drafted email", "Merge POs", …). */}
      {!pendingAction && verdict === "YELLOW" && actionCaption && (
        <p className="m-0 text-caption text-text-tertiary">{actionCaption}</p>
      )}

      {/* Button row. Hidden when the comment-input gate is open. */}
      {!pendingAction && (
        <div className="flex gap-8 flex-wrap">
          {isErrored ? (
            onEscalate && effectiveCanEscalate && (
              <Button
                variant="neutral"
                size="sm"
                disabled={anyActionInFlight}
                onClick={onEscalate}
                aria-label="Send for triage"
              >
                {visibleLabel("Escalate", "Escalating", "escalate")}
              </Button>
            )
          ) : (
            <>
              {verdict === "YELLOW" && (
                <>
                  {onApprove && effectiveCanApprove && (
                    <Button
                      variant="brand"
                      size="sm"
                      disabled={anyActionInFlight}
                      onClick={() => setPendingAction("approve")}
                      aria-label={
                        action
                          ? `${primaryLabel} — ${formatActionLabel(recommendedAction!)}`
                          : recommendedAction
                            ? `Approve recommendation: ${formatActionLabel(recommendedAction)}`
                            : "Approve recommendation"
                      }
                      title={
                        actionCaption
                          ?? (recommendedAction
                            ? `Approve: ${formatActionLabel(recommendedAction)}`
                            : undefined)
                      }
                    >
                      {visibleLabel(primaryLabel, primaryInProgress, "approve")}
                    </Button>
                  )}
                  {onReject && effectiveCanApprove && (
                    <Button
                      variant="neutral"
                      size="sm"
                      disabled={anyActionInFlight}
                      onClick={() => setPendingAction("reject")}
                      aria-label={action ? secondaryLabel : "Reject recommendation"}
                    >
                      {visibleLabel(secondaryLabel, secondaryInProgress, "reject")}
                    </Button>
                  )}
                  {onOverride && effectiveCanOverride && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={anyActionInFlight}
                      onClick={onOverride}
                      aria-label="Choose different action"
                      title="Choose different action"
                    >
                      {actionInFlight === "override" ? "Overriding…" : "Override…"}
                    </Button>
                  )}
                  {onEscalate && effectiveCanEscalate && (
                    <Button
                      variant="neutral"
                      size="sm"
                      disabled={anyActionInFlight}
                      onClick={onEscalate}
                      aria-label="Send for triage"
                    >
                      {visibleLabel("Escalate", "Escalating", "escalate")}
                    </Button>
                  )}
                </>
              )}
              {verdict === "RED" && (
                <>
                  {onOverride && effectiveCanOverride && (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={anyActionInFlight}
                      onClick={onOverride}
                      aria-label="Choose different action"
                      title="Choose different action"
                    >
                      {actionInFlight === "override" ? "Overriding…" : "Override…"}
                    </Button>
                  )}
                  {onEscalate && effectiveCanEscalate && (
                    <Button
                      variant="neutral"
                      size="sm"
                      disabled={anyActionInFlight}
                      onClick={onEscalate}
                      aria-label="Send for triage"
                    >
                      {visibleLabel("Escalate", "Escalating", "escalate")}
                    </Button>
                  )}
                </>
              )}
              {verdict === "GREEN" && onOverride && effectiveCanOverride && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={anyActionInFlight}
                  onClick={onOverride}
                  aria-label="Choose different action"
                  title="Choose different action"
                >
                  {actionInFlight === "override" ? "Overriding…" : "Override…"}
                </Button>
              )}
            </>
          )}
          {canReanalyze && (
            <Button
              variant="ghost"
              size="sm"
              disabled={anyActionInFlight}
              onClick={() => setPendingAction("reanalyze")}
              aria-label="Re-analyze exception"
              title={`Re-run this exception through a fresh Compliance Shadow (attempt ${reanalyzeAttempts + 1} of ${reanalyzeMax})`}
            >
              <RotateCcw size={13} className="mr-1" />
              {actionInFlight === "reanalyze" ? "Re-analyzing…" : "Re-analyze"}
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
          aria-label={
            pendingAction === "reanalyze" ? "Reanalyze reason required" : undefined
          }
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) confirmAction();
            }}
            required={pendingAction === "reanalyze"}
          />
          <div className="flex gap-8 justify-end">
            <Button variant="ghost" size="sm" onClick={cancelAction}>
              Cancel
            </Button>
            <Button
              variant={pendingAction === "approve" ? "brand" : "neutral"}
              size="sm"
              disabled={
                anyActionInFlight
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
  );
}
