#!/usr/bin/env tsx
/**
 * Generate the mock line-item table from the committed scenario-line-item
 * snapshot.
 *
 * Sibling to gen-scenario-analyses.ts. This emitter reads ONLY the committed
 * snapshot
 *   tests/contract/snapshots/scenario_line_items.yaml
 * (never ../asoe2 — that cross-repo read lives in
 * sync-scenario-line-items.mjs) and emits
 *   src/lib/mock-data/__generated__/scenario_line_items.ts
 *
 * Consumed by the app: src/lib/api.ts serves `exceptionsApi.lineItems()`
 * from SCENARIO_LINE_ITEMS in mock mode (it stands in for the real
 * GET /api/v1/exceptions/{id}/line-items endpoint). The byte-level drift gate
 * is `npm run verify:scenario-line-items`.
 *
 * Run: npm run gen:scenario-line-items
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SNAPSHOT = resolve(REPO_ROOT, "tests/contract/snapshots/scenario_line_items.yaml");
const OUT = resolve(REPO_ROOT, "src/lib/mock-data/__generated__/scenario_line_items.ts");

interface LineItemsFile {
  version?: number;
  line_items: Record<string, Record<string, unknown>[]>;
}

function main(): void {
  const file = parse(readFileSync(SNAPSHOT, "utf-8")) as LineItemsFile;
  const rows = file.line_items ?? {};

  // Stable key order so the emitted file is deterministic (the verify gate
  // diffs the output).
  const sorted: Record<string, unknown> = {};
  for (const id of Object.keys(rows).sort()) {
    sorted[id] = rows[id];
  }
  const count = Object.keys(sorted).length;

  const body = [
    "// AUTO-GENERATED — do not edit by hand.",
    "// Source: tests/contract/snapshots/scenario_line_items.yaml",
    "//          (synced from ../asoe2/fixtures/scenarios/line_items.yaml)",
    "// Regenerate with: npm run gen:scenario-line-items",
    "//",
    "// CONSUMED by the app: src/lib/api.ts serves exceptionsApi.lineItems()",
    "// from SCENARIO_LINE_ITEMS in mock mode (the /exceptions/{id}/line-items",
    "// surface the EvidenceGrid renders).",
    "",
    'import type { LineItem } from "@/types/exceptions";',
    "",
    `export const SCENARIO_LINE_ITEMS: Record<string, LineItem[]> = ${JSON.stringify(sorted, null, 2)};`,
    "",
    `export const SCENARIO_LINE_ITEM_COUNT = ${count} as const;`,
    "",
  ].join("\n");

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, body, "utf-8");
  console.log(`[gen-scenario-line-items] wrote ${OUT} (${count} projected records)`);
}

main();
