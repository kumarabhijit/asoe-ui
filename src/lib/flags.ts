// flags.ts — feature-flag resolution helpers.
//
// Centralises the `NEXT_PUBLIC_CASES_ROW_V2` rollout policy. Two
// callers today (`src/app/cases/page.tsx` and
// `src/app/exceptions/ExceptionDetailPanel.tsx`).
//
// Project deployment taxonomy (PO direction 2026-05-28):
//
//   * **Dev**       — local engineer workstation. Iteration env.
//   * **Preview**   — asoe-ui.vercel.app. Gate reviewers (CSA,
//                     Compliance, Recipe SME), UX validation,
//                     stakeholder demo. NOTE Vercel's own
//                     `VERCEL_ENV` reports "production" for this
//                     deploy because it's the main-branch alias;
//                     the project's taxonomy treats it as preview.
//                     Do NOT key flag behaviour on `VERCEL_ENV`.
//   * **Pre-prod**  — Azure. Integration testing against the
//                     real backend + gateways.
//   * **Prod**      — does not exist yet. When prod lands, revisit
//                     this helper to add gating per the Phase 3
//                     sign-off list (Compliance audit-format
//                     review + CSA dry-run).
//
// Until prod lands, all four current tiers want V2 visible — the
// surface is being actively reviewed. Default ON.
//
// `NEXT_PUBLIC_CASES_ROW_V2=0` is the escape hatch: flip the env
// var in Vercel Project Settings → Environment Variables to roll
// back without a code change.

export function casesRowV2Enabled(): boolean {
  if (process.env.NEXT_PUBLIC_CASES_ROW_V2 === "0") return false;
  return true;
}

// ── Cockpit redesign (cockpit-refactor) ─────────────────────────────
//
// Gates the agent-first "decision cockpit" composition: a confidence
// ring on the Recommendation, the persistent Agent Activity rail, and
// the cockpit center layout. DEFAULT ON (product direction 2026-06-11):
// the Modern view is the org-wide default seed for `useViewMode`; a
// stored per-user choice from the NavBar Legacy/Modern toggle still
// wins, and `NEXT_PUBLIC_COCKPIT=0` is the env escape hatch to roll
// the default back without a code change — the same rollback pattern
// as `casesRowV2Enabled` above. The browser-e2e suites pin their mode
// explicitly: `playwright.config.ts` / `playwright.mock.config.ts` run
// the legacy-journey specs with NEXT_PUBLIC_COCKPIT=0, and
// `playwright.cockpit.config.ts` runs the cockpit specs with =1,
// which now matches the production default.
//
// Design principle: nothing about the cockpit touches data fetching,
// action handlers, RBAC, or backend contracts — it is a presentational
// recomposition of the same data the classic layout consumes.
export function cockpitEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_COCKPIT === "0") return false;
  return true;
}
