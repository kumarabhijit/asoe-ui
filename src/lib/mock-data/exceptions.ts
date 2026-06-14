// Mock ExceptionSummary fixtures.
//
// Extracted from `src/lib/api.ts` in ADR-041 P5. Every entry is
// post-mutated below with `parent_case_id = \`case-for-${id}\`` so
// the case-centric pivot's "every record has a parent case"
// invariant holds in mock mode (mirrors asoe2's S15a
// `should_materialise() -> True`). The mutation lives in this
// file's module scope so any consumer importing MOCK_EXCEPTIONS
// always sees the wired-up form.
//
// See `tests/architectural/case_pivot_mock_wiring.test.ts` for the
// lock that asserts this invariant end-to-end.

import type { ExceptionSummary } from "@/types/exceptions";

import { CATALOG_EXCEPTIONS } from "./__generated__/scenario_catalog";

// PARITY FLIP (Step 3): the served queue is the catalog-generated
// CATALOG_EXCEPTIONS (projected from asoe2/fixtures/scenarios/catalog.yaml
// via scripts/gen-mock-data.ts), not a hand-authored list — so the Vercel
// mock mirrors the cases the backend sandbox bootstrap creates from the same
// catalog. Each row is shallow-cloned so the in-place lifecycle mutations
// (disposition / escalate / cosign in src/lib/api.ts) and the reset/overlay
// machinery below operate on independent objects, never the generated const.
export const MOCK_EXCEPTIONS: ExceptionSummary[] = CATALOG_EXCEPTIONS.map(
  (e) => ({ ...e }),
);

// S15a — every record is attached to a case. Mirror asoe2's
// `materialise every record` invariant (api/case_resolver.py
// `should_materialise() -> True`) so the mock data layer behaves
// like the live backend: every exception carries a `parent_case_id`,
// and `casesApi.getRecords(parent_case_id).items` is non-empty.
// Pre-S15a only events used the `case-for-${id}` naming; aligning
// the records here closes the gap that left `/cases/[id]?record=…`
// rendering only the case header (the picker had no rows, so the
// inline ExceptionDetailPanel — and with it AgentReasoningCard,
// the HITL action ribbon, and DiagnosticsSection — never mounted).
//
// Multi-issue fixtures (exc-027..exc-033) set an explicit shared
// `parent_case_id` at construction time so multiple records resolve
// onto one OrderCase. The mutation below only fills the default for
// rows that did not declare one, preserving the multi-record wiring.
MOCK_EXCEPTIONS.forEach((e) => {
  if (!e.parent_case_id) {
    e.parent_case_id = `case-for-${e.id}`;
  }
});

// Snapshot the initial fixture state AFTER the parent_case_id
// mutation lands so `resetMockExceptions()` restores rows in their
// canonical wired-up form. The clones are frozen-equivalent: we
// JSON-roundtrip on snapshot capture so a later mutation on a
// MOCK_EXCEPTIONS row never leaks back into the snapshot, and we
// JSON-roundtrip again on every reset so callers don't end up
// sharing object identity with the snapshot. (Structured clone is
// the natural fit, but it isn't available in jsdom's older
// environments that some legacy tests pin.)
const _INITIAL_MOCK_EXCEPTIONS: ReadonlyArray<ExceptionSummary> = JSON.parse(
  JSON.stringify(MOCK_EXCEPTIONS),
);

/* ── Reload-resilient mock mutations ───────────────────────────────────
   The mock action paths (`disposition` / `escalate` / `cosign` in
   src/lib/api.ts) mutate the in-memory MOCK_EXCEPTIONS row so the
   queue / case header / `/home` tiles reflect the action. That works
   within a single browser session, but the array re-initialises to
   seed on every full page load — so on the Vercel mock preview an
   operator who Approved/Overrode a record, then RELOADED (or opened
   `/home` in a fresh tab), saw the record snap back to "Awaiting
   review". Backend state and UI drifted again, just across a reload
   instead of across a pane.

   The fix is a small localStorage overlay: each lifecycle mutation is
   persisted by exception id and replayed onto the seed at module load.
   It is browser-only (no-ops under SSR / when storage is unavailable)
   and deliberately narrow — only the lifecycle-projection fields the
   case roll-up reads. It is NOT a general mock-state store. */
