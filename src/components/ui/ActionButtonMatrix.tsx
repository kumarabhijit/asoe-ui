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
import { useHotkeys } from "@/hooks/useHotkeys";
import { getHotkey } from "@/lib/hotkeys";
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
  // S2 finding #7 (sprint 2026-05-28) — Approve/Reject callbacks
  // gain an optional `reasonTagOverride`. On YELLOW/RED the operator
  // picks the tag in the comment dialog; on GREEN the hook's
  // auto-pick (`pickQuickActionReasonTag`) remains the source.
  onApprove?: (comment: string, reasonTagOverride?: string) => void;
  onReject?: (comment: string, reasonTagOverride?: string) => void;
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
  /**
   * S2 finding #7 — reason-tag options for the mandatory tag Select
   * shown above the comment textarea on YELLOW/RED Approve/Reject.
   * Sourced from `useHealth().allowed_override_reason_tags_by_intent`
   * by the consumer (Guardrail #2 — never hardcoded). Empty array or
   * undefined keeps today's optional-comment-only behaviour, so a
   * caller that has not yet wired the prop still works.
   */
  availableReasonTags?: readonly string[];
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
  availableReasonTags,
}: ActionButtonMatrixProps) {
  const isErrored = executionError !== undefined;
  const [pendingAction, setPendingAction] = useState<
    "approve" | "reject" | "reanalyze" | null
  >(null);
  const [comment, setComment] = useState("");
  // S2 finding #7 — reason_tag the operator picks before confirming
  // an Approve/Reject on YELLOW/RED. Blank by default to force a
  // conscious choice (panel decision: pre-selecting defeats the
  // learning-signal goal). Reset alongside `comment` on cancel.
  const [reasonTag, setReasonTag] = useState<string>("");

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

  // S2 finding #7 — reason_tag is mandatory on YELLOW/RED Approve/Reject
  // when the consumer supplies the tag vocabulary. GREEN keeps the
  // pre-S2 contract (the hook auto-picks). The `pendingAction` ===
  // "reanalyze" branch is unaffected; reanalyze never had a tag.
  const reasonTagRequired =
    (pendingAction === "approve" || pendingAction === "reject") &&
    (verdict === "YELLOW" || verdict === "RED") &&
    !!availableReasonTags &&
    availableReasonTags.length > 0;

  // Cmd+Enter submit is gated on the same predicate as the Confirm
  // button, so the hotkey cannot bypass the mandatory reason_tag.
  const canSubmit =
    !actionLoading &&
    actionInFlight === null &&
    pendingAction !== null &&
    !(pendingAction === "reanalyze" && comment.trim().length === 0) &&
    !(reasonTagRequired && !reasonTag);

  function confirmAction() {
    if (!canSubmit) return;
    // Only pass the second argument when there's actually a tag to
    // forward — otherwise `vi.fn().toHaveBeenCalledWith("comment")`
    // matchers in legacy tests would fail on the trailing
    // `undefined` arg.
    if (pendingAction === "approve" && onApprove) {
      if (reasonTagRequired) onApprove(comment, reasonTag);
      else onApprove(comment);
    } else if (pendingAction === "reject" && onReject) {
      if (reasonTagRequired) onReject(comment, reasonTag);
      else onReject(comment);
    } else if (pendingAction === "reanalyze" && onReanalyze) {
      onReanalyze(comment);
    }
    setPendingAction(null);
    setComment("");
    setReasonTag("");
  }

  function cancelAction() {
    setPendingAction(null);
    setComment("");
    setReasonTag("");
  }

  // S2 finding #3 — ribbon hotkeys (A/R/O/E/Y). The registry in
  // `src/lib/hotkeys.ts` is the canonical key/label source; this
  // hook wires the behaviours. Each binding mirrors its visible
  // button's gating so a hidden button cannot be triggered from
  // the keyboard. The hook also bails on input/textarea/select
  // targets, so typing in the comment dialog does not collide.
  const anyActionInFlightForHotkey = actionInFlight !== null || actionLoading;
  const showApproveAction =
    !pendingAction && !isErrored && verdict === "YELLOW";
  const showOverrideAction =
    !pendingAction &&
    !isErrored &&
    (verdict === "GREEN" || verdict === "YELLOW" || verdict === "RED");
  const showEscalateAction =
    !pendingAction && (isErrored || verdict === "YELLOW" || verdict === "RED");
  const showReanalyzeAction = !pendingAction && (
    onReanalyze !== undefined &&
    (canReanalyzeProp ?? (canOverride ?? isAdmin)) &&
    (verdict === "YELLOW" || verdict === "RED" || isErrored) &&
    reanalyzeAttempts < reanalyzeMax
  );

  useHotkeys([
    {
      key: getHotkey("ribbon.approve")!.key,
      handler: () => setPendingAction("approve"),
      enabled:
        showApproveAction &&
        !!onApprove &&
        (canApprove ?? true) &&
        !anyActionInFlightForHotkey,
    },
    {
      key: getHotkey("ribbon.reject")!.key,
      handler: () => setPendingAction("reject"),
      enabled:
        showApproveAction &&
        !!onReject &&
        (canApprove ?? true) &&
        !anyActionInFlightForHotkey,
    },
    {
      key: getHotkey("ribbon.override")!.key,
      handler: () => onOverride?.(),
      enabled:
        showOverrideAction &&
        !!onOverride &&
        (canOverride ?? isAdmin) &&
        !anyActionInFlightForHotkey,
    },
    {
      key: getHotkey("ribbon.escalate")!.key,
      handler: () => onEscalate?.(),
      enabled:
        showEscalateAction &&
        !!onEscalate &&
        (canEscalate ?? true) &&
        !anyActionInFlightForHotkey,
    },
    {
      key: getHotkey("ribbon.reanalyze")!.key,
      handler: () => setPendingAction("reanalyze"),
      enabled: showReanalyzeAction && !anyActionInFlightForHotkey,
    },
  ]);

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

      {/* Comment input — reanalyze requires a non-empty reason (SOX).
          S2 #4 — Cmd+Enter discoverability hint in placeholder copy.
          S2 #7 — reason_tag Select rendered above the textarea on
          YELLOW/RED Approve/Reject (mandatory; gates Confirm).
          S2 #10 — aria-live polite announcement on every open
          variant so screen reader users hear the state shift the
          moment the dialog mounts, including the optional-comment
          GREEN variant which previously announced nothing. */}
      {pendingAction && (
        <div
          className="flex flex-col gap-8 p-12 bg-surface-secondary rounded-sm"
          role={
            pendingAction === "reanalyze" || reasonTagRequired
              ? "dialog"
              : undefined
          }
          aria-modal={
            pendingAction === "reanalyze" || reasonTagRequired ? true : undefined
          }
          aria-live="polite"
          aria-label={
            pendingAction === "reanalyze"
              ? "Reanalyze reason required"
              : reasonTagRequired
                ? `${pendingAction === "approve" ? "Approval" : "Rejection"} reason required`
                : pendingAction === "approve"
                  ? "Approval comment — optional"
                  : "Rejection comment — optional"
          }
        >
          <div className="flex items-center gap-6 text-caption font-semibold text-text-secondary">
            <MessageSquare size={14} />
            {pendingAction === "approve"
              ? reasonTagRequired
                ? "Approval Reason (required)"
                : "Approval Comment"
              : pendingAction === "reject"
                ? reasonTagRequired
                  ? "Rejection Reason (required)"
                  : "Rejection Comment"
                : "Reanalyze Reason (required)"}
          </div>
          {reasonTagRequired && availableReasonTags && (
            <label className="flex flex-col gap-4 text-caption text-text-secondary">
              <span>
                Reason category{" "}
                <span aria-hidden className="text-text-quaternary">
                  ({verdict} verdict — mandatory)
                </span>
              </span>
              <select
                value={reasonTag}
                onChange={(e) => setReasonTag(e.target.value)}
                aria-required="true"
                aria-label={`${pendingAction === "approve" ? "Approval" : "Rejection"} reason category`}
                autoFocus
                className="w-full px-8 py-6 border border-border rounded-sm text-caption font-sans text-text-primary bg-surface-primary outline-none focus:border-brand"
              >
                <option value="">Select a reason…</option>
                {availableReasonTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              pendingAction === "approve"
                ? reasonTagRequired
                  ? "Add approval notes (optional) — ⌘↵ to submit"
                  : "Add approval notes (optional) — ⌘↵ to submit"
                : pendingAction === "reject"
                  ? reasonTagRequired
                    ? "Add rejection notes (optional) — ⌘↵ to submit"
                    : "Provide rejection reason — ⌘↵ to submit"
                  : "Why should this be re-run? (e.g., new contract uploaded, gateway was down) — ⌘↵ to submit"
            }
            // When the reason-tag Select is shown it owns autoFocus
            // so the operator's eye lands on the mandatory choice
            // first. Otherwise the textarea is the only field and
            // takes focus directly.
            autoFocus={!reasonTagRequired}
            rows={3}
            aria-keyshortcuts="Meta+Enter"
            className="w-full px-12 py-8 border border-border rounded-sm text-caption font-sans text-text-primary bg-surface-primary resize-y outline-none focus:border-brand"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey) confirmAction();
              if (e.key === "Escape") cancelAction();
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
              disabled={!canSubmit}
              onClick={confirmAction}
              aria-keyshortcuts="Meta+Enter"
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
