// Hotkey registry — single source of truth (S2 sprint 2026-05-28).
//
// Both `useHotkeys` (the document-level listener hook) and
// `HotkeyCheatsheet` (the `?` overlay that lists the bindings) read
// from this file. A maintainer adding a new binding edits one row
// here and the listener + cheatsheet pick it up — no parallel
// changes in three different components.
//
// Why a static registry instead of a runtime context:
//   * The bindings are fixed (not user-rebindable in this phase).
//   * The architectural lock at
//     `tests/architectural/s2_hotkey_registry_lock.test.ts` greps
//     this file as the authoritative list — a runtime context
//     could not be checked at lint-time.
//
// Conventions:
//   * `key` matches `KeyboardEvent.key` (case-sensitive at runtime
//     for letters; the listener lower-cases before comparing).
//   * `requires*` flags model the modifier-key contract; when a
//     flag is undefined the listener requires the modifier to be
//     off (so bare `A` does not fire on Shift+A — that would steal
//     the operator's capital-letter typing).
//   * `scope` groups bindings in the cheatsheet UI. It does not
//     gate the listener (the listener's gating is done by the
//     consumer through `enabled`); it is presentation only.

export type HotkeyScope =
  | "global"
  | "queue"
  | "picker"
  | "ribbon"
  | "comment";

export interface Hotkey {
  /** Stable id for the architectural-lock grep. */
  id: string;
  /**
   * The `KeyboardEvent.key` value. For letter keys, lower-case;
   * the listener performs a case-insensitive compare so the
   * registry stays canonical.
   */
  key: string;
  /** Display label rendered in the cheatsheet (e.g. "A", "⌘↵"). */
  label: string;
  /** One-line description shown next to the label. */
  description: string;
  scope: HotkeyScope;
  requiresShift?: boolean;
  requiresMeta?: boolean;
  requiresCtrl?: boolean;
}

export const HOTKEYS: readonly Hotkey[] = [
  // Global ----------------------------------------------------------
  {
    id: "global.cheatsheet",
    key: "?",
    label: "?",
    description: "Show keyboard shortcuts",
    scope: "global",
    requiresShift: true,
  },
  {
    id: "global.pane.next",
    key: "F6",
    label: "F6",
    description: "Cycle to next pane",
    scope: "global",
  },
  {
    id: "global.pane.prev",
    key: "F6",
    label: "Shift+F6",
    description: "Cycle to previous pane",
    scope: "global",
    requiresShift: true,
  },

  // Queue (case listbox) --------------------------------------------
  {
    id: "queue.next",
    key: "ArrowDown",
    label: "↓ / j",
    description: "Next case",
    scope: "queue",
  },
  {
    id: "queue.prev",
    key: "ArrowUp",
    label: "↑ / k",
    description: "Previous case",
    scope: "queue",
  },
  {
    id: "queue.first",
    key: "Home",
    label: "Home",
    description: "First case",
    scope: "queue",
  },
  {
    id: "queue.last",
    key: "End",
    label: "End",
    description: "Last case",
    scope: "queue",
  },

  // Record picker ---------------------------------------------------
  {
    id: "picker.next",
    key: "ArrowDown",
    label: "↓ / j",
    description: "Next attached record",
    scope: "picker",
  },
  {
    id: "picker.prev",
    key: "ArrowUp",
    label: "↑ / k",
    description: "Previous attached record",
    scope: "picker",
  },

  // Action ribbon ---------------------------------------------------
  {
    id: "ribbon.approve",
    key: "a",
    label: "A",
    description: "Approve",
    scope: "ribbon",
  },
  {
    id: "ribbon.reject",
    key: "r",
    label: "R",
    description: "Reject",
    scope: "ribbon",
  },
  {
    id: "ribbon.override",
    key: "o",
    label: "O",
    description: "Override…",
    scope: "ribbon",
  },
  {
    id: "ribbon.escalate",
    key: "e",
    label: "E",
    description: "Escalate",
    scope: "ribbon",
  },
  {
    id: "ribbon.reanalyze",
    key: "y",
    label: "Y",
    description: "Re-analyze",
    scope: "ribbon",
  },

  // Comment dialog --------------------------------------------------
  {
    id: "comment.submit",
    key: "Enter",
    label: "⌘↵",
    description: "Submit action",
    scope: "comment",
    requiresMeta: true,
  },
  {
    id: "comment.cancel",
    key: "Escape",
    label: "Esc",
    description: "Cancel and discard",
    scope: "comment",
  },
] as const;

/** Lookup by id — useful for narrow consumers (`getHotkey("ribbon.approve")`). */
export function getHotkey(id: string): Hotkey | undefined {
  return HOTKEYS.find((h) => h.id === id);
}

export const HOTKEY_SCOPE_LABEL: Record<HotkeyScope, string> = {
  global: "Anywhere",
  queue: "Case queue",
  picker: "Record picker",
  ribbon: "Action ribbon",
  comment: "Comment input",
};
