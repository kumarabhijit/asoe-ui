/**
 * usePaneFocusCycle — move keyboard focus between the panes of a
 * multi-pane workspace with F6 / Shift+F6.
 *
 * The `/cases` workspace is a three-pane master-detail surface (queue
 * | record list | case detail). Tab walks through the controls WITHIN
 * the focused pane; F6 is the canonical "jump to the next pane / region"
 * shortcut (the WAI-ARIA pattern browsers and IDEs use), so an operator
 * can cross the workspace without tabbing through every row.
 *
 * Contract:
 *   * `refs` is the ordered list of pane focus targets (the queue
 *     listbox, the record-list radiogroup, the detail section…). Each
 *     must be focusable (`tabIndex` 0 or -1).
 *   * Only VISIBLE panes participate — a ref whose element is
 *     `display:none` (e.g. the record-list column collapsed below the
 *     `xl` breakpoint) is skipped, so the cycle adapts to the current
 *     responsive layout.
 *   * F6 moves to the next pane, Shift+F6 to the previous, wrapping
 *     around. When focus isn't in any pane yet, F6 lands on the first.
 *
 * Document-level listener so it works wherever focus currently is. It
 * bails inside a text field / open dialog so F6 in a textarea or modal
 * keeps its native meaning.
 */
"use client";

import { useEffect, type RefObject } from "react";

function isTextEntryOrDialog(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[role='dialog']")) return true;
  return false;
}

/** An element counts as a live pane target if it's mounted AND laid out
 *  (display:none ancestors zero out offsetParent). */
function isVisible(el: HTMLElement | null): el is HTMLElement {
  return !!el && el.offsetParent !== null;
}

export function usePaneFocusCycle(
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "F6") return;
      if (isTextEntryOrDialog(event.target)) return;

      const panes = refs
        .map((r) => r.current)
        .filter(isVisible);
      if (panes.length === 0) return;

      event.preventDefault();
      const active = document.activeElement;
      const currentIdx = panes.findIndex(
        (p) => p === active || p.contains(active),
      );
      const delta = event.shiftKey ? -1 : 1;
      const nextIdx =
        currentIdx === -1
          ? 0
          : (currentIdx + delta + panes.length) % panes.length;
      panes[nextIdx].focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [refs, enabled]);
}
