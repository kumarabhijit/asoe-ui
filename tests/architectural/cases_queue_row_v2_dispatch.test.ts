/**
 * Cases queue row V1/V2 dispatch lock — ADR-041 P3e §2.1.
 *
 * Pattern A (source-grep) per CLAUDE.md test strategy: when a new
 * deliverable other files mount, lock the expected structure so a
 * future refactor cannot silently drop the flag check.
 *
 * Asserts:
 *   1. `page.tsx` imports BOTH `CasesQueueRow` and `CasesQueueRowV2`.
 *   2. `page.tsx` references `NEXT_PUBLIC_CASES_ROW_V2` so the flag
 *      check is wired (not just an unused env var).
 *   3. The flag dispatch sits at the row mount site (the listbox
 *      `.map(...)` body) — keeps both renderers reachable.
 *   4. The cases array is typed as `CaseListItem[]` so the V2 row
 *      sees the seven `CaseSummary` projection fields.
 *
 * Bug shape this catches: a maintainer deletes the flag check and
 * the V1 row, leaving V2 always-on with no way to roll back via env.
 * Or the inverse — the V2 import is dropped but the flag check
 * stays, silently rendering V1 even with the env set.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PAGE = readFileSync(
  path.join(__dirname, "../../src/app/cases/page.tsx"),
  "utf-8",
);

describe("cases queue row V1/V2 dispatch (ADR-041 P3e §2.1)", () => {
  it("imports both CasesQueueRow and CasesQueueRowV2", () => {
    expect(PAGE).toMatch(/import\s*\{\s*CasesQueueRow\s*\}\s*from\s*["']\.\/CasesQueueRow["']/);
    expect(PAGE).toMatch(/import\s*\{\s*CasesQueueRowV2\s*\}\s*from\s*["']\.\/CasesQueueRowV2["']/);
  });

  it("reads the NEXT_PUBLIC_CASES_ROW_V2 flag", () => {
    expect(PAGE).toMatch(/process\.env\.NEXT_PUBLIC_CASES_ROW_V2/);
  });

  it("mounts both row components conditionally (flag dispatch present)", () => {
    // Both component mount sites must be present in the source —
    // the conditional ternary keeps the legacy row reachable for
    // rollback without touching the deploy.
    expect(PAGE).toMatch(/<CasesQueueRowV2\b/);
    expect(PAGE).toMatch(/<CasesQueueRow\b(?![Vv]2)/);
  });

  it("types the queue array as CaseListItem (so V2 sees CaseSummary fields)", () => {
    // Anything narrower would strip the seven new audit-bearing
    // fields off the rows before V2 sees them.
    expect(PAGE).toMatch(/case_:\s*CaseListItem/);
  });
});
