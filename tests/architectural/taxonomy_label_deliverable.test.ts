/**
 * ADR-045 CP1 deliverable-completeness lock (Pattern A, source-grep).
 *
 * The terminology-authority layer is consumed by leak-site rewires in a
 * later checkpoint, so a purely behavioural test can't yet catch "the
 * authority component was supposed to ship but wasn't built." This lock
 * asserts the expected structure exists: the pure resolvers, the hook, and
 * the `<TaxonomyLabel>` component with its `raw` audit-zone escape hatch.
 *
 * See asoe-ui/CLAUDE.md "Test strategy" Gap 7.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("ADR-045 terminology-authority deliverables", () => {
  it("ships the pure label resolvers", () => {
    const src = read("src/lib/taxonomy-labels.ts");
    expect(src).toContain("export function supergroupLabel");
    expect(src).toContain("export function intentLabel");
    expect(src).toContain("export function showsIntentQualifier");
  });

  it("ships the useDisplayLabel hook", () => {
    const src = read("src/hooks/useDisplayLabel.ts");
    expect(src).toContain("export function useDisplayLabel");
    expect(src).toContain("useHealth");
  });

  it("ships the TaxonomyLabel component with a raw audit-zone path", () => {
    const src = read("src/components/ui/TaxonomyLabel.tsx");
    expect(src).toContain("export function TaxonomyLabel");
    // The zone split: a `raw` prop renders the machine token verbatim for
    // the Diagnostics / audit surface.
    expect(src).toMatch(/raw\b/);
    expect(src).toContain("useDisplayLabel");
  });
});
