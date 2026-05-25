/**
 * CP-B RED gate (ADR-043 §2.2, decision D4) — the closed `supports_kind`
 * evidence vocabulary must match byte-for-byte across asoe2 (source of truth)
 * and asoe-ui, so adding a highlightable evidence kind is a backend-only change
 * the UI maps with a `default` fallback (Guardrail #2) — zero UI edits.
 *
 * Written test-first. Until the vocabulary lands at CP-C this assertion FAILS,
 * so it is wrapped in `it.fails` (the vitest analog of pytest xfail-strict): the
 * gate is green-and-honest while pending, and the moment both sides exist and
 * agree it PASSES -> `it.fails` turns red -> forcing a deliberate marker removal.
 *
 * Skipped when the sibling asoe2 checkout is absent (parity is only meaningful
 * with both repos present; CI provisions both).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../..");
const SIBLING_SCHEMAS = path.resolve(REPO_ROOT, "..", "asoe2", "api", "schemas.py");
const TS_TYPES = path.resolve(REPO_ROOT, "src/types/exceptions.ts");

describe("EvidenceSupportsKind closed-vocabulary parity (asoe2 <-> asoe-ui)", () => {
  if (!existsSync(SIBLING_SCHEMAS)) {
    it.skip("sibling asoe2 checkout missing — skipping parity check", () => {});
    return;
  }

  it("supports_kind members are identical across repos", () => {
    const py = readFileSync(SIBLING_SCHEMAS, "utf-8");
    const pyMatch = py.match(/EvidenceSupportsKind\s*=\s*Literal\[([\s\S]*?)\]/);
    expect(pyMatch, "asoe2 EvidenceSupportsKind Literal not found").not.toBeNull();
    const pyMembers = [...pyMatch![1].matchAll(/"([^"\\]+)"/g)]
      .map((m) => m[1])
      .sort();

    const ts = readFileSync(TS_TYPES, "utf-8");
    const tsMatch = ts.match(/export type EvidenceSupportsKind\s*=\s*([^;]+);/);
    expect(tsMatch, "asoe-ui EvidenceSupportsKind union not found").not.toBeNull();
    const tsMembers = [...tsMatch![1].matchAll(/["']([^"'\\]+)["']/g)]
      .map((m) => m[1])
      .sort();

    expect(tsMembers).toEqual(pyMembers);
  });
});
