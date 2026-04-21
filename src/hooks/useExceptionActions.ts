/**
 * useExceptionActions — HITL action-handler bundle.
 *
 * Encapsulates the six handlers the ExceptionDetailPanel runs against
 * an exception (approve / reject / escalate / override / cosign /
 * reanalyze) plus the override-chooser dialog state. Before this
 * extraction those handlers lived inline in ExceptionDetailPanel.tsx
 * — part of an 820-line component (review M3). The hook keeps the
 * orchestrator focused on orchestration.
 *
 * Contract:
 *   * Every handler is RBAC-gated via `hasPermission` from useAuth
 *     and surfaces a warning toast + early-return on deny.
 *   * `actionInFlight` tracks which action is currently mid-flight so
 *     each button can show its own "Verbing…" label while others stay
 *     disabled (pessimistic UI).
 *   * Successful API calls update `detail` via the provided setter
 *     and invoke `onActionComplete?.()`.
 *   * Failures route error toasts with the server-provided message
 *     where possible (api.ts unwraps `{ error: { code, message } }`
 *     into `Error("<code>: <message>")`).
 *
 * Callers still render the override chooser dialog and cosign banner
 * themselves — those are JSX. The hook owns only the action logic +
 * the dialog's controlled-input state.
 */
"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { exceptionsApi } from "@/lib/api";
import type { ActionInFlight } from "@/components/ui/AgentReasoningCard";
import type { ExceptionDetail } from "@/types/exceptions";

export interface UseExceptionActionsOptions {
  exceptionId: string;
  detail: ExceptionDetail | null;
  setDetail: (detail: ExceptionDetail) => void;
  onActionComplete?: () => void;
  /**
   * Full-refresh callback invoked after re-analyze so the orchestrator
   * can re-fetch trace / analysis / line-items in one pass. Optional —
   * the hook still updates `detail` directly on the successful response.
   */
  refreshDetail?: () => Promise<void>;
  /**
   * Cross-tab coordination ref exposed by the websocket layer. Reserved
   * for future use (e.g., mirroring the server-driven refresh into the
   * in-flight state). Currently unused here — callers keep the existing
   * semantics by calling `refreshDetail` directly.
   */
  _reserved_onRefreshRef?: MutableRefObject<(() => Promise<void>) | null>;
}

