// flags.ts — feature-flag resolution helpers.
//
// Centralises the `NEXT_PUBLIC_CASES_ROW_V2` rollout policy. Two
// callers today (`src/app/cases/page.tsx` and
// `src/app/exceptions/ExceptionDetailPanel.tsx`); a third lands
// when telemetry's scroll observer wires in.
//
// Policy (ADR-041 P3e Phase 3 — PO direction 2026-05-28):
//
//   * **Default ON everywhere.** The PO confirmed
//     `asoe-ui.vercel.app` is the validation surface for the
//     gate-2 (Compliance audit-format) and gate-4 (CSA dry-run)
//     reviews — both of which need the V2 surface visible to run.
//     Previous "production stays OFF" policy made
//     asoe-ui.vercel.app show the legacy row, which blocked the
//     gate reviewers' workflow. The PO's direction supersedes the
//     conservative default; production is the gate-validation
//     environment.
//
//   * **`NEXT_PUBLIC_CASES_ROW_V2=0` is the escape hatch.** If a
//     gate review finds a blocker, flip the env var in Vercel
//     Project Settings → Environment Variables to roll back
//     without a code change.
//
//   * **`NEXT_PUBLIC_CASES_ROW_V2=1` is the redundant explicit
//     opt-in.** Same as the default; retained so the local dev
//     pattern (set the env var when iterating on V2-only paths)
//     keeps working.
//
// The function is pure + synchronous + safe to call during render —
// `process.env` reads are baked at build time for `NEXT_PUBLIC_*`
// vars.

export function casesRowV2Enabled(): boolean {
  if (process.env.NEXT_PUBLIC_CASES_ROW_V2 === "0") return false;
  return true;
}
