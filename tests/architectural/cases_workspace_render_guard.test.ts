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

  // Deliverable-completeness pattern (ADR-041 P3d-remaining,
  // 2026-05-14): the PO flagged "I can't find the 3-pane view; is
  // this a bug or missing mock data?". Behavioural tests passed
  // because the workspace's existing two-pane layout still renders
  // correctly — the gap was that the third pane was simply not
  // built. Behavioural tests can't catch deliverable absence; an
  // architectural lock that asserts the EXPECTED STRUCTURE makes
  // missing deliverables fail loudly at unit-test speed.
  //
  // Pattern documented as Gap 7 in `docs/test-strategy/README.md`.
  it("renders the two-pane workspace: case-queue + case-workspace", () => {
    // (a) Both pane wrappers must be referenced.
    expect(
      src,
      "left pane: queue must be present (aria-label='Case queue')",
    ).toMatch(/aria-label=["']Case queue["']/);
    expect(
      src,
      "right pane: case workspace must be present (aria-label='Case workspace')",
    ).toMatch(/aria-label=["']Case workspace["']/);

    // (b) The CSS grid-template must declare TWO columns at lg+
    // (queue + detail). Pattern: `lg:grid-cols-[<a>_<b>]`.
    expect(
      src,
      "the workspace grid must declare two columns at the lg breakpoint",
    ).toMatch(/lg:grid-cols-\[[^\]]+_[^\]]+\]/);

    // (c) …and it must NOT re-introduce a dedicated 3rd column at xl.
    // The record list stacks on the detail pane; a 3rd column squeezed
    // the record rows and clipped their labels at laptop widths.
    expect(
      src,
      "the workspace must not declare a 3-column grid (the record list " +
        "stacks on the detail pane, it is not a dedicated column)",
    ).not.toMatch(/grid-cols-\[[^\]]+_[^\]]+_[^\]]+\]/);
  });

  it("mounts the records picker inline on the detail pane (CaseDetailPanel)", () => {
    // The two-pane workspace has no dedicated record-list column — the
    // picker (RecordListPane) is stacked at the top of the detail pane
    // by CaseDetailPanel, which renders it by default. The workspace
    // must therefore NOT suppress it.
    expect(
      src,
      "workspace must not pass showInlineRecordList={false} — the " +
        "inline picker is the only path to choosing a record",
    ).not.toMatch(/showInlineRecordList=\{false\}/);

    const detailPanel = readFileSync(
      path.resolve(__dirname, "../../src/app/cases/CaseDetailPanel.tsx"),
      "utf-8",
    );
    expect(
      detailPanel,
      "CaseDetailPanel must mount RecordListPane (the inline picker)",
    ).toMatch(/<RecordListPane[\s>]/);
    expect(
      detailPanel,
      "CaseDetailPanel must import RecordListPane",
    ).toMatch(/import\s+\{\s*RecordListPane\s*\}\s+from\s+["']\.\/RecordListPane["']/);
  });

  it("selection URL writes use scroll:false so the queue keeps its position", () => {
    // Bug: clicking a queue row (or a record in the picker) jumped
    // the viewport to the top of the document. Root cause — Next.js
    // App Router scrolls to top on every `router.replace`/`push` by
    // default. The `/cases` workspace is an in-place state machine:
    // selection is a URL write, not a page navigation, so the
    // viewport must stay put. On a long, SLA-sorted queue the
    // scroll-to-top makes the operator lose the row they just
    // clicked.
    //
    // Lock: every `router.replace(` in the page must pass
    // `scroll: false`. Asserted by matching each call's options
    // object. Fails on the parent commit where the calls had no
    // second argument.
    const replaceCalls = src.match(/router\.replace\([\s\S]*?\)\s*;/g) ?? [];
    expect(
      replaceCalls.length,
      "expected at least the case-select + record-select " +
        "router.replace calls",
    ).toBeGreaterThanOrEqual(2);
    for (const call of replaceCalls) {
      expect(
        call,
        "router.replace without `scroll: false` — selection will " +
          "yank the viewport to the top of the document:\n" + call,
      ).toMatch(/scroll:\s*false/);
    }
  });

  it("locks the workspace to the viewport so panes scroll independently", () => {
    // Bug ("scrolling issue"): the <main> grid had no height bound, so
    // its row grew to the tallest pane and the per-pane
    // `overflow-y-auto` / `min-h-0` never engaged. The whole document
    // scrolled instead — dragging the selected case's action ribbon
    // out of view on a long queue. The Outlook master-detail pattern
    // requires the workspace to be pinned under the sticky nav and
    // clip its own overflow at the multi-pane breakpoints, so each
    // pane scrolls on its own.
    //
    // Below `lg` the panes stack in normal document flow (so nothing
    // is clipped on tablet/phone); the lock only applies at `lg`+.
    expect(
      src,
      "the workspace must be height-locked to the viewport under the " +
        "nav at lg+ (lg:h-[calc(100vh-var(--nav-height))]) so the " +
        "panes scroll independently instead of the whole document",
    ).toMatch(/lg:h-\[calc\(100vh-var\(--nav-height\)\)\]/);
    expect(
      src,
      "the height-locked workspace must clip its overflow at lg+ " +
        "(lg:overflow-hidden) — otherwise the locked height does " +
        "nothing and the document still scrolls",
    ).toMatch(/lg:overflow-hidden/);

    // The right pane (case workspace) must become its own scroll
    // container at lg+; without this it overflows the locked main and
    // re-introduces document scroll.
    expect(
      src,
      "the case-workspace pane must scroll its own overflow at lg+ " +
        "(lg:overflow-y-auto)",
    ).toMatch(/lg:overflow-y-auto/);
  });

  it("makes the queue a single Tab stop (roving options, not N tab stops)", () => {
    // Bug ("navigation / focus loss"): each queue row was a focusable
    // <button> with no tabIndex override, so a 50-row queue was 50 Tab
    // stops (WCAG 2.4.3). The correct listbox pattern is a single Tab
    // stop on the container with the active option announced via
    // aria-activedescendant. Lock: the listbox container is tabIndex=0
    // with aria-activedescendant, and each option is tabIndex={-1}.
    expect(
      src,
      "queue listbox must carry aria-activedescendant",
    ).toMatch(/role=["']listbox["'][\s\S]*?aria-activedescendant=/);
    expect(
      src,
      "the option rows must be tabIndex={-1} so the listbox is the " +
        "single Tab stop (roving via aria-activedescendant)",
    ).toMatch(/role=["']option["'][\s\S]*?tabIndex=\{-1\}/);
  });

  it("supports F6 cross-pane focus switching", () => {
    // Bug ("can't switch between panes with a keyboard shortcut"):
    // Tab walked every row, and there was no shortcut to jump between
    // the queue and detail panes. usePaneFocusCycle binds
    // F6 / Shift+F6 across the pane refs; the detail section is made a
    // focus target with tabIndex={-1}.
    expect(
      src,
      "usePaneFocusCycle must be imported",
    ).toMatch(/import\s+\{\s*usePaneFocusCycle\s*\}\s+from\s+["']@\/hooks\/usePaneFocusCycle["']/);
    expect(
      src,
      "usePaneFocusCycle must be wired with the pane refs",
    ).toMatch(/usePaneFocusCycle\(/);
    expect(
      src,
      "the case-workspace section must be focusable (tabIndex={-1}) " +
        "so F6 can land on it",
    ).toMatch(/aria-label=["']Case workspace["'][\s\S]{0,500}?tabIndex=\{-1\}/);
  });

  it("pins the selected case in the visible queue across filter mismatches", () => {
    // The UX architect flagged "agent mutates the selected record's
    // status while the operator is on it" as a real incident. When
    // a WS-driven refetch lands and the selected case no longer
    // matches the active status filter, the operator's row must
    // stay visible (pinned) — yanking it out from under the cursor
    // is the foot-gun.
    //
    // Pattern: the `cases` useMemo must read `selectedCaseId` and,
    // when the filter doesn't include it, prepend the pinned row.
    // We assert two source-level invariants the fix encoded.
    //
    // (a) The cases-shaping memo lists `selectedCaseId` in its
    // deps. Without it, the memo can't re-pin when the URL changes.
    expect(
      src,
      "cases useMemo must depend on selectedCaseId for the " +
        "pin-selection refresh to fire",
    ).toMatch(
      /const cases = useMemo[\s\S]*?\}, \[[^\]]*selectedCaseId[^\]]*\]\)/,
    );

    // (b) The memo body produces an `isPinned: true` row when the
    // selected case is missing from the filtered list. This is the
    // observable artefact — without it the row vanishes.
    expect(
      src,
      "pin-selection branch missing — selected case can vanish " +
        "from the queue when filter / WS refetch excludes it",
    ).toMatch(/isPinned:\s*true/);
  });
});
