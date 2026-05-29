/**
 * DraftReplySection — Customer Inbox "AI Draft Reply" evidence (ADR-042 Phase 7
 * surfacing of the Phase-4 reply draft).
 *
 * Projector (Guardrail #6): renders the current generated reply
 * (`analysis.draft_reply`) exactly as the ReplyDraftRecipe + any operator
 * edits produced it. The section NEVER mutates the draft itself — an operator
 * edit is delegated to `onSubmitEdit`, which owns the API write + refresh; the
 * section only carries the composer's form state. A REJECTED draft shows its
 * reason; optional fields flow through <EvidenceBlock>.
 *
 * Two follow-on capabilities (ADR-042 Phase 7 follow-on):
 *   * Operator edits + versioned history — `onSubmitEdit`/`canEdit` enable an
 *     inline composer; the append-only `revisions` chain is shown in a
 *     collapsed "Version history" disclosure (the agent's original v1 is never
 *     overwritten — SOX audit substrate).
 *   * "Jump to source email" — when `sourceSectionId` is supplied, a link
 *     expands + scrolls to the Source Email section on the same surface.
 */
"use client";

import { useId, useState } from "react";
import { Mail, Ban, CornerUpRight, Pencil, History, Check, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type {
  DraftReply,
  DraftReplyEdit,
  DraftReplyRevision,
} from "@/types/exceptions";

interface DraftReplySectionProps {
  data: DraftReply;
  /**
   * Anchor id of the Source Email section on the same surface. When set, a
   * "Jump to source email" link is rendered that expands + scrolls to it.
   * Omitted in compact mounts (e.g. the /cases audit rail) where no
   * source-email section is present — so there is never a dead link.
   */
  sourceSectionId?: string;
  /**
   * When provided AND `canEdit` is true, an "Edit draft" affordance opens an
   * inline composer. On save the edited subject/body are handed to this
   * callback, which owns the API write + refresh (Guardrail #6 — the section
   * never mutates the draft). Resolves when the write completes; rejects with
   * an Error whose message is surfaced inline.
   */
  onSubmitEdit?: (edit: { subject: string; body: string }) => Promise<void>;
  /** RBAC gate for the edit affordance (passed by the parent). */
  canEdit?: boolean;
  /**
   * Accessible region name. Defaults to "AI draft reply". A read-only mount
   * shown alongside the editable one (e.g. the /cases audit rail beside the
   * record detail) passes a distinct label so screen-reader landmark
   * navigation can tell the two regions apart (WCAG 2.4.1).
   */
  regionLabel?: string;
  /**
   * When set on a read-only mount (no `onSubmitEdit`), renders a quiet "Edit
   * in record detail" link instead of an editor — so editing has exactly one
   * canonical home (the detail) while peripheral previews point to it rather
   * than hosting a second composer. Hash target; useHashOpen expands + scrolls
   * the detail's draft section.
   */
  editInDetailHref?: string;
}

// Visual mapping (allowed — default fallback, not enum dispatch).
function statusVariant(status: string): "success" | "error" | "neutral" {
  switch (status.toUpperCase()) {
    case "DRAFTED":
      return "success";
    case "REJECTED":
      return "error";
    default:
      return "neutral";
  }
}

export function DraftReplySection({
  data,
  sourceSectionId,
  onSubmitEdit,
  canEdit = false,
  regionLabel = "AI draft reply",
  editInDetailHref,
}: DraftReplySectionProps) {
  const rejected = data.status.toUpperCase() === "REJECTED";
  const editable = canEdit && !!onSubmitEdit && !rejected;
  // Per-instance unique id so the component is safe to mount more than once on
  // a page (e.g. detail + rail) without colliding the body field's id/label.
  const uid = useId();
  const bodyId = `${uid}-body`;

  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState(data.subject ?? "");
  const [draftBody, setDraftBody] = useState(data.body ?? "");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = () => {
    setDraftSubject(data.subject ?? "");
    setDraftBody(data.body ?? "");
    setEditError(null);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setEditError(null);
  };
  const save = async () => {
    if (!onSubmitEdit) return;
    setSaving(true);
    setEditError(null);
    try {
      await onSubmitEdit({ subject: draftSubject, body: draftBody });
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save edit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label={regionLabel}
      className="bg-surface-primary rounded-md shadow-sm p-16 flex flex-col gap-12"
    >
      <div className="flex items-center gap-8">
        {rejected ? (
          <Ban size={14} className="text-status-error" aria-hidden />
        ) : (
          <Mail size={14} className="text-text-tertiary" aria-hidden />
        )}
        <span className="text-subhead font-semibold text-text-primary">
          AI Draft Reply
        </span>
        <Badge variant={statusVariant(data.status)} size="sm" className="ml-auto">
          {data.status}
        </Badge>
      </div>

      {/* Jump to the source email this reply answers (ADR-042 Phase 7
          follow-on). Plain in-page anchor — CollapsibleSection owns the
          expand + scroll when the hash targets it. Rendered only when the
          parent surface actually has a Source Email section. */}
      {sourceSectionId && (
        <a
          href={`#${sourceSectionId}`}
          className="inline-flex items-center gap-4 self-start text-caption text-text-brand hover:text-text-brand-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
        >
          <CornerUpRight size={12} aria-hidden />
          Jump to source email
        </a>
      )}

      {/* Read-only preview surfaces (e.g. the audit rail) point to the single
          canonical editor in the record detail rather than hosting a second
          composer — avoids divergent edit state on the SOX revision chain. */}
      {editInDetailHref && !editable && (
        <a
          href={editInDetailHref}
          className="inline-flex items-center gap-4 self-start text-caption text-text-brand hover:text-text-brand-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
        >
          <Pencil size={12} aria-hidden />
          Edit in record detail
        </a>
      )}

      {/* REJECTED → reason, no body. */}
      <EvidenceBlock tier="contextual" value={data.reason}>
        {(v) => <p className="m-0 text-caption text-status-error">{String(v)}</p>}
      </EvidenceBlock>

      <div className="grid grid-cols-2 gap-12">
        <EvidenceBlock tier="contextual" value={data.recipient}>
          {(v) => <Field label="To" value={String(v)} monospace />}
        </EvidenceBlock>
        <EvidenceBlock tier="contextual" value={data.template_name}>
          {(v) => <Field label="Template" value={String(v)} monospace />}
        </EvidenceBlock>
      </div>

      {editing ? (
        /* ── Inline composer ─────────────────────────────────────────── */
        <div className="flex flex-col gap-12">
          <Input
            label="Subject"
            value={draftSubject}
            onChange={(e) => setDraftSubject(e.target.value)}
            disabled={saving}
          />
          <div className="flex flex-col gap-6">
            <label
              htmlFor={bodyId}
              className="text-label font-bold uppercase tracking-wider text-text-tertiary"
            >
              Body
            </label>
            <textarea
              id={bodyId}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              disabled={saving}
              rows={8}
              className="flex w-full rounded-md border border-border bg-surface-primary px-12 py-10 font-sans text-body text-text-primary outline-none transition-[border-color,box-shadow] duration-instant ease-out placeholder:text-text-quaternary focus:border-border-brand focus:ring-2 focus:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {editError && (
            <p role="alert" className="m-0 text-caption text-status-error">
              {editError}
            </p>
          )}
          <div className="flex items-center gap-8">
            <Button variant="brand" size="sm" onClick={save} disabled={saving}>
              <Check size={14} aria-hidden />
              {saving ? "Saving…" : "Save edit"}
            </Button>
            <Button variant="neutral" size="sm" onClick={cancelEdit} disabled={saving}>
              <X size={14} aria-hidden />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        /* ── Read-only projection ─────────────────────────────────────── */
        <>
          <EvidenceBlock tier="contextual" value={data.subject}>
            {(v) => <Field label="Subject" value={String(v)} />}
          </EvidenceBlock>

          <EvidenceBlock tier="contextual" value={data.body}>
            {(v) => (
              <div>
                <FieldLabel>Body</FieldLabel>
                <p className="m-0 text-body text-text-secondary whitespace-pre-wrap bg-surface-secondary rounded-sm border border-border-subtle p-10">
                  {String(v)}
                </p>
              </div>
            )}
          </EvidenceBlock>

          {editable && (
            <Button
              variant="neutral"
              size="sm"
              className="self-start"
              onClick={startEdit}
              aria-label="Edit draft reply"
            >
              <Pencil size={14} aria-hidden />
              Edit draft
            </Button>
          )}
        </>
      )}

      {/* Version history (ADR-042 Phase 7 follow-on). Collapsed by default —
          the agent's original draft + every operator edit, append-only. This
          replaces the always-visible before/after edit row, which read as
          stray text at the bottom of the card in the compact rail. */}
      <VersionHistory
        revisions={data.revisions ?? []}
        editsFallback={data.edits_applied}
        currentSubject={data.subject ?? null}
        currentBody={data.body ?? null}
        draftedBy={data.drafted_by ?? null}
        draftedAt={data.drafted_at ?? null}
      />

      <EvidenceBlock tier="contextual" value={data.drafted_by}>
        {(v) => (
          <span className="text-label text-text-quaternary">
            Drafted by {String(v)}
            {data.drafted_at ? ` · ${data.drafted_at}` : ""}
          </span>
        )}
      </EvidenceBlock>
    </section>
  );
}