const OVERLAY_KEY = "asoe:mock-exception-overlay:v1";

type ExceptionMutationPatch = Partial<
  Pick<ExceptionSummary, "lifecycle_state" | "final_status" | "updated_at">
>;

function overlayStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Access to localStorage can throw (privacy mode, sandboxed iframe).
    return null;
  }
}

function readOverlay(): Record<string, ExceptionMutationPatch> {
  const ls = overlayStorage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(OVERLAY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Replay persisted lifecycle mutations onto the live MOCK_EXCEPTIONS rows. */
function applyOverlay(): void {
  const overlay = readOverlay();
  for (const exc of MOCK_EXCEPTIONS) {
    const patch = overlay[exc.id];
    if (patch) Object.assign(exc, patch);
  }
}

/**
 * Persist a lifecycle mutation so it survives a page reload. Called by
 * the mock action paths in `src/lib/api.ts` after they mutate the
 * in-memory row. No-ops outside the browser (SSR / tests without a
 * window) and on any storage error — persistence is best-effort, the
 * in-memory mutation remains the source of truth for the session.
 */
export function persistMockExceptionMutation(
  id: string,
  patch: ExceptionMutationPatch,
): void {
  const ls = overlayStorage();
  if (!ls) return;
  try {
    const overlay = readOverlay();
    overlay[id] = { ...overlay[id], ...patch };
    ls.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  } catch {
    // Quota / serialisation failures are non-fatal — drop the persist.
  }
}

/** Clear the persisted overlay. Used by the per-test reset. */
export function clearMockExceptionOverlay(): void {
  const ls = overlayStorage();
  if (!ls) return;
  try {
    ls.removeItem(OVERLAY_KEY);
  } catch {
    // ignore
  }
}

// Replay any persisted mutations on top of the freshly-seeded rows.
// Runs once at module load (browser only); the _INITIAL snapshot above
// is captured BEFORE this so `resetMockExceptions()` always restores
// the pristine seed, never the overlay-modified state.
applyOverlay();

/**
 * Restore `MOCK_EXCEPTIONS` to its seeded fixture state.
 *
 * Why this exists: the mock action paths in `src/lib/api.ts`
 * (`disposition` / `escalate` / `cosign`) mutate the underlying
 * row's `lifecycle_state` and `updated_at` so a subsequent
 * `get()` / `casesApi.list()` re-fetch sees the new state — the
 * same parity the live asoe2 backend gives. Without mutation the
 * UI's post-action refetch would revert the queue + case header
 * + `/home` tiles back to the pre-action lifecycle (the bug PR
 * #175 fixes). With mutation, vitest tests that touch the same
 * fixture id across cases need a reset between tests; this helper
 * is that reset.
 *
 * Wired into `tests/setup.ts`'s top-level `beforeEach` so every
 * test starts from the seeded baseline. Production code paths
 * never call this — it's a test-only helper.
 *
 * Mutates `MOCK_EXCEPTIONS` in place (splice + push) rather than
 * reassigning the binding so consumers holding a long-lived
 * reference to the array (caseFromMockException, scenario-driven
 * unit tests) still observe the reset.
 */
export function resetMockExceptions(): void {
  // Drop the reload-resilience overlay too, otherwise a mutation
  // persisted in one test would replay into the next.
  clearMockExceptionOverlay();
  MOCK_EXCEPTIONS.splice(
    0,
    MOCK_EXCEPTIONS.length,
    ...JSON.parse(JSON.stringify(_INITIAL_MOCK_EXCEPTIONS)),
  );
}
