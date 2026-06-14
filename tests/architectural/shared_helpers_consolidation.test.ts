/**
 * Phase 3 — shared-helper consolidation lock.
 *
 * Several formatters and the label/value `Field` renderer had drifted
 * into multiple verbatim copies across the enrichment sections. They
 * were collapsed onto single sources of truth:
 *   - currency  → `fmtMoney` / `fmtMoneyRounded`  (src/lib/format.ts)
 *   - timestamp → `formatTimestamp`               (src/lib/format.ts)
 *   - node id   → `humanizeNodeId`                (src/lib/format.ts)
 *   - field UI  → `Field` / `FieldLabel`          (app/exceptions/shared.tsx)
 *   - HealthResponse type → the rich interface in src/types/exceptions.ts
 *     (the generated-alias duplicate in contracts.ts was removed)
 *
 * This source-grep lock fails the build if any local copy is
 * re-introduced during a refactor. PipelineDAG's null-eliding `Field`
 * and ProvenanceCard's `Row` are intentionally distinct and are NOT
 * covered here. Rendering behaviour is covered by the section tests
 * (tests/components/*, tests/accessibility/inbox_sections_sweep.test.tsx).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const src = (rel: string) =>
  readFileSync(path.resolve(__dirname, "../../", rel), "utf-8");

const SECTION_FILES = [
  "src/app/exceptions/Edi850Section.tsx",
  "src/app/exceptions/ChangeAnalysisSection.tsx",
  "src/app/exceptions/OrderEntrySection.tsx",
  "src/app/exceptions/SapDataSection.tsx",
  "src/app/exceptions/EmailSourceSection.tsx",
  "src/app/exceptions/DraftReplySection.tsx",
];

describe("Phase 3 — no re-introduced local formatUsd", () => {
  for (const f of SECTION_FILES) {
    it(`${f} has no local formatUsd`, () => {
      expect(
        /function formatUsd\b/.test(src(f)),
        `${f} must use fmtMoney / fmtMoneyRounded from @/lib/format, not a local formatUsd`,
      ).toBe(false);
    });
  }
});

describe("Phase 3 — no re-introduced local Field / FieldLabel", () => {
  for (const f of SECTION_FILES) {
    it(`${f} has no local Field / FieldLabel`, () => {
      const s = src(f);
      expect(
        /function Field\b/.test(s) || /function FieldLabel\b/.test(s),
        `${f} must import Field / FieldLabel from ./shared`,
      ).toBe(false);
    });
  }

  it("the canonical Field + FieldLabel live in shared.tsx", () => {
    const s = src("src/app/exceptions/shared.tsx");
    expect(/export function Field\b/.test(s)).toBe(true);
    expect(/export function FieldLabel\b/.test(s)).toBe(true);
  });
});

describe("Phase 3 — formatTimestamp / humanizeNode consolidated", () => {
  it("DraftReplySection has no local formatTimestamp", () => {
    expect(
      /function formatTimestamp\b/.test(src("src/app/exceptions/DraftReplySection.tsx")),
      "DraftReplySection must use formatTimestamp from @/lib/format",
    ).toBe(false);
  });

  it("AgentReasoningCard has no local humanizeNode", () => {
    expect(
      /function humanizeNode\b/.test(src("src/components/ui/AgentReasoningCard.tsx")),
      "AgentReasoningCard must use humanizeNodeId from @/lib/format",
    ).toBe(false);
  });
});

describe("Phase 3 — single HealthResponse definition", () => {
  it("contracts.ts no longer aliases HealthResponse", () => {
    expect(
      /HealthResponse\s*=\s*components\["schemas"\]\["HealthResponse"\]/.test(
        src("src/types/contracts.ts"),
      ),
      "the dead HealthResponse alias must stay removed from contracts.ts — the canonical is the rich interface in types/exceptions.ts",
    ).toBe(false);
  });

  it("the canonical HealthResponse interface lives in exceptions.ts", () => {
    expect(
      /export interface HealthResponse\b/.test(src("src/types/exceptions.ts")),
    ).toBe(true);
  });
});
