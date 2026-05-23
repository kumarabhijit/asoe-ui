// RecordListPane — middle column of the `/cases` three-pane workspace
// (ADR-041 P3d-remaining, 2026-05-14).
//
// Lifted out of `CaseDetailPanel.tsx` as a standalone pane so the
// queue / record-list / record-detail columns can layout
// independently. The UX architect's three-pane recommendation
// (cases-workspace-case-switch panel review) was deferred to P3d
// when the two-pane workspace shipped; this is its second half.
//
// Architecturally:
//   * Pure projector (Guardrail #6) — `records` is consumed as
//     given; no client-side composition, no fallback chains.
//   * Auto-mount: single-record cases call onSelectRecord on first
//     paint so the right-pane ribbon mounts without a click. The
//     URL `?record=<id>` is the source of truth; the parent page
//     reflects the URL via `selectedRecordId`.
//   * Pin-selection (mirror of the queue's pin-selection guard):
//     when an agent mutation flips the selected record's state
//     such that a future filter would exclude it, the row stays
//     visible. Today there's no record-list filter so the guard is
//     a no-op — when filters arrive (P3e) the prop will be wired.

"use client";

import { useRef, type KeyboardEvent, type RefObject } from "react";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import type { ExceptionDetailResponse } from "@/types/api";

export interface RecordListPaneProps {
  /** Parent case id — surfaced in the pane copy so the operator
   *  sees which case they're acting on when the case header is
   *  collapsed (slim context strip variant). */
  caseId: string;
  /** Records attached to the parent case. Empty array hides the
   *  pane entirely — the page-level layout collapses the column
   *  in that state (Guardrail #6 — no "no records" placeholder). */
  records: readonly ExceptionDetailResponse[];
  /** Selected record id from the URL. */
  selectedRecordId?: string;
  /** Click handler — flips selection AND the URL `?record=` query. */
  onSelectRecord?: (recordId: string) => void;
  /** Optional ref to the radiogroup `<ul>` so a parent can treat the
   *  pane as a focus target (e.g. F6 pane cycling). */
  groupRef?: RefObject<HTMLUListElement | null>;
}

// Single-record auto-mount lives in `CaseDetailPanel.tsx` (the
// consumer that actually needs the selection to render the
// ribbon). RecordListPane is a pure renderer — it shows what the
// page tells it to and reflects selection clicks back via
// `onSelectRecord`. Keeping the effect in one place avoids
// double-firing when the workspace mounts both panes.

export function RecordListPane({
  caseId,
  records,
  selectedRecordId,
  onSelectRecord,
  groupRef,
}: RecordListPaneProps) {
  const internalRef = useRef<HTMLUListElement | null>(null);
  const listRef = groupRef ?? internalRef;

  if (records.length === 0) return null;

  const ids = records.map((r) => r.id);
  const selectedIdx = selectedRecordId ? ids.indexOf(selectedRecordId) : -1;
  // Roving tabindex (APG radiogroup): exactly ONE radio is in the Tab
  // order — the selected one, or the first when nothing is selected
  // yet. This makes the whole pane a single Tab stop, so Tab moves
  // cleanly to the next pane instead of walking every record row.
  const rovingIdx = selectedIdx >= 0 ? selectedIdx : 0;

  // Local keydown (not a document listener) so only the FOCUSED
  // instance reacts — the page mounts this pane twice (the dedicated
  // xl column + the inline picker inside CaseDetailPanel; one is
  // display:none per breakpoint) and a document listener would
  // double-fire across both.
  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    // Match the queue's useKeyboardListNav contract: when nothing is
    // selected yet, the first Arrow/j/k press lands on the FIRST row.
    let next = selectedIdx;
    switch (event.key) {
      case "ArrowDown":
      case "j":
        next = selectedIdx < 0 ? 0 : Math.min(selectedIdx + 1, ids.length - 1);
        break;
      case "ArrowUp":
      case "k":
        next = selectedIdx < 0 ? 0 : Math.max(selectedIdx - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = ids.length - 1;
        break;
      default:
        return;
    }
    if (next === selectedIdx) return;
    event.preventDefault();
    const nextId = ids[next];
    if (nextId !== selectedRecordId) onSelectRecord?.(nextId);
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(
        `[data-keyboard-nav-id="${CSS.escape(nextId)}"]`,
      );
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    });
  }

  return (
    <aside
      aria-label="Attached records"
      className="bg-surface-primary border border-border rounded-md shadow-xs flex flex-col min-h-0"
    >
      <div className="p-16 border-b border-border-subtle">
        <h2 className="text-heading font-semibold text-text-primary m-0 mb-4">
          Attached records
        </h2>
        <p className="text-caption text-text-tertiary leading-normal">
          {records.length === 1
            ? "Single record attached — auto-mounted on the right."
            : `${records.length} records attached to `}
          {records.length > 1 && (
            <code className="font-mono">{caseId}</code>
          )}
          {records.length > 1 ? ". Pick one to act on." : null}
        </p>
      </div>

      <ul
        ref={listRef}
        role="radiogroup"
        aria-label="Select a record to act on"
        onKeyDown={onKeyDown}
        // tabIndex=-1 keeps the group OUT of the Tab order (the roving
        // radio is the Tab stop) while letting F6 pane-cycling land
        // focus on the group programmatically; arrow keys then move the
        // selection from here.
        tabIndex={-1}
        className="m-0 p-0 list-none divide-y divide-border-subtle flex-1 overflow-y-auto rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring"
      >
        {records.map((record, idx) => {
          const isSelected = record.id === selectedRecordId;
          return (
            <li key={record.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                // Roving tabindex — only the active row is tabbable.
                tabIndex={idx === rovingIdx ? 0 : -1}
                onClick={() => onSelectRecord?.(record.id)}
                data-testid={`record-picker-row-${record.id}`}
                data-keyboard-nav-id={record.id}
                className={[
                  "w-full flex items-center gap-12 py-12 px-16 text-left",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-ring",
                  isSelected
                    ? "bg-surface-row-active"
                    : "hover:bg-surface-secondary",
                ].join(" ")}
              >
                <Badge variant={isSelected ? "info" : "neutral"} size="sm">
                  {record.intent ?? "UNCLASSIFIED"}
                </Badge>
                <span className="font-mono text-body text-text-primary truncate">
                  {record.order_id ?? record.id}
                </span>
                <span className="ml-auto text-caption text-text-tertiary">
                  {record.lifecycle_state}
                </span>
                <ChevronRight
                  size={14}
                  aria-hidden
                  className="text-text-tertiary shrink-0"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
