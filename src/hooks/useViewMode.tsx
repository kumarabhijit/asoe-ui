/**
 * useViewMode — in-UI Legacy / Modern view preference.
 *
 * The "Modern" view is the agent-first decision cockpit (confidence
 * ring on the Recommendation, the Agent Activity rail, the situation
 * hero); "Legacy" is the established layout. Both render the SAME data
 * through the SAME fetch / RBAC / action paths — the cockpit is a
 * presentational recomposition (Guardrail #6/#7), so which one shows is
 * a client preference, exactly like the Light/Dark theme picker.
 *
 * Persistence mirrors next-themes: the choice is stored in
 * localStorage and survives reloads. The `NEXT_PUBLIC_COCKPIT` env var
 * (via `cockpitEnabled()`) is kept as the *default seed* only — it sets
 * the org-wide default for a user who has never touched the toggle, so
 * Vercel can still flip the default without a code change. A stored
 * per-user choice always wins over the env default.
 *
 * Hydration: unlike theme (a single <html> class), Legacy vs Modern
 * differ *structurally*, so a naive read of localStorage during render
 * would risk an SSR/client mismatch. We therefore render the env
 * default on the server and the first client paint (when `mounted` is
 * false), then apply any stored override after mount. A user whose
 * saved choice differs from the env default sees a one-frame flash on
 * first load — the standard, accepted trade-off for a preference-driven
 * layout.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cockpitEnabled } from "@/lib/flags";

export type ViewMode = "legacy" | "modern";

const STORAGE_KEY = "asoe.view-mode";

function isViewMode(v: unknown): v is ViewMode {
  return v === "legacy" || v === "modern";
}

interface ViewModeContextValue {
  /** The mode to render right now (env default until mounted, then any stored override). */
  mode: ViewMode;
  /** Persist a new preference and re-render. */
  setMode: (mode: ViewMode) => void;
  /** False during SSR / first client paint; true after the mount effect runs. */
  mounted: boolean;
  /** The env-seeded default for a user with no stored preference. */
  defaultMode: ViewMode;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

/** The org-wide default: Modern only when NEXT_PUBLIC_COCKPIT is explicitly on. */
function envDefaultMode(): ViewMode {
  return cockpitEnabled() ? "modern" : "legacy";
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const defaultMode = envDefaultMode();
  const [stored, setStored] = useState<ViewMode | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isViewMode(saved)) setStored(saved);
    } catch {
      // localStorage unavailable (private mode, SSR snapshot) — fall
      // back to the env default. No persistence, no crash.
    }
  }, []);

  const setMode = useCallback((next: ViewMode) => {
    setStored(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence; the in-session choice still applies.
    }
  }, []);

  const value = useMemo<ViewModeContextValue>(
    () => ({
      mode: mounted ? (stored ?? defaultMode) : defaultMode,
      setMode,
      mounted,
      defaultMode,
    }),
    [mounted, stored, defaultMode, setMode],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

/**
 * Read the current view mode. Outside a `ViewModeProvider` (e.g. an
 * isolated unit test that mounts a page in isolation) this resolves to
 * the env default with no persistence — matching the pre-toggle
 * behaviour, so existing locks/specs that mount these surfaces without
 * the provider stay green.
 */
export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (ctx) return ctx;
  const defaultMode = envDefaultMode();
  return { mode: defaultMode, setMode: () => {}, mounted: false, defaultMode };
}
