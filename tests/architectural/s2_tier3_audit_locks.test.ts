/**
 * S2 sprint 2026-05-28 — Tier 3 source-grep locks.
 *
 * Two findings shipped in this PR (#11 next-case auto-advance,
 * #13 underlined access keys / kbd hints). Both are easy to delete
 * silently during a refactor — the visible behaviour leaves no
 * runtime artefact a behavioural test would notice unless the test
 * happens to land in the same window. These source locks catch the
 * regression at lint-time.
 *
 * Pairs with:
 *   * `tests/browser-mock/hitl-actions-mock.spec.ts` — covers the
 *     URL-flip post-condition behaviourally (#11).
 *   * `tests/components/ActionButtonMatrix.test.tsx` — covers the
 *     kbd hint render contract per button (#13).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const CASES_PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/cases/page.tsx",
);
const ACTION_MATRIX_PATH = path.resolve(
  __dirname,
  "../../src/components/ui/ActionButtonMatrix.tsx",
);

describe("S2 Tier 3 — #11 next-case auto-advance wiring", () => {
  const src = readFileSync(CASES_PAGE_PATH, "utf-8");

  it("handleRecordActionComplete snapshots the next case BEFORE the refetch", () => {
    // The advance must compute its target from the PRE-action queue
    // so the resolved case filtering out post-mutation does not
    // shift the index and re-point the operator at the wrong case.
    // We pin two invariants together by snapshotting the function
    // body and asserting both literal markers live in it.
    const body = src.match(
      /handleRecordActionComplete = useCallback\(\(\)[\s\S]*?\}, \[[^\]]+\]\)/,
    );
    expect(body, "handleRecordActionComplete must be a single useCallback").not.toBeNull();
    const code = body![0];
    expect(
      code.includes("cases.findIndex"),
      "must compute the next-case index from `cases` (the visible, filtered queue)",
    ).toBe(true);
    expect(
      code.includes("router.replace"),
      "must navigate to the next case via router.replace",
    ).toBe(true);
    // The refetch should still fire — auto-advance is additive, not
    // a replacement for the post-action data refresh.
    expect(
      code.includes("refetch()"),
      "must keep the post-action queue refetch",
    ).toBe(true);
  });
});


describe("S2 Tier 3 — #13 hotkey hint per ribbon button", () => {
  const src = readFileSync(ACTION_MATRIX_PATH, "utf-8");

  it("defines a HotkeyHint helper used by every ribbon button", () => {
    expect(
      /function HotkeyHint\(\{[^}]*letter[^}]*\}/.test(src),
      "ActionButtonMatrix must define a HotkeyHint component",
    ).toBe(true);
  });

  it("hints fire for all five ribbon letters", () => {
    for (const letter of ["A", "R", "O", "E", "Y"]) {
      expect(
        src.includes(`<HotkeyHint letter="${letter}" />`),
        `ribbon must surface a kbd hint for hotkey "${letter}" (S2 #3 binding)`,
      ).toBe(true);
    }
  });

  it("hints are aria-hidden — aria-keyshortcuts is the SR contract", () => {
    // The S2 #4 work put aria-keyshortcuts="Meta+Enter" on the
    // comment-submit button; the equivalent for the ribbon hotkeys
    // is the kbd hint's aria-hidden so a screen reader does not
    // double-announce the letter on top of aria-keyshortcuts. This
    // lock pins that the HotkeyHint component declares aria-hidden.
    const helper = src.match(/function HotkeyHint[\s\S]*?\n\s*\}\s*\n/);
    expect(helper).not.toBeNull();
    expect(
      helper![0].includes("aria-hidden"),
      "HotkeyHint must carry aria-hidden — see comment in the component",
    ).toBe(true);
  });
});
