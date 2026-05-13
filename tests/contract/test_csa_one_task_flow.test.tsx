/**
 * CSA one-task flow — PO-ratified lock, active.
 *
 * S15a (2026-05-12) closed the deferral that this test originally
 * tracked: `/cases/[id]` now hosts the HITL action ribbon inline by
 * mounting `ExceptionDetailPanel` on the operator-selected record.
 * Single-record cases auto-select; multi-record cases surface a
 * picker. The `?record=<id>` URL query keeps the selection
 * deep-linkable and survives reload.
 *
 * The standalone `/exceptions/[id]` route was retired in the same
 * commit — `CaseDetailPanel` is the canonical action surface.
 *
 * Searchable handle: csa-one-task — `grep -rn csa-one-task` returns
 * this file and docs/test-strategy/csa-one-task-tracking.md.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");
const CASE_DETAIL_PANEL = path.resolve(
  REPO_ROOT,
  "src/app/cases/CaseDetailPanel.tsx",
);
const CASE_DETAIL_PAGE = path.resolve(
  REPO_ROOT,
  "src/app/cases/[id]/page.tsx",
);
const EXCEPTION_DETAIL_PAGE = path.resolve(
  REPO_ROOT,
  "src/app/exceptions/[id]/page.tsx",
);

describe("CSA one-task flow (S15a)", () => {
  it("CaseDetailPanel mounts ExceptionDetailPanel for the selected record", () => {
    const src = readFileSync(CASE_DETAIL_PANEL, "utf-8");
    // The mount point: ExceptionDetailPanel rendered inline whenever
    // selectedRecordId is set. This is the wiring that turns
    // /cases/[id] into the canonical HITL surface — Approve / Reject
    // / Override / Escalate / Reanalyze are reachable in one click.
    expect(src, "CaseDetailPanel must import ExceptionDetailPanel").toMatch(
      /from\s+["']\.\.\/exceptions\/ExceptionDetailPanel["']/,
    );
    expect(
      src,
      "CaseDetailPanel must render <ExceptionDetailPanel exceptionId={...}>",
    ).toMatch(/<ExceptionDetailPanel\s+exceptionId=\{[^}]+\}/);
  });

  it("CaseDetailPanel surfaces a record picker for multi-record cases", () => {
    const src = readFileSync(CASE_DETAIL_PANEL, "utf-8");
    // role="radiogroup" + role="radio" + onSelectRecord — the picker
    // contract the operator interacts with when the case has more
    // than one attached record. Single-record cases short-circuit
    // through an auto-select effect so the picker never gates the
    // happy path.
    expect(src).toMatch(/role=["']radiogroup["']/);
    expect(src).toMatch(/role=["']radio["']/);
    expect(src).toMatch(/onSelectRecord/);
  });

  it("/cases/[id] page reads ?record=<id> and threads it into CaseDetailPanel", () => {
    const src = readFileSync(CASE_DETAIL_PAGE, "utf-8");
    expect(
      src,
      "page must use useSearchParams to read the ?record= query",
    ).toMatch(/useSearchParams/);
    expect(
      src,
      'page must read the "record" query parameter',
    ).toMatch(/\.get\(\s*["']record["']\s*\)/);
    expect(
      src,
      "page must thread selectedRecordId + onSelectRecord into CaseDetailPanel",
    ).toMatch(/selectedRecordId=\{[^}]+\}/);
    expect(src).toMatch(/onSelectRecord=\{[^}]+\}/);
  });

  it("/exceptions/[id] route is retired (canonical action surface is /cases/[id])", () => {
    expect(
      existsSync(EXCEPTION_DETAIL_PAGE),
      "src/app/exceptions/[id]/page.tsx must not exist — S15a retired the route. " +
        "Per-record action lives at /cases/[id]?record=<id>.",
    ).toBe(false);
  });
});
