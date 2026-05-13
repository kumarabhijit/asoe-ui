# ASOE UI test strategy

## Purpose

Codify the test patterns the repo relies on, the categories of bug
they cover, and the gaps explicit work has closed since 2026-05-13.
Every contributor should read this once. Bug-fix PRs are reviewed
against the regression-test rule below.

The other files in this folder (`cases-cursor-pagination-tracking.md`,
`csa-one-task-tracking.md`) track specific deferral / migration
decisions; this README is the overview.

## The test pyramid

| Layer | Tool | Runtime | What it locks |
|---|---|---|---|
| **L0 — Architectural locks** | vitest source-grep | ~1s | Source-level invariants (no hardcoded enums, JSDoc parser traps, fix-encoded predicates) |
| **L1 — Unit / hook tests** | vitest + RTL | seconds | Pure functions, hook behaviour, single-component render |
| **L2 — Component contract tests** | vitest + RTL with mocks | seconds | One component + its immediate props/callbacks contract |
| **L3 — Page-level state tests** | vitest + RTL with mocked router/api | tens of seconds | Multi-state-transition behaviour inside a page |
| **L4 — Browser e2e (deeplink)** | Playwright + live backend | minutes | "This URL renders this thing"; single-action workflows |
| **L5 — Browser e2e (operator journey)** | Playwright + live backend | minutes | Multi-step user flows; transitions between surfaces |

Most existing specs cluster at L0, L1, L2, L4. The two gaps **L3 +
L5** are where the bugs in 2026-05-12 / 2026-05-13 hid. The
patterns below close them.

## Gap categories — and the pattern that closes each

### Gap 1 — Multi-step "operator journey" coverage (L5)

**Symptom:** Every browser spec deeplinks
(`page.goto(await exceptionUrl(...))`). No spec drives the queue →
detail flow as an operator does it.

**Pattern:** `tests/browser/operator-journeys/<journey-name>.spec.ts`.

```ts
test("operator works two cases in sequence", async ({ page, request }) => {
  const token = await backendToken(request, USERS.MANAGER);
  const excA = await createYellowException(request, token);
  const excB = await createYellowException(request, token);

  await loginAs(page, USERS.MANAGER);
  await page.goto("/cases");           // NOT a deeplink
  const rows = page.locator("[role=option]");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });

  await rows.nth(0).click();
  await assertActionRibbonVisible(page);
  await assertUrlConsistent(page, request, token);

  await rows.nth(1).click();
  await assertActionRibbonVisible(page);
  await assertUrlConsistent(page, request, token);
});
```

`assertUrlConsistent` re-fetches `/api/v1/cases/{case}/records` and
checks the URL `?record=` is in the result — don't trust the UI
state alone. Reference impl in
`tests/browser/cases-workspace-case-switch.spec.ts`.

### Gap 2 — Race / stale-state coverage (L0 + L3)

