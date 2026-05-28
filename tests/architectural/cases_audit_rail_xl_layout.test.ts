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

  it("only widens to xl 3-column when CASES_ROW_V2 is true", () => {
    // The xl override must be gated on the flag — otherwise the
    // layout shifts under operators even with the V2 flag off.
    expect(PAGE).toMatch(
      /CASES_ROW_V2\s*&&\s*["']xl:grid-cols-\[360px_minmax\(0,1fr\)_320px\]["']/,
    );
  });

  it("passes the flag through to CaseDetailPanel's suppress prop", () => {
    expect(PAGE).toMatch(/suppressInlineComplianceHits=\{CASES_ROW_V2\}/);
  });

  it("renders the third aside as the audit-rail column", () => {
    expect(PAGE).toMatch(/aria-label=["']Compliance audit rail["']/);
  });

  it("rail aside is hidden at lg and only shown at xl when flag is on", () => {
    // The aside must collapse below xl AND when the flag is off,
    // so the legacy two-column layout is preserved.
    expect(PAGE).toMatch(
      /CASES_ROW_V2\s*\?\s*["']hidden xl:flex["']\s*:\s*["']hidden["']/,
    );
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
