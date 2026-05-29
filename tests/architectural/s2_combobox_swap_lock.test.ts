/**
 * S2 sprint follow-up #6 — OverrideChooserDialog Combobox swap.
 *
 * The native `<select>` elements for "Resolution action" and
 * "Override reason category" are now `<Combobox>` mounts. The
 * Combobox primitive is intent-agnostic — vocabularies still flow
 * through `allowedActions` / `allowedReasonTags` props (Guardrail
 * #2). This source-grep lock prevents the silent re-introduction of
 * a native `<select>` by a maintainer who reverts a portion of the
 * swap during a refactor; behavioural coverage lives in the e2e
 * suites (`tests/browser/*.spec.ts`, `tests/browser-mock/*.spec.ts`)
 * which all switched to the new typeahead interaction.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const OVERRIDE_DIALOG_PATH = path.resolve(
  __dirname,
  "../../src/app/exceptions/OverrideChooserDialog.tsx",
);
const COMBOBOX_PATH = path.resolve(
  __dirname,
  "../../src/components/ui/Combobox.tsx",
);

describe("S2 #6 — Combobox in OverrideChooserDialog", () => {
  const src = readFileSync(OVERRIDE_DIALOG_PATH, "utf-8");

  it("renders both pickers via Combobox (not a native <select>)", () => {
    // Two Combobox mounts: one for Action, one for Reason category.
    const mounts = src.match(/<Combobox\b/g) ?? [];
    expect(
      mounts.length,
      "OverrideChooserDialog must mount exactly two <Combobox> components (Action + Reason)",
    ).toBe(2);
    // The native <select> must be gone — a stray `<select>` indicates
    // a partial revert.
    expect(
      /<select\b/.test(src),
      "no <select> tag should survive in OverrideChooserDialog after the S2 #6 swap",
    ).toBe(false);
  });

  it("the Action Combobox carries the canonical aria-label", () => {
    expect(
      /ariaLabel="Resolution action"/.test(src),
      "the action picker must keep its 'Resolution action' aria-label so existing operator muscle memory + the test helper continue to work",
    ).toBe(true);
  });

  it("the Reason Combobox carries the canonical aria-label", () => {
    expect(
      /ariaLabel="Override reason category"/.test(src),
      "the reason picker must keep its 'Override reason category' aria-label",
    ).toBe(true);
  });

  it("groups are passed when intent-cluster mapping exists", () => {
    // Cluster grouping is the dialog's old optgroup behaviour
    // (ADR-033 §D). The swap must keep this — without it, intents
    // with curated vocabularies would lose their grouped UI.
    expect(
      /groups=\{reasonGroups/.test(src),
      "Reason Combobox must pass `groups` derived from clustersForIntent",
    ).toBe(true);
  });
});


describe("S2 #6 — Combobox primitive built on cmdk", () => {
  const src = readFileSync(COMBOBOX_PATH, "utf-8");

  it("imports Command from cmdk (the typeahead engine)", () => {
    expect(
      /import\s*{[^}]*Command[^}]*}\s*from\s*"cmdk"/.test(src),
      "Combobox must source its filter + keyboard-nav contract from cmdk",
    ).toBe(true);
  });

  it("trigger declares role=combobox + aria-expanded + aria-haspopup=listbox", () => {
    // APG combobox shape — the test helper relies on this role to
    // find the trigger; a future refactor must preserve the contract.
    expect(/role="combobox"/.test(src)).toBe(true);
    expect(/aria-expanded=/.test(src)).toBe(true);
    expect(/aria-haspopup="listbox"/.test(src)).toBe(true);
  });

  it("declares zero enum literals — vocabularies flow through props", () => {
    // Guardrail #2 — primitive must not embed any domain literal.
    // We grep for the project's well-known reason / action codes;
    // their presence would be a regression.
    for (const literal of [
      "ALLOW_BOTH",
      "SUPERSEDE",
      "REJECT",
      "BAND_REVIEW_OVERRIDDEN",
      "CUSTOMER_CONCESSION_LOW",
    ]) {
      expect(
        src.includes(literal),
        `Combobox must not hardcode the "${literal}" enum literal (Guardrail #2)`,
      ).toBe(false);
    }
  });
});
