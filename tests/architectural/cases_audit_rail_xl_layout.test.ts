/**
 * Cases workspace audit rail (xl third column) lock — ADR-041 P3e §2.3.
 *
 * Pattern A (source-grep) per CLAUDE.md test strategy. Locks the
 * page-level layout invariants the panel signed off on:
 *
 *   1. `ComplianceHitsRail` is imported alongside `CaseDetailPanel`
 *      and `CasesQueueRow`.
 *   2. The xl-only grid override is gated on `CASES_ROW_V2` —
 *      the flag-off default keeps today's two-column layout.
 *   3. `CaseDetailPanel` is passed `suppressInlineComplianceHits`
 *      bound to the flag — without it, hits render twice at xl.
 *   4. A third `<aside aria-label="Compliance audit rail">` exists
 *      with the responsive class pair (`hidden` when V2 off,
 *      `hidden xl:flex` when V2 on).
 *   5. At lg-and-below, a `xl:hidden` wrapper around an inline
 *      `ComplianceHitsRail` keeps the section visible in the main
 *      column (Compliance veto upheld — Hits stay in the main
 *      column on laptop widths).
 *
 * Bug shape this catches: the inline render leaks into xl and
 * renders the hits twice; or the inline render disappears at lg
 * and Compliance loses on-screen presence at laptop widths.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync(
  path.join(__dirname, "../../src/app/cases/page.tsx"),
  "utf-8",
);

describe("cases workspace audit rail (ADR-041 P3e §2.3)", () => {
  it("imports ComplianceHitsRail from the local module", () => {
    expect(PAGE).toMatch(
      /import\s*\{\s*ComplianceHitsRail\s*\}\s*from\s*["']\.\/ComplianceHitsRail["']/,
    );
  });

  it("only widens to xl 3-column when CASES_ROW_V2 is true AND rail has content", () => {
    // The xl override must be gated on the flag (so the layout
    // doesn't shift under operators with V2 off) AND on
    // `railHasContent` (so the 320px column doesn't render
    // when there's nothing to put in it — PO round-2 #1).
    expect(PAGE).toMatch(
      /CASES_ROW_V2\s*&&\s*railHasContent\s*&&\s*["']xl:grid-cols-\[360px_minmax\(0,1fr\)_320px\]["']/,
    );
  });

  it("passes the flag through to CaseDetailPanel's suppress prop", () => {
    expect(PAGE).toMatch(/suppressInlineComplianceHits=\{CASES_ROW_V2\}/);
  });

  it("renders the third aside as the audit-rail column", () => {
    expect(PAGE).toMatch(/aria-label=["']Compliance audit rail["']/);
  });

  it("rail aside is hidden when the flag is off OR no tenant has content", () => {
    // The aside must collapse:
    //   * below xl (responsive),
    //   * when the V2 flag is off (rollback), and
    //   * when no rail tenant has content (PO round-2 #1).
    // Without all three, an operator either sees the legacy
    // layout collide with V2 or stares at an empty 320px column.
    expect(PAGE).toMatch(
      /CASES_ROW_V2\s*&&\s*railHasContent\s*\?\s*["']hidden xl:flex["']\s*:\s*["']hidden["']/,
    );
  });

  it("rail stacks ComplianceHitsRail + RecordPreviewRail (PO #1)", () => {
    // 2026-05-28 UX panel synthesis (PO finding #1): the rail's
    // 320px third column was sparse. Compliance Hits stays at
    // the top; RecordPreviewRail (AI-drafted reply on Phase 1)
    // stacks below. No tabs — Compliance SME vetoed swapping
    // hits off-screen.
    expect(PAGE).toMatch(
      /import\s*\{\s*RecordPreviewRail\s*\}\s*from\s*["']\.\/RecordPreviewRail["']/,
    );
    expect(PAGE).toMatch(/<RecordPreviewRail\b/);
    // ComplianceHitsRail must mount BEFORE RecordPreviewRail in
    // source order — SOX evidence-of-review can't drop below the
    // preview.
    const hitsIdx = PAGE.indexOf("<ComplianceHitsRail hits={policyHits");
    const previewIdx = PAGE.indexOf("<RecordPreviewRail");
    expect(hitsIdx).toBeGreaterThan(-1);
    expect(previewIdx).toBeGreaterThan(-1);
    expect(hitsIdx).toBeLessThan(previewIdx);
  });

  it("rail collapses dynamically when no tenant has content (PO round-2 #1)", () => {
    // User reported the empty 320px column looked awkward when
    // a case had neither Compliance Hits nor a draft reply.
    // Fix: page tracks `railHasContent` (combined of
    // `policyHits.length > 0` and the preview's
    // `onContentfulChange` callback), and gates BOTH the
    // xl:grid-cols-3 override AND the aside visibility on it.
    // When both rail tenants are empty the grid stays 2-col and
    // the workspace gets the full width.
    expect(PAGE).toMatch(/railHasContent/);
    expect(PAGE).toMatch(
      /CASES_ROW_V2\s*&&\s*railHasContent\s*&&\s*["']xl:grid-cols-\[360px_minmax\(0,1fr\)_320px\]["']/,
    );
    expect(PAGE).toMatch(
      /CASES_ROW_V2\s*&&\s*railHasContent\s*\?\s*["']hidden xl:flex["']/,
    );
    // RecordPreviewRail must wire its contentful callback up to
    // the page-level state setter so the rail can collapse when
    // the draft availability changes.
    expect(PAGE).toMatch(/onContentfulChange=\{setPreviewHasContent\}/);
  });

  it("renders an xl:hidden inline ComplianceHitsRail for lg fallback", () => {
    // At lg the panel's own inline section is suppressed by the
    // prop above; the page must re-render the hits as a sibling
    // so the operator sees them in the main column at laptop widths.
    expect(PAGE).toMatch(
      /className=["']xl:hidden["']\s*>\s*<ComplianceHitsRail/,
    );
  });
});