export function useExceptionActions(opts: UseExceptionActionsOptions) {
  const { exceptionId, detail, setDetail, onActionComplete, refreshDetail } = opts;
  const { hasPermission } = useAuth();
  const { addToast } = useToast();

  const [actionInFlight, setActionInFlight] = useState<ActionInFlight>(null);

  // Override chooser dialog state. Owned by the hook so the panel can
  // render the dialog declaratively without passing 5 setters through
  // intermediate components. The gate-open handler is `handleOverride`;
  // submit is `submitOverride`; cancel is handled by the dialog
  // component setting `overrideOpen = false` via the setter.
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideAction, setOverrideAction] = useState<string>("");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [overrideReasonTag, setOverrideReasonTag] = useState<string>("");

  /** Resolve the recipe-recommended action from the exception detail. */
  const recommendedAction = useCallback((): string | null => {
    const rd = (detail?.resolution_data ?? {}) as Record<string, unknown>;
    const v = rd.recommended_action;
    return typeof v === "string" ? v : null;
  }, [detail]);

  /** Approve = endorse the recipe's recommended action. */
  const handleApprove = useCallback(async (comment: string) => {
    if (!hasPermission("exceptions:approve")) {
      addToast("warning", "Permission denied: your role cannot approve exceptions.");
      return;
    }
    const recommended = recommendedAction();
    if (!recommended) {
      addToast("warning", "No recipe recommendation on this exception — use Override to choose an action.");
      return;
    }
    setActionInFlight("approve");
    try {
      const updated = await exceptionsApi.disposition(exceptionId, {
        action: recommended,
        notes: comment || "Approved by reviewer",
        reason_tag: "other",
      });
      setDetail(updated);
      addToast("success", `Exception ${exceptionId} approved (${recommended})`);
      onActionComplete?.();
    } catch (err) {
      console.error("Approve failed:", err);
      addToast("error", err instanceof Error ? err.message : "Failed to approve exception.");
    } finally { setActionInFlight(null); }
  }, [exceptionId, hasPermission, addToast, recommendedAction, setDetail, onActionComplete]);

  /** Reject = NO_ACTION. Server classifies sub_type as REJECT. */
  const handleReject = useCallback(async (comment: string) => {
    if (!hasPermission("exceptions:approve")) {
      addToast("warning", "Permission denied: your role cannot reject exceptions.");
      return;
    }
    setActionInFlight("reject");
    try {
      const updated = await exceptionsApi.disposition(exceptionId, {
        action: "NO_ACTION",
        notes: comment || "Rejected by reviewer",
        reason_tag: "other",
      });
      setDetail(updated);
      addToast("success", `Exception ${exceptionId} rejected`);
      onActionComplete?.();
    } catch (err) {
      console.error("Reject failed:", err);
      addToast("error", err instanceof Error ? err.message : "Failed to reject exception.");
    } finally { setActionInFlight(null); }
  }, [exceptionId, hasPermission, addToast, setDetail, onActionComplete]);

  /**
   * Escalate is a routing action — its own endpoint with its own
   * permission (`exceptions:escalate`). Reason is mandatory per SOX;
   * fall back to window.prompt for Phase 1 (richer dialog tracked
   * separately).
   */
  const handleEscalate = useCallback(async () => {
    if (!hasPermission("exceptions:escalate")) {
      addToast("warning", "Permission denied: your role cannot escalate exceptions.");
      return;
    }
    const reason = typeof window !== "undefined"
      ? window.prompt("Reason for escalation (required):")
      : null;
    if (!reason || !reason.trim()) {
      addToast("warning", "A reason is required to escalate.");
      return;
    }
    setActionInFlight("escalate");
    try {
      const updated = await exceptionsApi.escalate(exceptionId, { reason: reason.trim() });
      setDetail(updated);
      addToast("warning", `Exception ${exceptionId} escalated for review`);
      onActionComplete?.();
    } catch (err) {
      console.error("Escalate failed:", err);
      addToast("error", err instanceof Error ? err.message : "Failed to escalate exception.");
    } finally { setActionInFlight(null); }
  }, [exceptionId, hasPermission, addToast, setDetail, onActionComplete]);

  /** Opens the Override chooser dialog. API call happens on submit. */
  const handleOverride = useCallback(() => {
    if (!hasPermission("exceptions:override")) {
      addToast("warning", "Permission denied: your role cannot override exceptions.");
      return;
    }
    setOverrideAction("");
    setOverrideNotes("");
    setOverrideReasonTag("");
    setOverrideOpen(true);
  }, [hasPermission, addToast]);

  /**
   * Submits the override chosen in the dialog. Server classifies
   * sub_type from the chosen action vs. the record's recommended_action
   * (chosen != recommended → OVERRIDE; four-eyes applies).
   */
  const submitOverride = useCallback(async () => {
    if (!overrideAction) {
      addToast("warning", "Select a resolution action.");
      return;
    }
    if (!overrideReasonTag) {
      addToast("warning", "Select a reason category.");
      return;
    }
    if (!overrideNotes.trim()) {
      addToast("warning", "Notes are required (SOX audit trail).");
      return;
    }
    setActionInFlight("override");
    try {
      const updated = await exceptionsApi.disposition(exceptionId, {
        action: overrideAction,
        notes: overrideNotes.trim(),
        reason_tag: overrideReasonTag,
      });
      setDetail(updated);
      setOverrideOpen(false);
      addToast("success", `Exception ${exceptionId} overridden (${overrideAction})`);
      onActionComplete?.();
    } catch (err) {
      console.error("Override failed:", err);
      addToast("error", err instanceof Error ? err.message : "Failed to override exception.");
    } finally { setActionInFlight(null); }
  }, [exceptionId, overrideAction, overrideNotes, overrideReasonTag, addToast, setDetail, onActionComplete]);

  /**
   * Four-eyes cosign (Phase 2 #5). Reason via window.prompt for Phase
   * 1 parity — the backend enforces SoD (caller must not be the
   * initiator) and non-empty notes.
   */
  const handleCosign = useCallback(async (approve: boolean) => {
    if (!hasPermission("exceptions:override")) {
      addToast("warning", "Permission denied: your role cannot cosign overrides.");
      return;
    }
    const promptLabel = approve
      ? "Cosign approval — notes (required, SOX):"
      : "Cosign rejection — reason (required, SOX):";
    const notes = typeof window !== "undefined" ? window.prompt(promptLabel) : "";
    if (notes === null) return;  // user cancelled
    if (!notes.trim()) {
      addToast("warning", "Notes are required (SOX audit trail).");
      return;
    }
    setActionInFlight(approve ? "cosign-approve" : "cosign-reject");
    try {
      const updated = await exceptionsApi.cosign(exceptionId, { approve, notes: notes.trim() });
      setDetail(updated);
      addToast(
        "success",
        approve
          ? `Override cosigned and applied (${updated.resolved_action ?? ""})`
          : "Override rejected; exception restored to prior state",
      );
      onActionComplete?.();
    } catch (err) {
      console.error("Cosign failed:", err);
      addToast("error", err instanceof Error ? err.message : "Cosign failed.");
    } finally { setActionInFlight(null); }
  }, [exceptionId, hasPermission, addToast, setDetail, onActionComplete]);

  /**
   * Re-run the graph. Same permission as override (manager+) — expert
   * synthesis ruled that re-analysis is materially similar to
   * overriding an agent decision.
   */
  const handleReanalyze = useCallback(async (reason: string) => {
    if (!hasPermission("exceptions:override")) {
      addToast("warning", "Permission denied: your role cannot re-analyze exceptions.");
      return;
    }
    if (!reason.trim()) {
      addToast("warning", "A reason is required for re-analysis.");
      return;
    }
    setActionInFlight("reanalyze");
    try {
      const updated = await exceptionsApi.reanalyze(exceptionId, { reason });
      setDetail(updated);
      if (refreshDetail) await refreshDetail();
      addToast("success", `Exception ${exceptionId} re-analyzed`);
      onActionComplete?.();
    } catch (err) {
      console.error("Reanalyze failed:", err);
      addToast("error", err instanceof Error ? err.message : "Re-analysis failed.");
    } finally { setActionInFlight(null); }
  }, [exceptionId, hasPermission, addToast, setDetail, onActionComplete, refreshDetail]);

  return {
    actionInFlight,
    handleApprove,
    handleReject,
    handleEscalate,
    handleOverride,
    submitOverride,
    handleCosign,
    handleReanalyze,
    // Override dialog state — the panel reads these in its dialog JSX.
    overrideOpen,
    setOverrideOpen,
    overrideAction,
    setOverrideAction,
    overrideNotes,
    setOverrideNotes,
    overrideReasonTag,
    setOverrideReasonTag,
  } as const;
}
