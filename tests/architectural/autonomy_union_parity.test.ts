/**
 * Autonomy-union parity gate (ADR-042 Phase-0; panel 2026-05-24).
 *
 * `openapi_drift.test.ts` proves `generated.ts` is fresh vs the backend
 * schema, but nothing asserts the HAND-WRITTEN `src/types/exceptions.ts`
 * `*AnalysisData` interfaces match `generated.ts` — so the
 * `EmailOrderEntryAnalysisData.autonomy_level` drift (hand-written L1–L3 vs
 * generated L1–L4) was invisible. This locks per-type parity.
 *
 * Per-type by design (NOT a blanket widen): EDI-mismatch is L1–L3; only
 * email-order-entry carries the L4 (full-autonomy) tier. Widening EDI to L4
 * would mask a real backend distinction and must fail here too.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const EXCEPTIONS = readFileSync(
  join(__dirname, "..", "..", "src", "types", "exceptions.ts"),
  "utf-8",
);
const GENERATED = readFileSync(
  join(__dirname, "..", "..", "src", "types", "generated.ts"),
  "utf-8",
);

/** Extract the sorted `autonomy_level` union literals declared inside the
 *  first `interface <Name>` / `<Name>: {` block in `source`. */
function autonomyUnion(source: string, typeName: string): string[] {
  const start = source.search(
    new RegExp(String.raw`(interface\s+${typeName}\b|\b${typeName}\s*:\s*\{)`),
  );
  if (start < 0) throw new Error(`type ${typeName} not found`);
  const m = source.slice(start).match(/autonomy_level\??:\s*([^;]+);/);
  if (!m) throw new Error(`autonomy_level not found in ${typeName}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
}

describe("autonomy_level union parity (exceptions.ts ↔ generated.ts)", () => {
  it("EmailOrderEntryAnalysisData matches the generated contract", () => {
    expect(autonomyUnion(EXCEPTIONS, "EmailOrderEntryAnalysisData")).toEqual(
      autonomyUnion(GENERATED, "EmailOrderEntryAnalysisData"),
    );
  });

  it("EdiMismatchAnalysisData matches the generated contract", () => {
    expect(autonomyUnion(EXCEPTIONS, "EdiMismatchAnalysisData")).toEqual(
      autonomyUnion(GENERATED, "EdiMismatchAnalysisData"),
    );
  });

  it("order-entry carries L4 but EDI-mismatch does not (no blanket widen)", () => {
    expect(autonomyUnion(EXCEPTIONS, "EmailOrderEntryAnalysisData")).toContain("L4");
    expect(autonomyUnion(EXCEPTIONS, "EdiMismatchAnalysisData")).not.toContain("L4");
  });
});
