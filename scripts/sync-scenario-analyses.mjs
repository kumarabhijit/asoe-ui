#!/usr/bin/env node
// Syncs the asoe2 scenario ANALYSIS fixture into a COMMITTED snapshot here.
//
// Sibling to sync-scenario-catalog.mjs. Cross-repo boundary (CLAUDE.md
// Guardrail #2): this sync step is the ONLY place that reads across repos for
// the analysis fixture. It reads the sibling checkout
//   ../asoe2/fixtures/scenarios/analyses.yaml
// and writes the vendored snapshot
//   tests/contract/snapshots/scenario_analyses.yaml
// The emitter (scripts/gen-scenario-analyses.ts) and the Vercel/CI build read
// ONLY that committed snapshot — never ../asoe2 — so the build works where
// asoe2 isn't present.
//
// Usage:
//   npm run sync:scenario-analyses          # refresh snapshot from sibling
//   npm run verify:scenario-analyses        # regenerate mocks + diff (drift gate)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SIBLING = resolve(REPO_ROOT, "..", "asoe2");
const SOURCE = resolve(SIBLING, "fixtures", "scenarios", "analyses.yaml");
const SNAPSHOT = resolve(REPO_ROOT, "tests/contract/snapshots/scenario_analyses.yaml");

if (!existsSync(SIBLING)) {
  console.error(
    `[sync-scenario-analyses] sibling checkout not found at ${SIBLING}.\n` +
    "Clone kumarabhijit/asoe2 as a sibling working tree, then re-run.",
  );
  process.exit(1);
}
if (!existsSync(SOURCE)) {
  console.error(
    `[sync-scenario-analyses] ${SOURCE} missing.\n` +
    "Author fixtures/scenarios/analyses.yaml in asoe2 first.",
  );
  process.exit(1);
}

const raw = readFileSync(SOURCE, "utf-8");
const banner =
  "# COMMITTED SNAPSHOT — do not edit by hand.\n" +
  "# Source: ../asoe2/fixtures/scenarios/analyses.yaml\n" +
  "# Refresh with: npm run sync:scenario-analyses\n" +
  "# The emitter reads THIS file (never ../asoe2) so the build is\n" +
  "# self-contained where asoe2 is absent (Vercel / CI).\n" +
  "#\n";

mkdirSync(dirname(SNAPSHOT), { recursive: true });
writeFileSync(SNAPSHOT, banner + raw, "utf-8");
console.log(`[sync-scenario-analyses] wrote ${SNAPSHOT} (${raw.length} bytes from sibling)`);
