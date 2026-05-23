/**
 * useKeyboardListNav — keyboard navigation for a single-select list
 * (Phase 28.5.x §D5).
 *
 * Wires the canonical ArrowUp / ArrowDown / j / k / Home / End
 * keyboard contract onto a vertical list of items. Consumed by the
 * `/cases` queue listbox (`src/app/cases/page.tsx`), which renders
 * `role="listbox"` with each row `role="option"` so a screen reader
 * announces the selection move; the hook drives the focus /
 * selection state.
 *
 * Contract:
 *   * `items` is the rendered sorted list (the hook does NOT sort).
 *   * `getId(item)` extracts the row's stable id (case_id /
 *     exception_id). The id is the value stored in
 *     `selectedId` so the consuming page can also flow the same
 *     id through a router query param or saved-view storage.
 *   * `selectedId` / `onSelect` are the controlled selection
 *     surface. The hook never holds local state; the page owns the
 *     `useState`.
 *   * `containerRef` is the `role="listbox"` DOM node that wraps
 *     every row. On a selection move the hook `scrollIntoView`s the
 *     newly-active row AND anchors DOM focus on the CONTAINER — not
 *     the row. The container is the single Tab stop and a stable
 *     focus target; the active row is announced through the
 *     listbox's `aria-activedescendant`. Focusing the row instead
 *     would make every row a Tab stop and drop focus to `<body>`
 *     whenever a filter / refetch unmounted the focused row. So
 *     consumers MUST wire `aria-activedescendant` on the container
 *     and render options with `tabIndex={-1}`.
 *   * Each row has `data-keyboard-nav-id={getId(item)}` so
 *     scrollIntoView can find it by attribute query without the
 *     hook caring about which element type renders the row.
 *
 * The handler binds at the document level so the keys work
 * whenever the page is focused — not only when a row has focus
 * — matching the Outlook inbox behaviour. It bails when the
 * user is typing in an input / select / contenteditable or when
 * a Radix popover/dialog is open. Modifier-key combinations
 * (Cmd+ArrowDown = scroll to top, Cmd+K = command palette)
 * belong to the browser/OS and are not hijacked.
 */
"use client";

import { useEffect, type RefObject } from "react";

export interface UseKeyboardListNavOptions<T> {
  /** Rendered, sorted list of items. */
  items: readonly T[];
  /** Extract the stable id used as the selection key. */
  getId: (item: T) => string;
  /** Controlled selection — the currently-selected id (or null). */
  selectedId: string | null;
  /**
   * Selection setter. Called with the new id when the user
   * presses an arrow / j / k / Home / End key.
   */
  onSelect: (id: string) => void;
  /**
   * Ref to the listbox container DOM node. Used for the
   * scrollIntoView call after a selection move so the newly-
   * selected row stays in the visible viewport.
   */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * Disable the hook entirely (e.g., when the page is loading
   * the initial list and there's nothing to navigate yet).
   */
  enabled?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  // Don't hijack keys while a Radix popover / dialog / combobox is
  // open — those widgets handle their own arrow-key semantics.
  if (target.closest("[role='combobox'], [role='dialog'], [role='listbox'][aria-haspopup]")) {
    return true;
  }
  return false;
}

export function useKeyboardListNav<T>({
  items,
  getId,
  selectedId,
  onSelect,
  containerRef,
  enabled = true,
}: UseKeyboardListNavOptions<T>): void {
  useEffect(() => {
    if (!enabled || items.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const ids = items.map(getId);
      const idx = selectedId ? ids.indexOf(selectedId) : -1;
      let next = idx;

      switch (event.key) {
        case "ArrowDown":
        case "j":
          next = idx < 0 ? 0 : Math.min(idx + 1, ids.length - 1);
          break;
        case "ArrowUp":
        case "k":
          next = idx < 0 ? 0 : Math.max(idx - 1, 0);
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

      if (next === idx) return;
      event.preventDefault();
      const nextId = ids[next];
      onSelect(nextId);

      // Scroll the newly-selected row into view in the next frame
      // so it's actually paint-committed before scrollIntoView
      // measures the target's geometry. The `requestAnimationFrame`
      // matches the Outlook-inbox behaviour the V5.0
      // ExceptionListPane shipped.
      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        // Anchor DOM focus on the listbox CONTAINER, not the row.
        // The container is the single Tab stop and a stable focus
        // target; the active row is announced through the listbox's
        // `aria-activedescendant`. Focusing the row instead made every
        // row a Tab stop AND lost focus to <body> whenever a filter
        // change or silent refetch unmounted the focused row. Anchoring
        // on the container keeps keyboard nav alive across those churns.
        container.focus({ preventScroll: true });
        const el = container.querySelector<HTMLElement>(
          `[data-keyboard-nav-id="${CSS.escape(nextId)}"]`,
        );
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [items, getId, selectedId, onSelect, containerRef, enabled]);
}
