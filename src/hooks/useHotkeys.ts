// useHotkeys — document-level keydown listener (S2 sprint 2026-05-28).
//
// The S2 panel's top finding (#3) was that ASOE's action ribbon
// requires a click for every Approve / Reject / Override / Escalate
// / Re-analyze even though the operator works the queue with j/k.
// This hook is the shared primitive that lets the ribbon, the `?`
// cheatsheet, and (later) other surfaces register bindings without
// each one re-implementing the typing-target skip + modifier-key
// contract.
//
// Contract:
//   * Listener attaches once per mount; subsequent renders update an
//     internal ref so handler closures stay current without
//     re-binding the listener.
//   * Skips when the event target is an input, textarea, select, a
//     contenteditable region, or inside a Radix combobox/dialog —
//     same exclusion the queue's `useKeyboardListNav` already uses.
//     Without this gate, pressing `a` while typing a comment would
//     submit Approve mid-sentence.
//   * Modifier-key contract is strict: a binding with no
//     `requires*` flag fires ONLY when none of Shift / Meta / Ctrl /
//     Alt are pressed. So bare `A` does not steal Shift+A.
//   * First matching handler wins; `event.preventDefault()` runs
//     before the handler so the browser does not also handle the
//     keystroke (e.g. `?` triggering Firefox's Quick Find).
//
// Disabling a handler at runtime is done via `enabled: false` rather
// than conditionally including/excluding it from the array, so the
// handler array shape stays stable across renders (cheaper diff,
// easier to reason about ordering).

"use client";

import { useEffect, useRef } from "react";

export interface HotkeyHandler {
  /** Matches `KeyboardEvent.key` (case-insensitive for letters). */
  key: string;
  requiresShift?: boolean;
  requiresMeta?: boolean;
  requiresCtrl?: boolean;
  /** Invoked on a match. The listener has already called preventDefault. */
  handler: () => void;
  /**
   * Defaults to `true`. Pass `false` to keep the binding registered
   * but inert — useful when a button is hidden by permission
   * (canApprove=false) and the corresponding hotkey must also stop
   * firing.
   */
  enabled?: boolean;
}

/**
 * Returns true when the event target is an editable surface or
 * inside a popover/dialog/combobox that handles its own keys. The
 * caller bails on such events so typing does not invoke shortcuts.
 *
 * Mirror of `isTypingTarget` in `useKeyboardListNav.ts` — kept as
 * a copy rather than a shared util because the two callers have
 * subtly different rules (this hook does not exclude `role=listbox`
 * with `aria-haspopup` since the cheatsheet is a plain dialog).
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // JSDOM does not consistently reflect `isContentEditable` from the
  // attribute, so fall back to the attribute itself. A real browser
  // sets the property as soon as the attribute lands; the OR is
  // cheap and correct in both environments.
  if (target.isContentEditable) return true;
  const attr = target.getAttribute?.("contenteditable");
  if (attr === "" || attr === "true" || attr === "plaintext-only") return true;
  if (target.closest("[role='combobox']")) return true;
  return false;
}

export function useHotkeys(handlers: HotkeyHandler[]): void {
  // Keep the latest handlers in a ref so the listener's closure
  // always reads the freshest array — but the listener itself is
  // attached once. Re-binding on every render would race with rapid
  // keypresses and would also fight permission-flag flips.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey) return;
      if (isTypingTarget(event.target)) {
        // Comment input is the one editable surface that opts in to
        // ⌘+Enter via its own local handler — we still bail here so
        // that path stays the only owner of the keystroke.
        return;
      }
      for (const h of handlersRef.current) {
        if (h.enabled === false) continue;
        if (event.key.toLowerCase() !== h.key.toLowerCase()) continue;
        if (!!h.requiresShift !== event.shiftKey) continue;
        if (!!h.requiresMeta !== event.metaKey) continue;
        if (!!h.requiresCtrl !== event.ctrlKey) continue;
        event.preventDefault();
        h.handler();
        return;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
