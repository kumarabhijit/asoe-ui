// usePrefersReducedMotion — reactive `prefers-reduced-motion` state.
//
// Reading `window.matchMedia(...).matches` once (e.g. inside a `useMemo`)
// snapshots the setting at mount and never updates if the user toggles the
// OS reduced-motion preference afterwards. This hook subscribes to the
// media query's `change` event so dependent UI (e.g. WaterfallStepper's
// replay gate) stays live. SSR-safe: returns `false` until mounted.

"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
