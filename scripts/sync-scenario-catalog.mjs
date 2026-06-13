#!/usr/bin/env node
// Syncs the asoe2 scenario catalog into a COMMITTED snapshot in this repo.
//
// Cross-repo boundary (CLAUDE.md Guardrail #2 / RFC §1a.1): this sync step
// is the ONLY place that reads across repos. It reads the sibling checkout
// ../asoe2/fixtures/scenarios/catalog.yaml and writes the vendored snapshot
//   tests/contract/snapshots/scenario_catalog.yaml
// The mock generator (scripts/gen-mock-data.ts) and the Vercel/CI build read
// ONLY that committed snapshot — never ../asoe2 — so the build works where
// asoe2 isn't present. Same convention as `generate-types` (OpenAPI) and
// `sync:reason-tags` (constraints/specs.py).
//
// Usage:
//   npm run sync:scenario-catalog          # refresh snapshot from sibling
//   npm run verify:scenario-catalog        # regenerate mocks + diff (drift gate)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SIBLING = resolve(REPO_ROOT, "..", "asoe2");
const SOURCE = resolve(SIBLING, "fixtures", "scenarios", "catalog.yaml");
const SNAPSHOT = resolve(REPO_ROOT, "tests/contract/snapshots/scenario_catalog.yaml");

if (!existsSync(SIBLING)) {
  console.error(
    `[sync-scenario-catalog] sibling checkout not found at ${SIBLING}.\n` +
    "Clone kumarabhijit/asoe2 as a sibling working tree, then re-run.",
  );
  process.exit(1);
}
if (!existsSync(SOURCE)) {
  console.error(
    `[sync-scenario-catalog] ${SOURCE} missing.\n` +
    "Author fixtures/scenarios/catalog.yaml in asoe2 first (RFC Decision A).",
  );
  process.exit(1);
}

const raw = readFileSync(SOURCE, "utf-8");
const banner =
  "# COMMITTED SNAPSHOT — do not edit by hand.\n" +
  "# Source: ../asoe2/fixtures/scenarios/catalog.yaml\n" +
  "# Refresh with: npm run sync:scenario-catalog\n" +
  "# The mock generator reads THIS file (never ../asoe2) so the build is\n" +
  "# self-contained where asoe2 is absent (Vercel / CI).\n" +
  "#\n";

mkdirSync(dirname(SNAPSHOT), { recursive: true });
writeFileSync(SNAPSHOT, banner + raw, "utf-8");
console.log(`[sync-scenario-catalog] wrote ${SNAPSHOT} (${raw.length} bytes from sibling)`);
