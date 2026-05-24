/**
 * DraftReplySection — Customer Inbox "AI Draft Reply" evidence (ADR-042 Phase 7
 * surfacing of the Phase-4 reply draft).
 *
 * Dumb projector (Guardrail #6): renders the current generated reply
 * (`analysis.draft_reply`) exactly as the ReplyDraftRecipe produced it. Read-only
 * evidence — generating / sending are dispositions on the action surface, not
 * here. A REJECTED draft shows its reason; optional fields flow through
 * <EvidenceBlock>.
 */
"use client";

import { Mail, Ban } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import type { DraftReply } from "@/types/exceptions";

interface DraftReplySectionProps {
  data: DraftReply;
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

export function DraftReplySection({ data }: DraftReplySectionProps) {
  const rejected = data.status.toUpperCase() === "REJECTED";
  return (
    <section
      aria-label="AI draft reply"
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

      {/* Operator edits (before/after audit). */}
      <EvidenceBlock tier="contextual" value={data.edits_applied}>
        {() => (
          <div>
            <FieldLabel>Operator edits</FieldLabel>
            <ul className="m-0 p-0 list-none flex flex-col gap-4">
              {data.edits_applied.map((e, idx) => (
                <li
                  key={`${e.field}-${idx}`}
                  className="flex items-center gap-8 text-caption"
                >
                  <span className="font-semibold text-text-secondary w-80 shrink-0">
                    {e.field}
                  </span>
                  <span className="font-mono text-text-tertiary line-through">
                    {e.before}
                  </span>
                  <span className="text-text-quaternary">→</span>
                  <span className="font-mono text-text-primary">{e.after}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </EvidenceBlock>

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
