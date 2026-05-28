// flags.ts — feature-flag resolution helpers.
//
// Centralises the `NEXT_PUBLIC_CASES_ROW_V2` rollout policy. Two
// callers today (`src/app/cases/page.tsx` and
// `src/app/exceptions/ExceptionDetailPanel.tsx`); a third lands
// when telemetry's scroll observer wires in (Phase 3+ follow-on).
//
// Policy (ADR-041 P3e Phase 3 sign-off — gate timing):
//
//   * **Production** — flag stays OFF unless
//     `NEXT_PUBLIC_CASES_ROW_V2=1` is explicitly set at build time.
//     Compliance audit-format review (gate 2) + CSA dry-run (gate 4)
//     are not yet complete, so production rollout is operator-
//     decision, not automatic.
//
//   * **Vercel preview deploys** — flag ON by default so the V2
//     surface is reviewable on the preview URL without a manual
//     env-var flip. `VERCEL_ENV === "preview"` is set by Vercel
//     on every PR / branch deploy. Operators reviewing the gate
//     deliverables see realistic V2 surfaces here.
//
//   * **Local dev** — flag OFF unless the env var is set. Matches
//     production so dev sessions exercise the rollback path by
//     default.
//
// The function is pure + synchronous + safe to call during render —
// `process.env` reads are baked at build time for `NEXT_PUBLIC_*`
// vars and Vercel injects `VERCEL_ENV` at the same boundary.

export function casesRowV2Enabled(): boolean {
  if (process.env.NEXT_PUBLIC_CASES_ROW_V2 === "1") return true;
  if (process.env.NEXT_PUBLIC_CASES_ROW_V2 === "0") return false;
  // Vercel preview deploys default to V2 so gate reviewers see
  // the new surface without a manual env-var flip.
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "preview") return true;
  return false;
}
