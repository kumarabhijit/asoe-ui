#!/usr/bin/env tsx
/**
 * Generate mock OrderAnalysis fixtures from the committed scenario-analysis
 * snapshot.
 *
 * Sibling to gen-mock-data.ts (which projects the catalog onto
 * ExceptionSummary rows). This emitter reads ONLY the committed snapshot
 *   tests/contract/snapshots/scenario_analyses.yaml
 * (never ../asoe2 — that cross-repo read lives in sync-scenario-analyses.mjs)
 * and emits
 *   src/lib/mock-data/__generated__/scenario_analyses.ts
 *
 * Unlike the catalog artifact, this module IS consumed by the app:
 * src/lib/mock-data/order-analyses.ts spreads SCENARIO_ANALYSES into
 * MOCK_ORDER_ANALYSES, so the migrated intent families (slice 1:
 * PRICE_HOLD_RELEASE, exc-017/exc-018) are sourced from the asoe2 fixture
 * rather than hand-authored inline. The byte-level drift gate is
 * `npm run verify:scenario-analyses`.
 *
 * The fixture carries the recipe/composer projection only; the runtime
 * `primary_section` presentation hint is stamped by order-analyses.ts
 * (mirroring the backend read path), so it is intentionally absent here.
 *
 * Run: npm run gen:scenario-analyses
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SNAPSHOT = resolve(REPO_ROOT, "tests/contract/snapshots/scenario_analyses.yaml");
const OUT = resolve(REPO_ROOT, "src/lib/mock-data/__generated__/scenario_analyses.ts");

interface AnalysesFile {
  version?: number;
  analyses: Record<string, Record<string, unknown>>;
}

function main(): void {
  const file = parse(readFileSync(SNAPSHOT, "utf-8")) as AnalysesFile;
  const analyses = file.analyses ?? {};

  // Stable key order so the emitted file is deterministic (the verify gate
  // diffs the output).
  const sorted: Record<string, unknown> = {};
  for (const id of Object.keys(analyses).sort()) {
    sorted[id] = analyses[id];
  }
  const count = Object.keys(sorted).length;

  const body = [
    "// AUTO-GENERATED — do not edit by hand.",
    "// Source: tests/contract/snapshots/scenario_analyses.yaml",
    "//          (synced from ../asoe2/fixtures/scenarios/analyses.yaml)",
    "// Regenerate with: npm run gen:scenario-analyses",
    "//",
    "// CONSUMED by the app: src/lib/mock-data/order-analyses.ts spreads",
    "// SCENARIO_ANALYSES into MOCK_ORDER_ANALYSES. Migrated intent families",
    "// are sourced here instead of hand-authored inline. The `primary_section`",
    "// presentation hint is stamped at runtime by order-analyses.ts (mirroring",
    "// the backend read path), so it is intentionally absent from this fixture.",
    "",
    'import type { OrderAnalysis } from "@/types/exceptions";',
    "",
    `export const SCENARIO_ANALYSES: Record<string, OrderAnalysis> = ${JSON.stringify(sorted, null, 2)};`,
    "",
    `export const SCENARIO_ANALYSIS_COUNT = ${count} as const;`,
    "",
  ].join("\n");

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, body, "utf-8");
  console.log(`[gen-scenario-analyses] wrote ${OUT} (${count} projected analyses)`);
}

main();
