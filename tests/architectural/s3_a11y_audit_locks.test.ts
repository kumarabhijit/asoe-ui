/**
 * S3 sprint 2026-05-29 — accessibility-hardening source locks.
 *
 * The behavioural tests for SlaBandAnnouncer and
 * useFocusRestoreOnClose live alongside the primitives they test;
 * this lock is the "the wiring stayed wired" cheap canary.
 *
 * If a maintainer removes the SlaBandAnnouncer mount on
 * CaseDetailPanel or the useFocusRestoreOnClose call inside
 * ActionButtonMatrix / HotkeyCheatsheet, the runtime tests above
 * remain green (they exercise the primitive in isolation), but
 * the workspace surface goes silent again. These greps catch the
 * silent regression.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const CASE_DETAIL_PATH = path.resolve(
  __dirname,
  "../../src/app/cases/CaseDetailPanel.tsx",
);
const HOTKEY_CHEAT_PATH = path.resolve(
  __dirname,
  "../../src/components/ui/HotkeyCheatsheet.tsx",
);
const ACTION_MATRIX_PATH = path.resolve(
  __dirname,
  "../../src/components/ui/ActionButtonMatrix.tsx",
);

describe("S3 — SLA band announcer wiring (#B)", () => {
  it("CaseDetailPanel mounts SlaBandAnnouncer with the live sla snapshot", () => {
    const src = readFileSync(CASE_DETAIL_PATH, "utf-8");
    expect(
      /<SlaBandAnnouncer\s+sla=\{sla\}\s+caseId=\{orderCase\.case_id\}\s*\/>/.test(
        src,
      ),
      "CaseDetailPanel must mount <SlaBandAnnouncer sla={sla} caseId={orderCase.case_id} /> so screen-reader users hear band transitions",
    ).toBe(true);
  });
});

describe("S3 — focus restore on dialog close (#C)", () => {
  it("HotkeyCheatsheet calls useFocusRestoreOnClose with its `open` state", () => {
    const src = readFileSync(HOTKEY_CHEAT_PATH, "utf-8");
    expect(
      /useFocusRestoreOnClose\(open\)/.test(src),
      "HotkeyCheatsheet must call useFocusRestoreOnClose(open) so focus returns to the operator's prior position when the overlay closes",
    ).toBe(true);
  });

  it("ActionButtonMatrix calls useFocusRestoreOnClose for the comment swap", () => {
    const src = readFileSync(ACTION_MATRIX_PATH, "utf-8");
    expect(
      /useFocusRestoreOnClose\(pendingAction !== null\)/.test(src),
      "ActionButtonMatrix must call useFocusRestoreOnClose(pendingAction !== null) so the action button regains focus after the comment swap closes",
    ).toBe(true);
  });
});

describe("S3 — last-activity announcement silence (#E)", () => {
  it("both Last activity spans declare aria-live=off explicitly", () => {
    const src = readFileSync(CASE_DETAIL_PATH, "utf-8");
    // Two JSX occurrences (slim + full header). Restricting to the
    // attribute form on its own line excludes the JSDoc comments
    // that mention the rule.
    const matches = src.match(/^\s*aria-live="off"\s*$/gm) ?? [];
    expect(
      matches.length,
      "CaseDetailPanel must declare aria-live=\"off\" on both Last activity spans (slim + full header) so the per-minute ticker re-renders do not narrate",
    ).toBe(2);
  });
});

describe("S3 — visible required indicator on mandatory reason tag (#G)", () => {
  it("ActionButtonMatrix renders an aria-hidden asterisk on the reason-category label", () => {
    const src = readFileSync(ACTION_MATRIX_PATH, "utf-8");
    // The asterisk is the visible required cue for sighted/low-
    // vision operators; aria-hidden keeps the SR contract on the
    // existing aria-required+`(mandatory)` parenthetical.
    expect(
      /<span aria-hidden className="text-error[^"]*">\*<\/span>/.test(src),
      "ActionButtonMatrix must render an aria-hidden, error-colored asterisk on the Reason category label when the tag is required",
    ).toBe(true);
  });
});
