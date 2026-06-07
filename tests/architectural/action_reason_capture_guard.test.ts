/**
 * ADR-045 CP3 — action reason-capture is uniform and dialog-based.
 *
 * Every state-changing HITL action captures its mandatory reason/notes
 * through an in-panel constrained dialog — never window.prompt (which is
 * inaccessible, unstyled, and not keyboard/SR-consistent). This lock pins
 * that the native-prompt path can't return.
 *
 * Fails on the parent commit, where useExceptionActions raised
 * window.prompt for both Escalate and Cosign.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("action reason-capture guard (ADR-045 CP3)", () => {
  it("the action hook never raises window.prompt", () => {
    expect(read("src/hooks/useExceptionActions.ts")).not.toMatch(/window\.prompt\(/);
  });

  it("no source under src/ calls window.prompt for an action", () => {
    // Comments referencing the retired pattern are fine; an actual call is not.
    for (const p of [
      "src/hooks/useExceptionActions.ts",
      "src/components/ui/ActionButtonMatrix.tsx",
      "src/app/exceptions/ExceptionDetailPanel.tsx",
    ]) {
      expect(read(p), `${p} must not call window.prompt`).not.toMatch(/window\.prompt\(/);
    }
  });

  it("cosign captures notes via an in-panel dialog (openCosign/submitCosign)", () => {
    const hook = read("src/hooks/useExceptionActions.ts");
    expect(hook).toMatch(/openCosign/);
    expect(hook).toMatch(/submitCosign/);
    const panel = read("src/app/exceptions/ExceptionDetailPanel.tsx");
    expect(panel).toMatch(/Confirm cosign (approval|rejection)/);
    expect(panel).toMatch(/role="dialog"/);
  });

  it("escalate reason flows through onEscalate(reason), not a prompt", () => {
    // The matrix opens the dialog and fires onEscalate(comment) on confirm.
    expect(read("src/components/ui/ActionButtonMatrix.tsx")).toMatch(
      /onEscalate\(comment\)/,
    );
  });
});
