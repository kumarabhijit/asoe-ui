/**
 * OverrideChooserDialog — SOX-audited override form.
 *
 * The human (manager+ per RBAC) uses this dialog to choose an explicit
 * resolution action that differs from the recipe's recommended action.
 * Backend classifies `sub_type = OVERRIDE` from chosen-vs-recommended
 * mismatch; four-eyes cosign applies when financial_impact >= policy
 * threshold.
 *
 * Guardrail #2: every option *value* comes from runtime-sourced
 * vocabularies (`/api/v1/health` or per-exception narrowed lists). The
 * dialog itself carries zero enum literals — consumers pass resolved
 * arrays in via `allowedActions` and `allowedReasonTags`.
 *
 * Per-intent cluster grouping (ADR-033 §D): when the caller passes an
 * `intent` whose cluster mapping is defined in `reasonCodeClusters.ts`,
 * reasons render as `<optgroup>`s ("Confirm the agent" / "Override with
 * a structured reason" / "Edge case" for DUPLICATE_PO). Intents without
 * a mapping fall back to the previous flat list — backward compatible.
 *
 * Free-text notes (ADR-033 §D.3): mandatory only when the chosen reason
 * is `OTHER`/`other`; optional otherwise. The submit-button enabled
 * predicate reflects this — the action hook re-asserts the same rule
 * server-side via `notesRequiredForReason`.
 *
 * Extracted from ExceptionDetailPanel (M3 of the cross-repo review):
 * pure form surface, all state owned by the caller via controlled props.
 */
"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/Button";
import {
  Combobox,
  type ComboboxGroup,
  type ComboboxItem,
} from "@/components/ui/Combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  clustersForIntent,
  notesRequiredForReason,
} from "./reasonCodeClusters";

export interface OverrideChooserDialogProps {
  /** Dialog open state — owned by useExceptionActions. */
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** Selected resolution action (controlled). */
  action: string;
  onActionChange: (action: string) => void;

  /** Selected override reason tag (controlled). */
  reasonTag: string;
  onReasonTagChange: (reasonTag: string) => void;

  /** SOX-mandatory free-text explanation (controlled). */
  notes: string;
  onNotesChange: (notes: string) => void;

  /** Caller submits via useExceptionActions.submitOverride. */
  onSubmit: () => void;

  /** True while the disposition PATCH is in flight. */
  submitting: boolean;

  /**
   * Resolution action options, already narrowed in the caller
   * (prefer `resolution_data.allowed_actions` over
   * `health.allowed_resolution_actions`). Guardrail #2: never
   * hardcoded here.
   */
  allowedActions: readonly string[];

  /**
   * Override reason-tag options, already narrowed in the caller
   * (prefer per-intent list over the global vocabulary).
   */
  allowedReasonTags: readonly string[];

  /**
   * Optional intent value — drives UI-side cluster grouping per
   * ADR-033 §D when a mapping is defined for the intent. Without this
   * (or when no mapping exists), the dialog renders reasons as a flat
   * list — back-compat for intents whose vocabularies have not been
   * curated.
   */
  intent?: string;
}

export function OverrideChooserDialog({
  open,
  onOpenChange,
  action,
  onActionChange,
  reasonTag,
  onReasonTagChange,
  notes,
  onNotesChange,
  onSubmit,
  submitting,
  allowedActions,
  allowedReasonTags,
  intent,
}: OverrideChooserDialogProps) {
  // Per-intent cluster grouping per ADR-033 §D. `null` falls back to
  // a flat list (legacy behaviour). The cluster mapping itself
  // tolerates a stale subset — we render only those codes that the
  // backend currently exposes via `allowedReasonTags`, so a code the
  // server retired would simply not appear.
  const clusters = clustersForIntent(intent);
  const allowedSet = new Set(allowedReasonTags);

  // S2 sprint follow-up #6 — shape the live vocabularies into the
  // Combobox primitive's contracts. `actionItems` is the flat
  // resolution-action list; `reasonGroups` is the per-intent
  // cluster grouping (empty groups skipped) when a mapping exists,
  // otherwise we pass a flat `reasonItems` list. The label
  // transformation (`replace(/_/g, " ")`) mirrors the legacy
  // `<option>` render so the operator sees the same text.
  const actionItems = useMemo<ComboboxItem[]>(
    () =>
      allowedActions.map((a) => ({ value: a, label: a.replace(/_/g, " ") })),
    [allowedActions],
  );
  const reasonGroups = useMemo<ComboboxGroup[] | null>(() => {
    if (!clusters) return null;
    const groups: ComboboxGroup[] = [];
    for (const cluster of clusters) {
      const items = cluster.codes
        .filter((code) => allowedSet.has(code))
        .map((code) => ({ value: code, label: code.replace(/_/g, " ") }));
      if (items.length > 0) {
        groups.push({ heading: cluster.label, items });
      }
    }
    return groups;
  }, [clusters, allowedSet]);
  const reasonItems = useMemo<ComboboxItem[] | null>(() => {
    if (clusters) return null;
    return allowedReasonTags.map((t) => ({
      value: t,
      label: t.replace(/_/g, " "),
    }));
  }, [clusters, allowedReasonTags]);

  // Notes are required only when the reason is `OTHER`/`other` per
  // ADR-033 §D.3. When no reason is selected yet, treat as required so
  // the operator can't sneak past the gate by skipping the dropdown.
  const notesRequired = !reasonTag || notesRequiredForReason(reasonTag);
  const notesOk = notesRequired ? notes.trim().length > 0 : true;

  const canSubmit =
    !submitting && action.length > 0 && reasonTag.length > 0 && notesOk;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Override exception">
        <DialogHeader>
          <DialogTitle>Override resolution</DialogTitle>
          <DialogDescription>
            Choose the resolution action the backend should apply. This is
            audited — notes are mandatory when the reason is &ldquo;Other&rdquo;.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-12">
          <label className="flex flex-col gap-4 text-caption text-text-secondary">
            Action
            {/* S2 sprint follow-up #6 — typeahead Combobox replaces
                the native dropdown. Keyboard contract (Arrow / Enter
                / Esc) comes from cmdk; the trigger preserves the same
                32px row height and aria-label so consumers don't
                shift visually. Vocabularies still flow as runtime
                props (Guardrail #2). */}
            <Combobox
              value={action}
              onChange={onActionChange}
              items={actionItems}
              ariaLabel="Resolution action"
              placeholder="Select an action…"
              filterPlaceholder="Filter actions…"
            />
          </label>
          <label className="flex flex-col gap-4 text-caption text-text-secondary">
            Reason category
            <Combobox
              value={reasonTag}
              onChange={onReasonTagChange}
              items={reasonItems ?? undefined}
              groups={reasonGroups ?? undefined}
              ariaLabel="Override reason category"
              placeholder="Select a reason…"
              filterPlaceholder="Filter reasons…"
            />
          </label>
          <label className="flex flex-col gap-4 text-caption text-text-secondary">
            Notes {notesRequired ? "(required)" : "(optional)"}
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder={
                notesRequired
                  ? "Why is an override appropriate? (SOX audit trail)"
                  : "Optional context (SOX audit trail)"
              }
              aria-label="Override notes"
              aria-required={notesRequired}
              className="w-full rounded-md border border-border bg-surface-primary px-8 py-6 text-caption text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-ring"
            />
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? "Overriding…" : "Confirm Override"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
