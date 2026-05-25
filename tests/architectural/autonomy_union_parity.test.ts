/**
 * Autonomy-union parity gate (ADR-042 Phase-0; panel 2026-05-24).
 *
 * `openapi_drift.test.ts` proves `generated.ts` is fresh vs the backend
 * schema, but nothing asserts the HAND-WRITTEN `src/types/exceptions.ts`
 * `*AnalysisData` interfaces match `generated.ts` — so the
 * `EmailOrderEntryAnalysisData.autonomy_level` drift (hand-written L1–L3 vs
 * generated L1–L4) was invisible. This locks per-type parity.
 *
 * Parity is exact, never an arbitrary widen — the hand-written union must
 * equal the generated one literal-for-literal. Under autonomy vocab v2
 * (ADR-042 §5) both EDI-mismatch and email-order-entry span L1–L4: EDI's
 * SHIP_TO_MISMATCH escalates to human (v2 L4). The parity assertions below are
 * the guard against a hand-written type drifting from the backend contract.
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

  it("both EDI-mismatch and order-entry carry L4 under vocab v2", () => {
    // v2 (ADR-042 §5): EDI SHIP_TO_MISMATCH escalates to human (L4); order
    // entry's REJECT/ESCALATE/LOW_CONFIDENCE_FLAG also land at L4.
    expect(autonomyUnion(EXCEPTIONS, "EmailOrderEntryAnalysisData")).toContain("L4");
    expect(autonomyUnion(EXCEPTIONS, "EdiMismatchAnalysisData")).toContain("L4");
  });
});
