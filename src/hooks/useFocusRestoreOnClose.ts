// useFocusRestoreOnClose — restore focus to the previously focused
// element when a transient surface (dialog, popover, overlay)
// closes.
//
// S3 sprint 2026-05-29 finding #C. Radix Dialog already restores
// focus to the element that had focus when the dialog opened —
// that covers `OverrideChooserDialog`. Two surfaces in this app
// are custom `role="dialog"` divs that bypass Radix entirely (the
// `?` cheatsheet and the comment swap inside `ActionButtonMatrix`)
// — when those close, focus drops to `<body>` and keyboard users
// lose their place. This hook is the small shared primitive that
// closes the gap for both.
//
// Contract:
//   * Capture `document.activeElement` synchronously on every
//     transition from `open=false` to `open=true`.
//   * On the transition back to `open=false`, schedule the
//     `.focus()` restore in `requestAnimationFrame` so any focus
//     trap or commit inside the just-unmounted surface has
//     finished before we steal focus back.
//   * Re-opening clears the previous capture so a back-to-back
//     open/close sequence does not point at a stale element.
//
// The hook returns nothing — it is a side effect on top of the
// caller's existing `open` state.

"use client";

import { useEffect, useRef } from "react";

export function useFocusRestoreOnClose(open: boolean): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  // The capture has to happen DURING render on the transition from
  // closed → open. By the time `useEffect` runs, the surface has
  // mounted and its `autoFocus` / focus trap has already moved
  // `document.activeElement` into the dialog — restoring to that
  // value would steal focus into the unmounted dialog on close.
  // Writing a ref during render is one of the React-blessed
  // "compare to previous value" patterns; the read of
  // `document.activeElement` is a pure DOM observation.
  if (typeof document !== "undefined" && open && !wasOpenRef.current) {
    const active = document.activeElement;
    previouslyFocusedRef.current =
      active instanceof HTMLElement && active !== document.body
        ? active
        : null;
    wasOpenRef.current = true;
  }

  useEffect(() => {
    if (open) return;
    // Just closed — restore focus if we captured anything.
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const target = previouslyFocusedRef.current;
    previouslyFocusedRef.current = null;
    if (!target) return;
    // `requestAnimationFrame` runs after the surface's unmount +
    // any focus-trap cleanup. Restoring inside the effect would
    // let the focus trap immediately steal it back.
    const id = requestAnimationFrame(() => {
      // The element may have unmounted between close and the next
      // frame (route change, parent re-render). Guard so the
      // restore is a no-op rather than a crash.
      if (document.body.contains(target)) {
        target.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open]);
}
