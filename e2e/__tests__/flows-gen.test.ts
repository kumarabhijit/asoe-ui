// Drift test: the committed e2e/flows-generated/ tree must
// match what flows-gen.ts would produce from the current
// e2e/flows/ YAMLs.
//
// Phase 7b. Locks the commit-time invariant: a YAML edit
// without a corresponding flows:gen run fails CI loudly. The
// alternative (running flows:gen as part of every CI build and
// not committing the output) would hide the diff from PR
// reviewers; we keep generated specs in the repo for
// transparency (decision A1 / CMT-1 mitigation).
//
// Update path:
//   1. Edit a flow YAML.
//   2. Run `npm run flows:gen`.
//   3. Commit the resulting e2e/flows-generated/ diff alongside
//      the YAML.
//
// The pre-commit hook (Phase 7c) automates step 2.

import { describe, expect, it } from "vitest";
import { generateAll, readCurrentTree, diffTree } from "../flows-gen";

describe("flows:gen drift test (Phase 7b)", () => {
  it("e2e/flows-generated/ matches the generator output", () => {
    const specs = generateAll();
    const current = readCurrentTree();
    const diffs = diffTree(specs, current);
    if (diffs.length > 0) {
      throw new Error(
        "e2e/flows-generated/ is out of sync with e2e/flows/.\n" +
          "Run `npm run flows:gen` and commit the diff.\n\n" +
          diffs.map((d) => "  " + d).join("\n"),
      );
    }
  });

  it("generator produces one spec per non-underscore flow YAML", () => {
    const specs = generateAll();
    expect(specs.length).toBeGreaterThan(0);
    // All generated paths must end in .spec.ts.
    for (const s of specs) {
      expect(s.outPath.endsWith(".spec.ts")).toBe(true);
    }
  });

  it("every generated spec carries the DO NOT EDIT header", () => {
    const specs = generateAll();
    for (const s of specs) {
      expect(s.spec).toMatch(/^\/\/ AUTO-GENERATED/);
      expect(s.spec).toContain("DO NOT EDIT");
    }
  });
});
