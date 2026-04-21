/**
 * OverrideChooserDialog — SOX-audited override form.
 *
 * The human (manager+ per RBAC) uses this dialog to choose an explicit
 * resolution action that differs from the recipe's recommended action.
 * Backend classifies `sub_type = OVERRIDE` from chosen-vs-recommended
 * mismatch; four-eyes cosign applies when financial_impact >= policy
 * threshold.
 *
 * Guardrail #2: every option comes from runtime-sourced vocabularies
 * (`/api/v1/health` or per-exception narrowed lists). The dialog
 * itself carries zero enum literals — consumers pass resolved arrays
 * in via `allowedActions` and `allowedReasonTags`.
 *
 * Extracted from ExceptionDetailPanel (M3 of the cross-repo review):
 * pure form surface, all state owned by the caller via controlled props.
 */
"use client";

import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";

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
}: OverrideChooserDialogProps) {
  const canSubmit = !submitting && action.length > 0 && notes.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Override exception">
        <DialogHeader>
          <DialogTitle>Override resolution</DialogTitle>
          <DialogDescription>
            Choose the resolution action the backend should apply. This is
            audited — notes are mandatory.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-12">
          <label className="flex flex-col gap-4 text-caption text-text-secondary">
            Action
            <select
              value={action}
              onChange={(e) => onActionChange(e.target.value)}
              aria-label="Resolution action"
              className="h-[32px] w-full rounded-md border border-border bg-surface-primary px-8 text-caption font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-ring"
            >
              <option value="">Select an action…</option>
              {allowedActions.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-4 text-caption text-text-secondary">
            Reason category
            <select
              value={reasonTag}
              onChange={(e) => onReasonTagChange(e.target.value)}
              aria-label="Override reason category"
              className="h-[32px] w-full rounded-md border border-border bg-surface-primary px-8 text-caption font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-ring"
            >
              <option value="">Select a reason…</option>
              {allowedReasonTags.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-4 text-caption text-text-secondary">
            Notes (required)
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder="Why is an override appropriate? (SOX audit trail)"
              aria-label="Override notes"
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
