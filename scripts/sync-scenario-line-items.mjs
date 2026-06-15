#!/usr/bin/env node
// Syncs the asoe2 scenario LINE-ITEM fixture into a COMMITTED snapshot here.
//
// Sibling to sync-scenario-analyses.mjs. Cross-repo boundary (CLAUDE.md
// Guardrail #2): this sync step is the ONLY place that reads across repos for
// the line-item fixture. It reads the sibling checkout
//   ../asoe2/fixtures/scenarios/line_items.yaml
// and writes the vendored snapshot
//   tests/contract/snapshots/scenario_line_items.yaml
// The emitter (scripts/gen-scenario-line-items.ts) and the Vercel/CI build
// read ONLY that committed snapshot — never ../asoe2 — so the build works
// where asoe2 isn't present.
//
// Usage:
//   npm run sync:scenario-line-items        # refresh snapshot from sibling
//   npm run verify:scenario-line-items      # regenerate mocks + diff (drift gate)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SIBLING = resolve(REPO_ROOT, "..", "asoe2");
const SOURCE = resolve(SIBLING, "fixtures", "scenarios", "line_items.yaml");
const SNAPSHOT = resolve(REPO_ROOT, "tests/contract/snapshots/scenario_line_items.yaml");

if (!existsSync(SIBLING)) {
  console.error(
    `[sync-scenario-line-items] sibling checkout not found at ${SIBLING}.\n` +
    "Clone kumarabhijit/asoe2 as a sibling working tree, then re-run.",
  );
  process.exit(1);
}
if (!existsSync(SOURCE)) {
  console.error(
    `[sync-scenario-line-items] ${SOURCE} missing.\n` +
    "Author fixtures/scenarios/line_items.yaml in asoe2 first.",
  );
  process.exit(1);
}

const raw = readFileSync(SOURCE, "utf-8");
const banner =
  "# COMMITTED SNAPSHOT — do not edit by hand.\n" +
  "# Source: ../asoe2/fixtures/scenarios/line_items.yaml\n" +
  "# Refresh with: npm run sync:scenario-line-items\n" +
  "# The emitter reads THIS file (never ../asoe2) so the build is\n" +
  "# self-contained where asoe2 is absent (Vercel / CI).\n" +
  "#\n";

mkdirSync(dirname(SNAPSHOT), { recursive: true });
writeFileSync(SNAPSHOT, banner + raw, "utf-8");
console.log(`[sync-scenario-line-items] wrote ${SNAPSHOT} (${raw.length} bytes from sibling)`);
