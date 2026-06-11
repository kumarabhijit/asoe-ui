/**
 * Architectural lock — HITL action propagation across `/cases` panes.
 *
 * The bug this guards against: a disposition / override / escalate /
 * cosign / reanalyze performed on the record mounted inside
 * `CaseDetailPanel` mutated the record's `lifecycle_state`, which
 * rolls up into `OrderCase.status` (STATUS_MODEL.md §3) — but only
 * the inner `ExceptionDetailPanel` refreshed its own `detail`. The
 * case-queue pane, the `RecordListPane` rows, and the case-header
 * status badge all kept projecting the PRE-action status until an
 * unrelated WebSocket `case_*` event happened to arrive. With the WS
 * down (or simply slow) the operator saw an exception flip to
 * RESOLVED in the detail pane while the queue still said "Awaiting
 * review" — backend state and UI presentation drifted.
 *
 * Root cause: `CaseDetailPanel` mounted `<ExceptionDetailPanel ... />`
 * with NO `onActionComplete` prop, so the action-complete seam that
 * `useExceptionActions` already fires was dropped on the floor.
 *
 * Three source-level invariants close the drift:
 *
 *   1. `CaseDetailPanel` forwards an `onRecordActionComplete` prop
 *      into the inline `ExceptionDetailPanel` as `onActionComplete`.
 *   2. The `/cases` page mounts `CaseDetailPanel` WITH
 *      `onRecordActionComplete` wired.
 *   3. The wired handler re-fetches the case detail AND `refetch()`s
 *      the queue, so every pane re-projects the post-action status.
 *
 * Source-level locks (vs render-level) because the bug lives in the
 * cross-pane state wiring, not the visual contract — a maintainer
 * deleting the prop during a refactor is the regression shape.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const PAGE_PATH = path.resolve(__dirname, "../../src/app/cases/page.tsx");
const PANEL_PATH = path.resolve(
  __dirname,
  "../../src/app/cases/CaseDetailPanel.tsx",
);

describe("/cases workspace — HITL action propagation invariants", () => {
  const pageSrc = readFileSync(PAGE_PATH, "utf-8");
  const panelSrc = readFileSync(PANEL_PATH, "utf-8");

  it("CaseDetailPanel forwards onRecordActionComplete into the inline ExceptionDetailPanel", () => {
    // The inline ExceptionDetailPanel mount MUST receive
    // `onActionComplete` — without it the action-complete seam that
    // useExceptionActions fires is dropped and sibling panes drift.
    const mount = panelSrc.match(/<ExceptionDetailPanel[\s\S]*?\/>/);
    expect(
      mount,
      "<ExceptionDetailPanel ... /> mount not found in CaseDetailPanel",
    ).not.toBeNull();
    expect(
      mount![0],
      "inline ExceptionDetailPanel mounted WITHOUT onActionComplete — " +
        "HITL actions in the case workspace won't propagate to the " +
        "queue / record-list / case-header panes",
    ).toMatch(/onActionComplete=\{onRecordActionComplete\}/);

    // The prop must be a declared part of the component contract.
    expect(
      panelSrc,
      "CaseDetailPanelProps must declare onRecordActionComplete",
    ).toMatch(/onRecordActionComplete\?\s*:\s*\(\)\s*=>\s*void/);
  });

  it("the /cases page mounts CaseDetailPanel with onRecordActionComplete wired", () => {
    const mount = pageSrc.match(/<CaseDetailPanel[\s\S]*?\/>/);
    expect(mount, "<CaseDetailPanel ... /> mount not found").not.toBeNull();
    expect(
      mount![0],
      "CaseDetailPanel mounted WITHOUT onRecordActionComplete — the " +
        "case workspace can't tell the page an action landed",
    ).toMatch(/onRecordActionComplete=\{handleRecordActionComplete\}/);
  });

  it("the action-complete handler refreshes both the case detail and the queue", () => {
    // handleRecordActionComplete must (a) refetch the queue and
    // (b) re-fetch the selected case's detail so all panes re-project
    // the post-action status.
    const handler = pageSrc.match(
      /const handleRecordActionComplete = useCallback\([\s\S]*?\}, \[[^\]]*\]\)/,
    );
    expect(
      handler,
      "handleRecordActionComplete useCallback not found",
    ).not.toBeNull();
    const body = handler![0];
    expect(
      body,
      "handler must refetch() the queue pane",
    ).toMatch(/refetch\(\)/);
    expect(
      body,
      "handler must refresh the case detail (header badge + records)",
    ).toMatch(/refreshCaseDetail\(\)/);

    // refreshCaseDetail must re-fetch the case AND its records — both
    // panes (header status, RecordListPane) depend on them. Since the
    // Phase 2 dedup it delegates to the shared `loadCaseDetail`
    // helper, which owns both fetches.
    const refresh = pageSrc.match(
      /const refreshCaseDetail = useCallback\([\s\S]*?\}, \[[^\]]*\]\)/,
    );
    expect(refresh, "refreshCaseDetail useCallback not found").not.toBeNull();
    expect(
      refresh![0],
      "refreshCaseDetail must delegate to the shared loadCaseDetail",
    ).toMatch(/loadCaseDetail\(/);

    const helper = pageSrc.match(
      /const loadCaseDetail = useCallback\([\s\S]*?\},\s*\n\s*\[[^\]]*\],?\s*\n?\s*\)/,
    );
    expect(helper, "shared loadCaseDetail helper not found").not.toBeNull();
    expect(
      helper![0],
      "loadCaseDetail must re-fetch the OrderCase",
    ).toMatch(/casesApi\.get\(/);
    expect(
      helper![0],
      "loadCaseDetail must re-fetch the case's child records",
    ).toMatch(/casesApi\.getRecords\(/);
  });
});
