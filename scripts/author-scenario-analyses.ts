#!/usr/bin/env tsx
/**
 * Authoring aid for the MOCK_* -> scenario-catalog migration (slice work).
 *
 * Losslessly round-trips selected entries out of the hand-authored
 *   src/lib/mock-data/order-analyses.ts (MOCK_ORDER_ANALYSES)
 * into the asoe2 sibling analysis fixture
 *   ../asoe2/fixtures/scenarios/analyses.yaml
 * keyed by exc-id, so the YAML is the source of truth going forward and the
 * dependent UI locks stay byte-green by construction (no hand transcription).
 *
 * `primary_section` is stripped here on purpose: it is a deterministic
 * presentation hint stamped at runtime by order-analyses.ts (mirroring the
 * backend read path), not recipe/composer output, so it does not belong in
 * the fixture.
 *
 * This is an AUTHORING tool, not part of the build pipeline. Re-run it only
 * when migrating a new intent family:
 *   tsx scripts/author-scenario-analyses.ts exc-017 exc-018
 * It MERGES into any existing analyses.yaml (existing keys are preserved).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";

import { MOCK_ORDER_ANALYSES } from "../src/lib/mock-data/order-analyses";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const TARGET = resolve(REPO_ROOT, "..", "asoe2", "fixtures", "scenarios", "analyses.yaml");

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("usage: tsx scripts/author-scenario-analyses.ts <exc-id> [exc-id...]");
  process.exit(1);
}

interface AnalysesFile {
  version: number;
  analyses: Record<string, unknown>;
}

const existing: AnalysesFile = existsSync(TARGET)
  ? (parse(readFileSync(TARGET, "utf-8")) as AnalysesFile)
  : { version: 1, analyses: {} };

/**
 * Project a hand-authored MOCK_ORDER_ANALYSES entry onto the asoe2
 * `AnalysisResponse` contract (api/schemas.py, `extra="forbid"`).
 *
 * The fixture is the per-record payload the *backend read path* returns, so
 * it must carry exactly the contract's fields — not the UI's presentation
 * extras. Two classes of difference are reconciled here so the fixture
 * mirrors backend reality (the parity goal), not mock embellishment:
 *
 *  1. Fields the backend schema documents as deliberately NOT in the
 *     contract (UI-only / no recipe producer) are dropped — same rationale
 *     as `primary_section`. These stay declared on the UI *AnalysisData type
 *     (Guardrail #6/#7 — nothing removed there); they simply never appear in
 *     a real GET response, so they don't belong in a contract fixture:
 *       - `moq_analysis.sap_steps`            (MOQAnalysisData omits it)
 *       - `pallet_analysis.at_risk_total`     (PalletAnalysisData omits all
 *         `.extra_labor_est_hrs` / `.freight_waste_pct`   three — mock-only)
 *       - `backorder_analysis.resolution_options[].recommended`
 *         (ResolutionOption has no such field)
 *  2. `duplicate_detection.days_between` is coerced to an integer to mirror
 *     the live adapter (`api/analysis_adapters.py` does `int(...)`); the mock
 *     carried fractional days the backend never emits.
 */
function projectToContract(entry: Record<string, unknown>): Record<string, unknown> {
  // Strip the runtime-stamped presentation hint (re-derived by order-analyses.ts).
  const { primary_section: _omit, ...out } = structuredClone(entry);

  const moq = out.moq_analysis as Record<string, unknown> | undefined;
  if (moq) delete moq.sap_steps;

  const pallet = out.pallet_analysis as Record<string, unknown> | undefined;
  if (pallet) {
    delete pallet.at_risk_total;
    delete pallet.extra_labor_est_hrs;
    delete pallet.freight_waste_pct;
  }

  const bo = out.backorder_analysis as Record<string, unknown> | undefined;
  const opts = bo?.resolution_options as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(opts)) for (const o of opts) delete o.recommended;

  const dup = out.duplicate_detection as Record<string, unknown> | undefined;
  if (dup && typeof dup.days_between === "number") {
    dup.days_between = Math.trunc(dup.days_between);
  }

  return out;
}

for (const id of ids) {
  const entry = MOCK_ORDER_ANALYSES[id];
  if (!entry) {
    console.error(`[author-scenario-analyses] ${id} not found in MOCK_ORDER_ANALYSES`);
    process.exit(1);
  }
  existing.analyses[id] = projectToContract(entry as unknown as Record<string, unknown>);
}

// Stable key order so the file is deterministic across re-runs.
const sorted: Record<string, unknown> = {};
for (const key of Object.keys(existing.analyses).sort()) {
  sorted[key] = existing.analyses[key];
}
existing.analyses = sorted;
existing.version = existing.version ?? 1;

const banner =
  "# ASOE scenario analysis fixture — sibling to catalog.yaml.\n" +
  "#\n" +
  "# Owned by asoe2. Keyed by exc-id, DISTINCT from the SAP-seed `scenarios:`\n" +
  "# in catalog.yaml (those are detection inputs; these are the per-record\n" +
  "# OrderAnalysis evidence payload the operator consumes).\n" +
  "#\n" +
  "# Each entry validates against api/schemas.py::AnalysisResponse and its\n" +
  "# *AnalysisData sub-models (tests/test_scenario_analyses.py). asoe-ui\n" +
  "# vendors a committed snapshot of this file and projects it into\n" +
  "# src/lib/mock-data/__generated__/scenario_analyses.ts.\n" +
  "#\n" +
  "# Projected from the prior hand-authored UI mock via\n" +
  "# asoe-ui/scripts/author-scenario-analyses.ts (backend-contract fields\n" +
  "# only; UI-only extras dropped, days_between int-coerced to mirror the\n" +
  "# live adapter) — do not hand-transcribe.\n" +
  "#\n";

// Portability: the contract types (api/schemas.py) declare timestamp fields
// as `str`. eemeli's `yaml` keeps unquoted ISO scalars as strings, but
// PyYAML's SafeLoader coerces them to datetime (YAML 1.1 timestamp), which
// would fail the asoe2 Pydantic str-validation. Quote standalone ISO
// date/datetime scalars so BOTH parsers agree they are strings.
const ISO_SCALAR = /^(\s*(?:- )?(?:[\w-]+: )?)(\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?)$/gm;
const portable = stringify(existing, { lineWidth: 0 }).replace(ISO_SCALAR, '$1"$2"');

writeFileSync(TARGET, banner + portable, "utf-8");
console.log(`[author-scenario-analyses] wrote ${ids.length} entr${ids.length === 1 ? "y" : "ies"} to ${TARGET}`);
