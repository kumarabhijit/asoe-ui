/**
 * S2 sprint 2026-05-28 — hotkey registry source-grep lock.
 *
 * The registry at `src/lib/hotkeys.ts` is the single source of truth
 * for the keyboard contract. Two consumers must keep referencing it
 * by id:
 *
 *   1. `ActionButtonMatrix.tsx` — listener bindings for the ribbon.
 *   2. `HotkeyCheatsheet.tsx` — renders the table.
 *
 * If a maintainer deletes a row from `HOTKEYS` and the listener
 * stops mentioning it, the runtime tests would catch the missing
 * behaviour — but if a maintainer ADDS a row to the listener
 * without updating the registry, runtime tests have no signal.
 * This source lock enforces the symmetry.
 *
 * Pairs with:
 *   * `tests/hooks/useHotkeys.test.ts` — listener contract.
 *   * `tests/components/HotkeyCheatsheet.test.tsx` — render contract.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { HOTKEYS } from "@/lib/hotkeys";

const ACTION_MATRIX_PATH = path.resolve(
  __dirname,
  "../../src/components/ui/ActionButtonMatrix.tsx",
);
const CHEATSHEET_PATH = path.resolve(
  __dirname,
  "../../src/components/ui/HotkeyCheatsheet.tsx",
);
const CASES_PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/cases/page.tsx",
);

describe("S2 hotkey registry — single source of truth", () => {
  it("registry contains every binding the S2 punch list promised", () => {
    // If any of these disappear from the registry, the audit
    // promised in PR #208's follow-up will silently regress.
    const required = [
      "global.cheatsheet",
      "ribbon.approve",
      "ribbon.reject",
      "ribbon.override",
      "ribbon.escalate",
      "ribbon.reanalyze",
      "comment.submit",
    ];
    const ids = new Set(HOTKEYS.map((h) => h.id));
    for (const id of required) {
      expect(ids.has(id), `registry must keep id "${id}"`).toBe(true);
    }
  });

  it("`?` cheatsheet binding requires Shift (documentation invariant)", () => {
    const cheat = HOTKEYS.find((h) => h.id === "global.cheatsheet");
    expect(cheat).toBeDefined();
    expect(cheat!.requiresShift).toBe(true);
  });

  it("ribbon bindings have no modifier — bare letters", () => {
    for (const id of [
      "ribbon.approve",
      "ribbon.reject",
      "ribbon.override",
      "ribbon.escalate",
      "ribbon.reanalyze",
    ]) {
      const h = HOTKEYS.find((x) => x.id === id);
      expect(h, `binding ${id} missing`).toBeDefined();
      expect(h!.requiresShift).toBeFalsy();
      expect(h!.requiresMeta).toBeFalsy();
      expect(h!.requiresCtrl).toBeFalsy();
    }
  });

  it("ActionButtonMatrix references the registry by id (not hardcoded keys)", () => {
    const src = readFileSync(ACTION_MATRIX_PATH, "utf-8");
    for (const id of [
      "ribbon.approve",
      "ribbon.reject",
      "ribbon.override",
      "ribbon.escalate",
      "ribbon.reanalyze",
    ]) {
      expect(
        src.includes(`getHotkey("${id}")`),
        `ActionButtonMatrix must read ribbon binding "${id}" from the registry (use getHotkey("${id}").key — not a hardcoded literal)`,
      ).toBe(true);
    }
  });

  it("HotkeyCheatsheet imports the registry as the render source", () => {
    const src = readFileSync(CHEATSHEET_PATH, "utf-8");
    expect(
      /import\s*{[^}]*HOTKEYS[^}]*}\s*from\s*"@\/lib\/hotkeys"/.test(src),
      "HotkeyCheatsheet must import HOTKEYS from the registry — the rendered list cannot diverge from the listener bindings",
    ).toBe(true);
  });

  it("/cases page mounts HotkeyCheatsheet exactly once", () => {
    const src = readFileSync(CASES_PAGE_PATH, "utf-8");
    const matches = src.match(/<HotkeyCheatsheet\s*\/>/g);
    expect(matches?.length ?? 0).toBe(1);
  });
});