/**
 * Collapsed disclosure over the draft's revision chain. Prefers the
 * append-only `revisions`; for legacy drafts persisted before versioning it
 * synthesizes a two-entry view from `edits_applied` so the audit trail is
 * never lost. Renders nothing when there's no history to show.
 */
function VersionHistory({
  revisions,
  editsFallback,
  currentSubject,
  currentBody,
  draftedBy,
  draftedAt,
}: {
  revisions: DraftReplyRevision[];
  editsFallback: DraftReplyEdit[];
  currentSubject: string | null;
  currentBody: string | null;
  draftedBy: string | null;
  draftedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const fallback = editsFallback ?? [];

  // Normalise to a single revision shape so the render path is uniform.
  const entries: DraftReplyRevision[] =
    revisions.length > 0
      ? revisions
      : fallback.length > 0
        ? [
            {
              version: 1,
              subject: currentSubject,
              body: currentBody,
              edits_applied: fallback,
              author: draftedBy ?? "reply-draft-recipe",
              authored_at: draftedAt ?? "",
              source: "OPERATOR_EDIT",
            },
          ]
        : [];

  if (entries.length === 0) return null;

  // Newest first — the operator's eye lands on the current revision.
  const ordered = [...entries].sort((a, b) => b.version - a.version);

  return (
    <div className="border-t border-border-subtle pt-12">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-6 bg-transparent border-none cursor-pointer p-0 text-label font-bold uppercase tracking-wider text-text-quaternary hover:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring rounded-sm"
      >
        <History size={12} aria-hidden />
        Version history
        <span className="font-normal lowercase">({entries.length})</span>
      </button>

      {open && (
        <ul className="m-0 mt-8 p-0 list-none flex flex-col gap-8">
          {ordered.map((r) => (
            <li
              key={r.version}
              className="px-10 py-8 bg-surface-secondary rounded-sm border border-border-subtle flex flex-col gap-6"
            >
              <div className="flex items-center gap-8 text-caption">
                <span className="font-mono font-semibold text-text-primary">
                  v{r.version}
                </span>
                <Badge
                  variant={r.source === "OPERATOR_EDIT" ? "neutral" : "info"}
                  size="sm"
                >
                  {r.source === "OPERATOR_EDIT" ? "Edited" : "AI"}
                </Badge>
                <span className="text-text-tertiary truncate">{r.author}</span>
                {r.authored_at && (
                  <span className="ml-auto text-text-quaternary font-mono shrink-0">
                    {formatTimestamp(r.authored_at)}
                  </span>
                )}
              </div>
              {r.edits_applied.length > 0 && (
                <ul className="m-0 p-0 list-none flex flex-col gap-4">
                  {r.edits_applied.map((e, idx) => (
                    <li
                      key={`${e.field}-${idx}`}
                      className="flex items-center gap-8 text-label"
                    >
                      <span className="font-semibold text-text-secondary w-64 shrink-0">
                        {e.field}
                      </span>
                      <span className="font-mono text-text-tertiary line-through truncate">
                        {e.before}
                      </span>
                      <span className="text-text-quaternary shrink-0">→</span>
                      <span className="font-mono text-text-primary truncate">
                        {e.after}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** ISO-8601 → locale string; passthrough if it doesn't parse. */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div
        className={
          monospace
            ? "font-mono text-body text-text-primary break-all"
            : "text-body text-text-primary"
        }
      >
        {value}
      </div>
    </div>
  );
}
