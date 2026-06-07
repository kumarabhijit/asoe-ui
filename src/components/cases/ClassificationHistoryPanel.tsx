/**
 * ClassificationHistoryPanel — append-order audit strip rendered on
 * the case detail surface (requirements §8.6).
 *
 * One row per ClassificationEvent: classified_at, classifier_type
 * badge (HUMAN | MODEL | RULE), supergroup_code, intent_code,
 * reason_text. The history is hidden when empty (Guardrail #6 — no
 * synthesised "no history yet" placeholder).
 *
 * Partner-role responses are redacted server-side: `reason_text` and
 * `model_version` come back as `null`, and `classified_by` is
 * coarsened to `internal:human` / `internal:model` / `internal:rule`.
 * This component renders those coarse tokens cleanly — partners
 * never see a `user:` attribution.
 */
"use client";

import { History, User as UserIcon, Bot, BookCheck, CircleHelp } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { formatSupergroupCode } from "@/lib/cases";
import { formatTimestamp } from "@/lib/format";
import type {
  ClassificationHistoryEntry,
  ClassifierType,
} from "@/types/exceptions";


export interface ClassificationHistoryPanelProps {
  entries: readonly ClassificationHistoryEntry[];
  loading?: boolean;
  error?: string | null;
}

const CLASSIFIER_ICON: Record<ClassifierType, React.ReactNode> = {
  HUMAN: <UserIcon size={12} aria-hidden />,
  MODEL: <Bot size={12} aria-hidden />,
  RULE: <BookCheck size={12} aria-hidden />,
};

const CLASSIFIER_VARIANT: Record<
  ClassifierType,
  "info" | "brand" | "neutral"
> = {
  HUMAN: "info",
  MODEL: "brand",
  RULE: "neutral",
};

/* Forward-compat fallbacks: a classifier_type the UI enum doesn't yet know
 * (a new backend actor class) still renders a neutral badge + icon rather
 * than a blank variant/empty icon — mirrors the verdictVariant default. */
function classifierIcon(type: ClassifierType): React.ReactNode {
  return CLASSIFIER_ICON[type] ?? <CircleHelp size={12} aria-hidden />;
}

function classifierVariant(type: ClassifierType): "info" | "brand" | "neutral" {
  return CLASSIFIER_VARIANT[type] ?? "neutral";
}

/**
 * Coarse partner tokens are `internal:human` / `internal:model` /
 * `internal:rule`; full operator attributions look like
 * `user:alice@acme.com`. We strip the prefix in both cases so the
 * row reads cleanly while keeping the actor class on the badge.
 */
function classifiedByLabel(classified_by: string): string {
  if (classified_by.startsWith("internal:")) {
    const tail = classified_by.slice("internal:".length);
    return `internal ${tail}`;
  }
  if (classified_by.startsWith("user:")) {
    return classified_by.slice("user:".length);
  }
  return classified_by;
}

export function ClassificationHistoryPanel({
  entries,
  loading = false,
  error = null,
}: ClassificationHistoryPanelProps) {
  if (loading) {
    return (
      <section
        aria-label="Classification history"
        className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
      >
        <div role="status" aria-live="polite" className="text-text-tertiary">
          Loading classification history…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        aria-label="Classification history"
        className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
      >
        <div role="alert" className="text-error">{error}</div>
      </section>
    );
  }

  // Guardrail #6 — render nothing when the trail is empty.
  if (entries.length === 0) return null;

  return (
    <section
      aria-label="Classification history"
      className="bg-surface-primary border border-border rounded-md p-16 shadow-xs"
    >
      <div className="flex items-center gap-8 mb-12">
        <History size={16} aria-hidden className="text-text-secondary" />
        <h2 className="text-heading font-semibold text-text-primary m-0">
          Classification history
        </h2>
        <span className="ml-auto text-caption text-text-tertiary">
          {entries.length}
        </span>
      </div>
      <ol className="m-0 p-0 list-none flex flex-col gap-12">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-4 border-l-2 border-border-subtle pl-12"
          >
            <div className="flex flex-wrap items-center gap-8">
              <Badge
                variant={classifierVariant(e.classifier_type)}
                size="sm"
                icon={classifierIcon(e.classifier_type)}
              >
                <span className="ml-4">{e.classifier_type}</span>
              </Badge>
              <code
                className="font-mono text-caption text-text-primary"
                title={e.supergroup_code}
              >
                {formatSupergroupCode(e.supergroup_code)}
              </code>
              {e.intent_code && (
                <>
                  <span aria-hidden className="text-text-quaternary">
                    ·
                  </span>
                  <code className="font-mono text-caption text-text-secondary">
                    {e.intent_code}
                  </code>
                </>
              )}
              <span className="ml-auto text-caption text-text-tertiary">
                {/* Human-readable label; raw ISO kept in `dateTime` for
                    machine/audit fidelity (was rendering the raw ISO string). */}
                <time dateTime={e.classified_at}>
                  {formatTimestamp(e.classified_at)}
                </time>
              </span>
            </div>
            <div className="text-caption text-text-tertiary">
              {classifiedByLabel(e.classified_by)}
              {e.model_version && (
                <>
                  <span aria-hidden className="text-text-quaternary mx-4">
                    ·
                  </span>
                  <span>model {e.model_version}</span>
                </>
              )}
              <span aria-hidden className="text-text-quaternary mx-4">·</span>
              <span>taxonomy {e.taxonomy_version}</span>
            </div>
            {e.reason_text && (
              <p className="text-body text-text-primary m-0">
                {e.reason_text}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
