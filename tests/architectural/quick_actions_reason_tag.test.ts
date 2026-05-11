/**
 * Architectural lock: `useExceptionActions` must not hardcode a
 * `reason_tag` literal in its disposition payloads.
 *
 * Before S1 the quick-Approve / quick-Reject paths posted
 * `reason_tag: "other"` (lowercase). The 2026-05-10 panel-curated
 * vocabulary in `asoe2/constraints/specs.py` rejects that string for
 * every curated intent — the live HITL surface 422'd on every click.
 * The fix routes the value through `pickQuickActionReasonTag(intent,
 * health)` so the wire string is whatever the backend's
 * `useHealth().allowed_override_reason_tags_by_intent[intent]` says it
 * should be.
 *
 * This lock fails the build if the literal returns. A grep is enough
 * because there are exactly two callsites; the helper is the only way
 * to derive the value.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const HOOK_PATH = path.resolve(
  __dirname,
  "../../src/hooks/useExceptionActions.ts",
);

describe("useExceptionActions — no hardcoded reason_tag literal", () => {
  const src = readFileSync(HOOK_PATH, "utf-8");

  it("disposition calls do not pass a string-literal reason_tag", () => {
    // Match `reason_tag:` followed by a single- or double-quoted
    // literal. Allowed: `reason_tag: reasonTag`, `reason_tag:
    // overrideReasonTag`, etc.
    const literal = src.match(/reason_tag\s*:\s*["'][^"']+["']/g);
    expect(literal, `found literal reason_tag in ${HOOK_PATH}: ${JSON.stringify(literal)}`).toBeNull();
  });

  it("uses pickQuickActionReasonTag to resolve the quick-action tag", () => {
    expect(src).toMatch(/pickQuickActionReasonTag\s*\(/);
  });

  it("reads health via useHealth (no per-intent dispatch baked in)", () => {
    expect(src).toMatch(/useHealth\s*\(/);
  });
});
