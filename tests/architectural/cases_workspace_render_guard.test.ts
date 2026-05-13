/**
 * Architectural lock for the `/cases` workspace state-machine.
 *
 * The bug this guards against is documented in the commit
 * "fix(cases): clear stale state on case switch + render-guard
 * against race (ADR-041 P3c follow-on)":
 *
 *   * `selectedCaseId` is read from the URL via `useSearchParams`.
 *   * `orderCase` and `records` are loaded via a separate
 *     `useEffect` keyed on `selectedCaseId`.
 *   * Between the URL changing and the new fetch completing, the
 *     parent's state still holds the PRIOR case's data. If
 *     `CaseDetailPanel` renders during that window, its auto-mount
 *     effect fires `onSelectRecord(records[0].id)` with a record id
 *     that doesn't belong to the new case — and that bad id ends
 *     up in the URL.
 *
 * Two source-level invariants close the race:
 *
 *   1. The fetch `useEffect` MUST eagerly clear `orderCase` /
 *      `records` / `policyHits` at the top, BEFORE starting the
 *      new fetch. So the brief render window between "URL changed"
 *      and "new state landed" doesn't surface the stale case.
 *
 *   2. The JSX MUST render `CaseDetailPanel` only when the loaded
 *      `orderCase.case_id` matches the URL `?case=`. So even if a
 *      render slips through with stale state, the panel can't
 *      auto-mount with mismatched data.
 *
 * Source-level locks (vs render-level locks) because the bug lives
 * in the state machine, not the visual contract — a behavioural
 * test on a real DOM is the partner contract (see
 * `tests/components/CasesPageCaseSwitch.test.tsx` + the
 * `cases-workspace-case-switch.spec.ts` browser e2e). The source
 * lock is the cheap canary that catches a maintainer accidentally
 * deleting either invariant during a refactor.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/cases/page.tsx",
);

describe("/cases workspace — case-switch race invariants", () => {
  const src = readFileSync(PAGE_PATH, "utf-8");

  it("clears orderCase + records eagerly when selectedCaseId changes", () => {
    // Locate the useEffect keyed on [selectedCaseId]. The body must
    // include explicit `setOrderCase(null)` and `setRecords([])` BEFORE
    // the casesApi.get(selectedCaseId) call.
    const effectBody = src.match(
      /useEffect\(\(\)[\s\S]*?\}, \[selectedCaseId\]\)/,
    );
    expect(
      effectBody,
      "useEffect keyed on [selectedCaseId] not found",
    ).not.toBeNull();
    const body = effectBody![0];

    const clearIdx = body.indexOf("setOrderCase(null)");
    const fetchIdx = body.search(/casesApi\.get\(\s*selectedCaseId\s*\)/);
    expect(
      clearIdx,
      "setOrderCase(null) missing — stale prior-case data leaks " +
        "into the new-case render window",
    ).toBeGreaterThan(-1);
    expect(
      fetchIdx,
      "casesApi.get(selectedCaseId) call not found",
    ).toBeGreaterThan(-1);
    expect(
      clearIdx,
      "setOrderCase(null) must come BEFORE casesApi.get(...)",
    ).toBeLessThan(fetchIdx);

    expect(
      body,
      "setRecords([]) missing — same race shape as setOrderCase",
    ).toMatch(/setRecords\(\s*\[\s*\]\s*\)/);
  });

  it("only renders CaseDetailPanel when orderCase.case_id matches URL", () => {
    // The JSX guard prevents the panel from rendering with stale
    // state in the gap between "URL changed" and "new fetch landed".
    // Pattern: an `&&` chain whose final clause is
    // `orderCase.case_id === selectedCaseId` (with optional
    // whitespace), guarding the `<CaseDetailPanel ... />` mount.
    expect(
      src,
      "render-guard `orderCase.case_id === selectedCaseId` missing — " +
        "CaseDetailPanel can mount with stale case data and its " +
        "auto-mount effect writes the wrong record id into the URL",
    ).toMatch(/orderCase\.case_id\s*===\s*selectedCaseId/);
  });
});
