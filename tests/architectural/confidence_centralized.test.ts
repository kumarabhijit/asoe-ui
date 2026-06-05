/**
 * Architectural lock (Pattern A) — confidence rendering is centralised.
 *
 * The trust review found four producers rendering confidence on two
 * scales (0–1 vs 0–100) with ad-hoc, inconsistent formatting. The fix is
 * a single canonical renderer (`ConfidenceDisplay`) backed by one
 * normalisation module (`src/lib/confidence.ts`). This lock keeps it that
 * way:
 *
 *   1. Every section/component that surfaces a confidence number imports
 *      ConfidenceDisplay.
 *   2. No section/component does inline `* 100` / `/ 100` confidence math
 *      — that arithmetic belongs in `src/lib/confidence.ts` only.
 *   3. The band stops live in the lib, not scattered in components.
 *
 * Verify by reverting any wired site to inline `Math.round(x * 100)` —
 * this must fail.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");

function read(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf-8");
}

/** Files that surface a confidence number and must delegate to the
 *  canonical renderer. */
const CONSUMER_FILES = [
  ["src", "components", "ui", "AgentReasoningCard.tsx"],
  ["src", "app", "exceptions", "EmailOrderEntrySection.tsx"],
  ["src", "app", "exceptions", "DuplicateDetectionSection.tsx"],
  ["src", "app", "exceptions", "EntitiesSection.tsx"],
  ["src", "app", "exceptions", "OrderEntrySection.tsx"],
] as const;

/** Inline confidence-percentage arithmetic. The `i` flag and the
 *  `confidence`-adjacency keep this from matching unrelated `* 100`
 *  (e.g. currency minor units). */
const INLINE_PCT_MATH =
  /confidence[^;\n]*\*\s*100|\*\s*100[^;\n]*confidence|confidence[^;\n]*\/\s*100/i;

describe("confidence rendering is centralised", () => {
  it("the canonical lib exports the normalisation + band API", () => {
    const lib = read("src", "lib", "confidence.ts");
    expect(lib).toContain("export function toCanonicalConfidence");
    expect(lib).toContain("export function confidenceBand");
    expect(lib).toContain("export const BAND_HIGH_MIN");
    expect(lib).toContain("export const BAND_REVIEW_MIN");
  });

  it("the canonical renderer exists and consumes the lib", () => {
    const comp = read("src", "components", "ui", "ConfidenceDisplay.tsx");
    expect(comp).toContain("from \"@/lib/confidence\"");
    expect(comp).toContain("export function ConfidenceDisplay");
  });

  it.each(CONSUMER_FILES.map((p) => [p.join("/"), p] as const))(
    "%s delegates to ConfidenceDisplay",
    (_label, parts) => {
      const src = read(...parts);
      expect(src).toContain("ConfidenceDisplay");
    },
  );

  it.each(CONSUMER_FILES.map((p) => [p.join("/"), p] as const))(
    "%s has no inline confidence-percentage math",
    (_label, parts) => {
      const src = read(...parts);
      expect(INLINE_PCT_MATH.test(src)).toBe(false);
    },
  );
});