**Symptom:** State leaks across the interval between `useSearchParams`
updating and the new `useEffect` fetch completing. The case-switch
race (PR #158) is one instance; any URL-driven master-detail surface
has the same shape.

**Pattern A — source-level architectural lock (L0):** For any race
fix, encode the predicate the fix introduced as a grep on the source.
Catches a future contributor deleting either the state-clear or the
render-guard.

```ts
// tests/architectural/<surface>_render_guard.test.ts
import { readFileSync } from "node:fs";
const src = readFileSync(PAGE_PATH, "utf-8");

it("clears stale state before re-fetching", () => {
  const effectBody = src.match(/useEffect[\s\S]*?\}, \[selectedX\]\)/);
  expect(effectBody![0].indexOf("setOrderCase(null)"))
    .toBeLessThan(effectBody![0].search(/api\.get\(\s*selectedX\s*\)/));
});

it("only renders detail when fetched orderCase matches URL selection", () => {
  expect(src).toMatch(/orderCase\.case_id\s*===\s*selectedCaseId/);
});
```

Verify the lock by reverting the fix locally:
`git stash; git checkout HEAD~1 -- <file>; npx vitest run <lock>`.
Should fail.

**Pattern B — behavioural test (L3 or L5):** Mount the page (or
drive the browser), trigger two URL transitions back-to-back, assert
no leakage. The browser e2e in
`tests/browser/cases-workspace-case-switch.spec.ts` uses
`expect.poll` to absorb the eventual-consistency window.

### Gap 3 — Mock-data layer drift from backend invariants

**Symptom:** Backend Pydantic `model_validator` lands; mock data in
`src/lib/api.ts` doesn't get the matching invariant; Vercel preview
breaks but no test fails. The S15a `should_materialise() -> True`
invariant in asoe2 wasn't mirrored in the UI mock for weeks before
PR #155 surfaced it.

**Pattern:** Every backend `model_validator` decorator in
`asoe2/contracts/models.py` (and equivalents in `asoe2/api/store.py`)
gets a paired UI mock invariant test:

```ts
// tests/architectural/mock_<entity>_invariants.test.ts
it("every mock <entity> satisfies the asoe2 <validator-name> invariant", async () => {
  const items = await <entity>Api.list();
  for (const it of items) {
    // mirror the Pydantic predicate exactly
    expect(predicate(it), `entity ${it.id} violates <validator-name>`).toBe(true);
  }
});
```

Reference impls: `tests/architectural/case_pivot_mock_wiring.test.ts`,
`tests/architectural/cases_workspace_render_guard.test.ts`. Adding
a new backend validator without the matching UI mock invariant is
the most common mock-drift bug; this lock makes it loud.

### Gap 4 — Agent-driven mutation under cursor

**Symptom:** The UI assumes state is mutated by the operator. Agents
mutate state too (via WS `case_*` events triggering refetch). No
test simulates an agent event arriving while the operator is
mid-action — but the UX architect flagged it as "a real incident
waiting to happen".

**Pattern:** Mount the workspace, hold a selection, fire a synthetic
WS event for the active case, assert the operator's cursor / record
selection doesn't get yanked.

```ts
// tests/architectural/<surface>_agent_mutation_safe.test.ts
it("WS case_update for the selected case doesn't yank the cursor", async () => {
  // mount with case A selected, record A.1 mounted
  // fire WS case_update for case A
  // assert selectedRecordId still A.1 (not the new records[0])
});
```

Pairs with the hook-level locks
(`tests/architectural/case_invalidation_silent_refresh.test.ts` and
`ws_polling_fallback.test.ts` — currently tombstones after the P4
sweep retired `/exceptions/page.tsx`; both want restoring against
`/cases/page.tsx` once the WS handler is re-wired in P3d).

### Gap 5 — No visual regression baseline

**Symptom:** "Right pane is empty" / "ribbon disappeared" /
"badge colour changed" — visual regressions are the most expensive
class of bug to catch via assertion-style tests. The Vercel preview
is the de-facto visual review.

**Pattern:** Playwright screenshot diff. Three canonical states per
surface (empty / loaded / error). Threshold ~0.2% to absorb font
hinting drift.

```ts
test(`${route} screenshot — ${state}`, async ({ page }) => {
  await loginAs(page, USERS.MANAGER);
  await seedStateFor(state);
  await page.goto(route);
  await expect(page).toHaveScreenshot(`${route}-${state}.png`, {
    maxDiffPixelRatio: 0.002,
  });
});
```

Owned by the existing `browser-e2e` workflow. Not implemented yet —
deliberate gap, lower leverage than gaps 1–4 but worth shipping.

### Gap 6 — No "regression test per bug fix" policy

**Symptom:** Bug fixes land without tests. The bug-class can
silently regress with one careful refactor.

**Rule** (CLAUDE.md):

> Bug-fix PRs MUST include a regression test that fails on the
> parent commit. Verify by:
>
> ```
> git stash
> git checkout HEAD~1 -- <fixed-file>
> npx vitest run <new-test>      # or the browser-e2e equivalent
> ```
>
> The test must fail. Restore the fix
> (`git checkout HEAD -- <fixed-file>; git stash pop`) and verify
> it now passes. Paste both verifications into the PR description.

Required for merge. The case-switch fix in PR #158 followed this —
the architectural lock fails on the pre-fix commit; passes on the
fix.

## Standing gates (today's enforcement)

| Gate | Where | Catches |
|---|---|---|
| `npm run tsc --noEmit` | typecheck workflow | Type contract drift |
| `npx vitest run` | vitest workflow | L0–L3 |
| `npx playwright test` | browser-e2e workflow | L4–L5 |
| `npm run build` | typecheck workflow | Production build errors |

Each new spec MUST land in the appropriate workflow's path filter
or it won't run on PR.

## When you write a new spec — checklist

1. **Which layer?** Pick the cheapest layer that catches the
   regression. Source-level lock if the fix is one predicate.
   Component test if it's one component's behaviour. Operator
   journey if it's a flow.
2. **What does it lock?** Write the assertion before the test
   scaffolding. If you can't state the invariant in one sentence,
   the test is wrong.
3. **Does it fail on the buggy version?** Run the verify-failure
   procedure above. If you can't make it fail by reverting the
   fix, the test isn't covering the bug.
4. **Does it run in CI?** Check the path filter on the workflow.
5. **Will it flake?** State-machine tests should use `expect.poll`
   with bounded intervals, not bare timeouts.

## Reference impls

| Pattern | Reference |
|---|---|
| Source-level architectural lock | `tests/architectural/cases_workspace_render_guard.test.ts` |
| Mock-data invariant | `tests/architectural/case_pivot_mock_wiring.test.ts` |
| Operator-journey browser e2e | `tests/browser/cases-workspace-case-switch.spec.ts` |
| Single-action browser e2e | `tests/browser/escalate.spec.ts` |
| Component contract test | `tests/components/CaseDetailPanel.test.tsx` |
| Hook unit test | `tests/hooks/useCases.test.ts` |
