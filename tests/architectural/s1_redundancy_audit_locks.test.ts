/**
 * Architectural locks for the S1 Redundancy & Density audit
 * (sprint 2026-05-28). These are source-grep locks — the cheap
 * canaries that catch a maintainer accidentally re-introducing
 * the duplicated surfaces the audit removed.
 *
 * Pairs with the render-level regression tests in
 * `tests/components/CaseDetailPanel.test.tsx` (the "S1 redundancy
 * audit locks" describe block). The source locks protect against
 * silent re-introduction of the same prop on a different mount;
 * the render locks protect against the visible regression. Both
 * are required by `docs/test-strategy/README.md` Gap 7 for the
 * SectionAnchorBar deliverable.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const CASE_DETAIL_PATH = path.resolve(
  __dirname,
  "../../src/app/cases/CaseDetailPanel.tsx",
);
const EXCEPTION_PANEL_PATH = path.resolve(
  __dirname,
  "../../src/app/exceptions/ExceptionDetailPanel.tsx",
);
const HEADER_RIBBON_PATH = path.resolve(
  __dirname,
  "../../src/app/exceptions/HeaderRibbon.tsx",
);
const CONTEXT_STRIP_PATH = path.resolve(
  __dirname,
  "../../src/app/exceptions/ContextStrip.tsx",
);

describe("S1 audit — embedded prop wiring (findings #1, #5, #7, #8)", () => {
  it("CaseDetailPanel mounts ExceptionDetailPanel with `embedded`", () => {
    // The /cases workspace is the only mount point that should pass
    // `embedded`; the standalone /exceptions/[id] view keeps the full
    // chrome. The literal prop must appear on the JSX mount.
    const src = readFileSync(CASE_DETAIL_PATH, "utf-8");
    const mount = src.match(
      /<ExceptionDetailPanel[\s\S]*?onActionComplete=\{onRecordActionComplete\}[\s\S]*?\/>/,
    );
    expect(mount, "ExceptionDetailPanel mount not found").not.toBeNull();
    expect(
      mount?.[0].includes("embedded"),
      "ExceptionDetailPanel mount must pass `embedded` so the per-record HeaderRibbon + ContextStrip drop their duplicated case-level surfaces",
    ).toBe(true);
  });

  it("ExceptionDetailPanel forwards `embedded` to HeaderRibbon", () => {
    const src = readFileSync(EXCEPTION_PANEL_PATH, "utf-8");
    const ribbonMount = src.match(/<HeaderRibbon[\s\S]*?\/>/);
    expect(ribbonMount, "HeaderRibbon mount not found").not.toBeNull();
    expect(
      ribbonMount?.[0].includes("embedded={embedded}"),
      "HeaderRibbon must receive the parent's `embedded` prop",
    ).toBe(true);
  });

  it("ExceptionDetailPanel forwards `embedded` to ContextStrip", () => {
    const src = readFileSync(EXCEPTION_PANEL_PATH, "utf-8");
    const stripMount = src.match(/<ContextStrip[\s\S]*?\/>/);
    expect(stripMount, "ContextStrip mount not found").not.toBeNull();
    expect(
      stripMount?.[0].includes("embedded={embedded}"),
      "ContextStrip must receive the parent's `embedded` prop",
    ).toBe(true);
  });

  it("HeaderRibbon gates the breadcrumb on `!embedded`", () => {
    const src = readFileSync(HEADER_RIBBON_PATH, "utf-8");
    // The breadcrumb block is the only place the order_id renders.
    // It must sit inside a `{!embedded && (` gate so embedded mode
    // hides it entirely.
    expect(
      /\{!embedded && \(/.test(src),
      "HeaderRibbon must wrap the breadcrumb in a !embedded gate",
    ).toBe(true);
  });

  it("HeaderRibbon gates the Audit Result badge on `!embedded`", () => {
    const src = readFileSync(HEADER_RIBBON_PATH, "utf-8");
    // The Audit Result row was the per-record verdict that doubled
    // the case-level compliance surfaces. The gate must hide it in
    // embedded mode.
    expect(
      /\{!embedded && detail\.shadow_verdict && \(/.test(src),
      "HeaderRibbon must gate the Audit Result badge on !embedded",
    ).toBe(true);
  });

  it("ContextStrip gates the Customer row on `!embedded`", () => {
    const src = readFileSync(CONTEXT_STRIP_PATH, "utf-8");
    expect(
      /\{!embedded && \(/.test(src),
      "ContextStrip must gate the Customer row on !embedded",
    ).toBe(true);
  });
});


describe("S1 audit — full-header grid trimmed (findings #3, #6, #7, #13)", () => {
  const src = readFileSync(CASE_DETAIL_PATH, "utf-8");

  it("removes the `SLA deadline` grid field (finding #3)", () => {
    expect(
      /label=\{`SLA deadline/.test(src),
      "The `SLA deadline · ${sla.label}` field was a concatenated duplicate of the SLA chip label — must stay removed",
    ).toBe(false);
  });

  it("removes the `Customer PO` grid field (finding #6)", () => {
    expect(
      /label="Customer PO"/.test(src),
      "Customer PO is in the slim header; the grid duplicate must stay removed",
    ).toBe(false);
  });

  it("removes the `Customer` grid field (finding #7)", () => {
    expect(
      /label="Customer"/.test(src),
      "Customer name lives in the breadcrumb / ContextStrip — the grid duplicate must stay removed",
    ).toBe(false);
  });

  it("removes the `Skill bundle at open` grid field (finding #13)", () => {
    expect(
      /label="Skill bundle at open"/.test(src),
      "Skill bundle is dev/audit metadata — must stay removed from the operator-facing header grid",
    ).toBe(false);
  });
});


describe("S1 audit — SectionAnchorBar deliverable (finding #10)", () => {
  it("ExceptionDetailPanel mounts SectionAnchorBar", () => {
    const src = readFileSync(EXCEPTION_PANEL_PATH, "utf-8");
    expect(
      /<SectionAnchorBar \/>/.test(src),
      "SectionAnchorBar must be mounted between ContextStrip and the sticky action ribbon",
    ).toBe(true);
  });

  it("ExceptionDetailPanel defines all three anchor targets", () => {
    const src = readFileSync(EXCEPTION_PANEL_PATH, "utf-8");
    for (const id of [
      "section-recommendation",
      "section-evidence",
      "section-diagnostics",
    ]) {
      expect(
        src.includes(`id="${id}"`),
        `anchor target id="${id}" must remain in the source so the anchor bar's link scrolls to a real element`,
      ).toBe(true);
    }
  });

  it("SectionAnchorBar declares the three matching hrefs", () => {
    const src = readFileSync(EXCEPTION_PANEL_PATH, "utf-8");
    for (const href of [
      "#section-recommendation",
      "#section-evidence",
      "#section-diagnostics",
    ]) {
      expect(
        src.includes(`href="${href}"`),
        `anchor bar must render <a href="${href}"> — bar and target ids must stay in sync`,
      ).toBe(true);
    }
  });
});
