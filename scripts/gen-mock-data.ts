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

// Deterministic intent -> recipe projection, mirroring asoe2's
// `propose_recipe` (constraints/fallback_backend.py). selected_recipe is the
// audit-tier provenance field the Diagnostics drawer renders (recipe_name);
// the backend's build_analysis carries it, so the catalog projection must too,
// else the provenance row reads blank (mock_presentation_provenance.test.ts).
// MASS_PRICING_ERROR blocks at shadow with no recipe -> intentionally absent.
const RECIPE_BY_INTENT: Record<string, string> = {
  CONTRACTUAL_CORRECTION: "PriceAdjustmentRecipe.py",
  CREDIT_BLOCK: "CreditHoldReleaseRecipe.py",
  DUPLICATE_PO: "DuplicatePORecipe.py",
  BACK_ORDER: "BackOrderResolutionRecipe.py",
  OVER_MAX: "OverMaxTrimRecipe.py",
  MIN_ORDER_QTY: "MOQRoundUpRecipe.py",
  PALLET_CONFIG: "PalletAlignmentRecipe.py",
  DELIVERY_DELAY: "DeliveryDelayResolutionRecipe.py",
  PRICE_HOLD_RELEASE: "PriceHoldReleaseRecipe.py",
  EDI_MISMATCH: "EdiMismatchRecipe.py",
  MANUAL_ORDER_INTAKE: "EmailOrderEntryRecipe.py",
};

/** Project a scenario/email entry onto an ExceptionSummary-shaped object.
 *  Returns null when the entry carries no UI disposition (`lifecycle`), or
 *  when it is a backend-only test fixture (`fixture: test-*.eml`) — the
 *  duplicate/messy-input scenarios exist for backend coverage and have no UI
 *  substrate (inbox bundles / line items), so they are not part of the served
 *  demo queue. */
function toSummary(cat: Catalog, entry: Json, isEmail: boolean): Json | null {
  const lifecycle = entry.lifecycle as string | undefined;
  if (!lifecycle) return null;
  const fixture = entry.fixture as string | undefined;
  if (typeof fixture === "string" && fixture.startsWith("test-")) return null;
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
  const recipe = RECIPE_BY_INTENT[entry.intent as string];
  if (recipe) summary.selected_recipe = recipe;
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
  // Case-pivot parent assignment. The backend groups records onto one case
  // by customer PO — api/case_resolver.py `materialise_for_event` keys the
  // case on `order_id` — so the mock mirrors it: scenarios sharing an
  // order_id form ONE multi-record case (e.g. the Walmart Q1-reset PO
  // carrying a price-hold + back-order + duplicate); singletons keep their
  // per-id case. The "every record has a parent case" invariant holds either
  // way (tests/architectural/case_pivot_mock_wiring.test.ts).
  const orderCount = new Map<string, number>();
  for (const r of rows) {
    const oid = r.order_id as string;
    orderCount.set(oid, (orderCount.get(oid) ?? 0) + 1);
  }
  for (const r of rows) {
    const oid = r.order_id as string;
    r.parent_case_id =
      (orderCount.get(oid) ?? 0) > 1 ? `case-for-${oid}` : `case-for-${r.id}`;
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
