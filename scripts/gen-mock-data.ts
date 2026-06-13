#!/usr/bin/env tsx
/**
 * Generate mock ExceptionSummary fixtures from the committed scenario-catalog
 * snapshot.
 *
 * RFC: docs/synthetic-data-placement-rfc.md (§7, Phase 5).
 *
 * Reads ONLY the committed snapshot
 *   tests/contract/snapshots/scenario_catalog.yaml
 * (never ../asoe2 — that cross-repo read lives in sync-scenario-catalog.mjs)
 * and emits
 *   src/lib/mock-data/__generated__/scenario_catalog.ts
 *
 * GUARDRAIL #2 (generate-then-diff, never overwrite): this generator does
 * NOT touch the hand-authored src/lib/mock-data/exceptions.ts. The catalog
 * is intentionally coarser than today's MOCK_ORDER_ANALYSES (~1,900 lines of
 * hand-authored evidence the catalog schema doesn't yet carry) and omits
 * recipe names by design (audit-tier, never operator-facing). So the
 * generated module is a PARALLEL artifact that proves the pipeline; the app
 * keeps consuming the hand-authored mocks until the catalog reaches parity.
 * Adoption (pointing the API client at CATALOG_EXCEPTIONS) is a later step.
 *
 * Only scenarios that carry a UI disposition (`lifecycle`) are projected —
 * baseline EVT-* events are seed-execution inputs (recipe decides their
 * lifecycle), not pre-dispositioned UI rows. Email scenarios project as
 * MANUAL_ORDER_INTAKE rows.
 *
 * Run: npm run gen:mock-data
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const SNAPSHOT = resolve(REPO_ROOT, "tests/contract/snapshots/scenario_catalog.yaml");
const OUT = resolve(REPO_ROOT, "src/lib/mock-data/__generated__/scenario_catalog.ts");

// Deterministic constants so regeneration is byte-stable (the verify gate
// diffs the output). The catalog carries no per-record audit timestamps —
// those are stamped by the real backend — so generated rows get a single
// sentinel value, clearly synthetic, used only by this non-adopted artifact.
const TENANT_ID = "acme-corp";
const SENTINEL_TS = "2026-06-13T00:00:00Z";

type Json = Record<string, unknown>;

interface Catalog {
  entities: { customers: Array<{ retailer_id: string; name: string }> };
  scenarios: Json[];
  email_scenarios?: Json[];
}

function loadCatalog(): Catalog {
  return parse(readFileSync(SNAPSHOT, "utf-8")) as Catalog;
}

function customerName(cat: Catalog, retailerId?: string): string | undefined {
  if (!retailerId) return undefined;
  return cat.entities.customers.find((c) => c.retailer_id === retailerId)?.name;
}

/** Project a scenario/email entry onto an ExceptionSummary-shaped object.
 *  Returns null when the entry carries no UI disposition (`lifecycle`). */
function toSummary(cat: Catalog, entry: Json, isEmail: boolean): Json | null {
  const lifecycle = entry.lifecycle as string | undefined;
  if (!lifecycle) return null;
  const id = entry.id as string;
  const retailerId = entry.retailer_id as string | undefined;
  const accountName =
    customerName(cat, retailerId) ?? (entry.account as string | undefined);

  const summary: Json = {
    id,
    tenant_id: TENANT_ID,
    order_id: (entry.order_id as string) ?? (entry.ref_po as string) ?? id,
    event_type: isEmail
      ? (entry.expected_classification as string)
      : (entry.event_type as string),
    intent: entry.intent as string,
    lifecycle_state: lifecycle,
    created_at: (entry.received_at as string) ?? SENTINEL_TS,
    updated_at: (entry.received_at as string) ?? SENTINEL_TS,
    // Preserve the case-pivot invariant the hand-authored mock enforces
    // (tests/architectural/case_pivot_mock_wiring.test.ts) so this artifact
    // is adoption-ready: every record has a parent case.
    parent_case_id: `case-for-${id}`,
  };
  if (entry.shadow_verdict) summary.shadow_verdict = entry.shadow_verdict;
  if (retailerId) summary.account_id = `acct-${retailerId}`;
  if (accountName) summary.account_name = accountName;
  return summary;
}

function main(): void {
  const cat = loadCatalog();
  const rows: Json[] = [];
  for (const s of cat.scenarios ?? []) {
    const r = toSummary(cat, s, false);
    if (r) rows.push(r);
  }
  for (const s of cat.email_scenarios ?? []) {
    const r = toSummary(cat, s, true);
    if (r) rows.push(r);
  }
  // Stable order: by id, so the emitted file is deterministic.
  rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const body = [
    "// AUTO-GENERATED — do not edit by hand.",
    "// Source: tests/contract/snapshots/scenario_catalog.yaml",
    "//          (synced from ../asoe2/fixtures/scenarios/catalog.yaml)",
    "// Regenerate with: npm run gen:mock-data",
    "//",
    "// PARALLEL artifact (Guardrail #2): NOT yet consumed by the app. The",
    "// hand-authored src/lib/mock-data/exceptions.ts remains the source the",
    "// API client uses until the catalog reaches MOCK_ORDER_ANALYSES parity.",
    "// `created_at`/`updated_at` are synthetic sentinels (the catalog carries",
    "// no per-record audit timestamps; the real backend stamps those).",
    "",
    'import type { ExceptionSummary } from "@/types/exceptions";',
    "",
    `export const CATALOG_EXCEPTIONS: ExceptionSummary[] = ${JSON.stringify(rows, null, 2)};`,
    "",
    `export const CATALOG_EXCEPTION_COUNT = ${rows.length} as const;`,
    "",
  ].join("\n");

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, body, "utf-8");
  console.log(`[gen-mock-data] wrote ${OUT} (${rows.length} projected exceptions)`);
}

main();
