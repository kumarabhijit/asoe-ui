/**
 * Architectural lock (Pattern A) — the Customer Inbox lens deliverable
 * (ADR-042 Phase 1). The EMAIL_ENTRY lens is a filter chip on /cases wired to
 * the case_type filter. Behavioural tests can't catch "the chip was supposed
 * to ship but wasn't built", so this asserts the source structure. Pairs with
 * the Playwright operator-journey (Pattern B) in
 * tests/browser/cases-workspace-inbox-lens.spec.ts (CLAUDE.md: state-machine
 * surfaces require BOTH).
 *
 * Verify by removing the chip locally — this lock must fail.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const PAGE = readFileSync(
  join(__dirname, "..", "..", "src", "app", "cases", "page.tsx"),
  "utf-8",
);

describe("Customer Inbox lens deliverable (page.tsx)", () => {
  it("renders a 'Customer Inbox' filter chip", () => {
    expect(PAGE).toContain('label="Customer Inbox"');
  });

  it("the lens value is the typed EMAIL_ENTRY case_type (no bare literal in JSX)", () => {
    expect(PAGE).toContain('const INBOX_LENS_CASE_TYPE: CaseType = "EMAIL_ENTRY"');
    expect(PAGE).toContain("filters.case_type === INBOX_LENS_CASE_TYPE");
  });

  it("the filter is threaded into useCases via the caseType option", () => {
    expect(PAGE).toMatch(/useCases\([^)]*caseType:\s*filters\.case_type/s);
  });

  it("CasesFilters carries the case_type axis", () => {
    expect(PAGE).toMatch(/case_type:\s*CaseType\s*\|\s*null/);
  });

  it("'All' clears the lens (resets case_type to null)", () => {
    expect(PAGE).toMatch(/source:\s*null,\s*case_type:\s*null/);
  });
});
