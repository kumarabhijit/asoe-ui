// Item 16 — journey × arc coverage report unit tests.
//
// Asserts that the coverage-report script renders the expected
// matrix shape against the current flow YAMLs. The script is
// the observability counterpart of the journey-coverage meta-
// test (vitest gates correctness; the report communicates state
// to humans).
import { describe, expect, it } from "vitest";
import { render } from "../../scripts/coverage-report";

describe("coverage-report", () => {
  it("emits a row for every enforced journey", () => {
    const { md } = render();
    for (const journey of ["J1", "J2", "J3", "J4", "J5"]) {
      expect(md).toMatch(new RegExp(`\\| ${journey} \\|`));
    }
  });

  it("counts the gaps correctly (J3 task-completion + J4 + J5 = 5 cells today)", () => {
    const { gaps } = render();
    // Today: J1×{both} covered live; J2×{both} covered live;
    // J3×{orientation} covered live. J3×{task-completion} was
    // covered by the case ↔ exception round-trip flow until
    // S15a retired /exceptions/[id]; uncovered until a
    // case-centric replacement flow lands. J4×{both} and
    // J5×{both} are empty.
    expect(gaps).toBe(5);
  });

  it("emits a flow tally line", () => {
    const { md } = render();
    expect(md).toMatch(/\*\*Flows:\*\* \d+ live, \d+ skipped/);
  });

  it("emits a legend explaining ✅ ⏸ ❌ glyphs", () => {
    const { md } = render();
    expect(md).toContain("✅");
    expect(md).toContain("❌");
    // The ⏸ glyph appears in the legend even when no flow is
    // currently skipped (the rendering preserves the symbol so
    // reviewers know what to look for next time).
    expect(md).toContain("⏸");
  });
});
