/**
 * Architectural lock (Pattern A) — the Customer Inbox lens deliverable.
 *
 * Post Case & Intent Super-Group pivot the lens is the CUSTOMER-origin
 * slice of /cases (requirements §3 / §4 Q7). The visible chrome — the
 * "Customer Inbox" label on the origin chip — is the partner-facing
 * commitment; the underlying field flipped from CaseType=EMAIL_ENTRY
 * to Origin=CUSTOMER but the label MUST NOT.
 *
 * Behavioural tests can't catch "the chip was supposed to ship but
 * wasn't built", so this asserts the source structure. Pairs with the
 * Playwright operator-journey (Pattern B) in
 * tests/browser/cases-workspace-inbox-lens.spec.ts (CLAUDE.md:
 * state-machine surfaces require BOTH).
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

const CHROME = readFileSync(
  join(__dirname, "..", "..", "src", "app", "cases", "caseChrome.tsx"),
  "utf-8",
);

describe("Customer Inbox lens deliverable (page.tsx)", () => {
  it("renders a 'Customer Inbox' label as the visible partner chrome", () => {
    // The label lives on ORIGIN_LABEL["CUSTOMER"] (per requirements
    // §4 Q7 — keep the visible chrome stable through the pivot).
    // Phase 3 consolidation: the map moved to the shared caseChrome
    // module; the page must still consume it for the chip label.
    expect(CHROME).toMatch(/CUSTOMER:\s*"Customer Inbox"/);
    expect(PAGE).toMatch(/ORIGIN_LABEL\[/);
  });

  it("the lens value is the typed CUSTOMER origin (no bare literal in JSX)", () => {
    expect(PAGE).toContain('const INBOX_LENS_ORIGIN: Origin = "CUSTOMER"');
    expect(PAGE).toContain("filters.origin === INBOX_LENS_ORIGIN");
  });

  it("the filter is threaded into useCases via the origin argument", () => {
    expect(PAGE).toMatch(/useCases\(filters\.origin\s*\?\?\s*undefined/);
  });

  it("CasesFilters carries the origin axis (case_type retired)", () => {
    expect(PAGE).toMatch(/origin:\s*Origin\s*\|\s*null/);
    expect(PAGE).not.toMatch(/case_type:\s*CaseType/);
  });

  it("'All' clears the lens (resets origin to null)", () => {
    expect(PAGE).toMatch(/origin:\s*null/);
  });
});
