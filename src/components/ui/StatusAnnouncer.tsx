/**
 * StatusAnnouncer — single canonical aria-live region for the app.
 *
 * Decision Q1 (docs/test-strategy/e2e-flow-plan.md):
 *   asoe-ui exposes ONE <StatusAnnouncer> used everywhere a
 *   status-change announcement is emitted. Stable testid
 *   `data-testid="status-announcer"`, aria-live="polite". Flow
 *   YAML asserts:
 *
 *     - assert_announcement_text: "Exception resolved"
 *
 *   The runner translates that to: wait for the announcer to
 *   contain the text. One enforcement point; one selector; no
 *   per-section drift.
 *
 * Why this lives next to <Toast> rather than inside it:
 *   - Toasts are visual surfaces with auto-dismiss; an a11y
 *     announcement should fire even when the operator has
 *     toasts disabled or off-screen.
 *   - SOX-relevant status transitions ("Exception resolved",
 *     "Approval recorded") must be observable to a screen reader
 *     regardless of any Toast variant choice.
 *   - The runner's selector is route-stable: it lives at the
 *     application root, never inside a transient subtree.
 *
 * Debouncing: rapid `announce()` calls inside a single tick
 * collapse to the last one — assistive tech doesn't replay every
 * intermediate state, and emitting them all triggers screen-reader
 * spam. We wait one microtask, take the most recent text, and
 * commit. Tests assert this collapse.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface StatusAnnouncerContextValue {
  announce: (message: string) => void;
}

const StatusAnnouncerContext = createContext<StatusAnnouncerContextValue>({
  announce: () => {
    // No-op when used outside provider — components can `useStatusAnnouncer`
    // unconditionally without forcing every test to wrap a provider.
  },
});

export function useStatusAnnouncer(): StatusAnnouncerContextValue {
  return useContext(StatusAnnouncerContext);
}

export interface StatusAnnouncerProps {
  /** Optional initial text. Useful only for SSR/test seed. */
  initialMessage?: string;
  children?: ReactNode;
}

export function StatusAnnouncer({ initialMessage = "", children }: StatusAnnouncerProps) {
  const [message, setMessage] = useState<string>(initialMessage);
  const pendingRef = useRef<string | null>(null);
  const flushedRef = useRef<boolean>(true);

  const announce = useCallback((next: string) => {
    pendingRef.current = next;
    if (!flushedRef.current) return;
    flushedRef.current = false;
    queueMicrotask(() => {
      const value = pendingRef.current;
      pendingRef.current = null;
      flushedRef.current = true;
      if (value !== null) setMessage(value);
    });
  }, []);

  // If the provider unmounts while a flush is queued, drop the
  // pending value rather than committing onto a dead state setter.
  useEffect(() => {
    return () => {
      pendingRef.current = null;
      flushedRef.current = true;
    };
  }, []);

  return (
    <StatusAnnouncerContext.Provider value={{ announce }}>
      {/*
        aria-live="polite"  — speak after current utterance, not interrupting.
        aria-atomic="true"  — replay the whole text on each change.
        role="status"       — extra hint for older AT.
        sr-only             — visually hidden but available to screen readers.
                              The visual surface for the same status change
                              is the Toast; this element is a pure a11y peer.
      */}
      <div
        data-testid="status-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {message}
      </div>
      {children}
    </StatusAnnouncerContext.Provider>
  );
}
