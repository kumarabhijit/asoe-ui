// Synthetic SAP -> Azure PostgreSQL replica dataset generator.
//
// Emits the SQL scripts under `data/synthetic/` that model the slice of an
// SAP S/4HANA SD system a CDC replication pipeline (SLT / Azure Data
// Factory) would land in an Azure Database for PostgreSQL schema named
// `sap_replica`. The dataset substantiates every exception in
// `src/lib/mock-data/exceptions.ts`: for each mock exception the replica
// contains the SAP documents (orders, pricing conditions, blocks, stock,
// EDI/email intake rows) that would have caused the ASOE pipeline to raise
// that exception. Lineage is recorded in `zasoe_exception_link`.
//
// Deterministic by construction: a fixed-seed PRNG fills the non-curated
// rows (clean orders), all timestamps derive from the mock fixtures, and
// no wall-clock reads occur — re-running the generator on the same mock
// data produces byte-identical SQL (`npm run synthetic:check`).
//
// Coverage is asserted: if an exception is added to MOCK_EXCEPTIONS
// without a scenario entry here, generation fails loudly (mirrors the
// repo's architectural-lock culture).
//
// Regenerate with: npm run synthetic:gen
// See data/synthetic/README.md for the schema and replication model docs.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MOCK_EXCEPTIONS } from "../src/lib/mock-data/exceptions";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO_ROOT, "data", "synthetic");

const GENERATED_BANNER = `-- GENERATED FILE — do not edit by hand.
-- Produced by scripts/generate-synthetic-data.ts (npm run synthetic:gen).
-- Synthetic SAP S/4HANA -> Azure PostgreSQL replica for ASOE demos.
-- All customers, orders, prices and documents are fictitious.
`;

/* ── deterministic PRNG (mulberry32) ─────────────────────────────────── */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x45_0e_5a_01);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/* ── SQL emission helpers ────────────────────────────────────────────── */

type SqlValue = string | number | boolean | null;

function lit(v: SqlValue): string {
  if (v === null) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return `'${v.replace(/'/g, "''")}'`;
}

function money(n: number): string {
  return n.toFixed(2);
}

function insertRows(
  table: string,
  cols: readonly string[],
  rows: readonly SqlValue[][],
): string {
  if (rows.length === 0) return "";
  const head = `INSERT INTO ${table} (${cols.join(", ")}) VALUES`;
  const body = rows
    .map((r) => {
      if (r.length !== cols.length) {
        throw new Error(
          `Row arity mismatch for ${table}: expected ${cols.length}, got ${r.length}`,
        );
      }
      return `  (${r.map(lit).join(", ")})`;
    })
    .join(",\n");
  return `${head}\n${body};\n\n`;
}

/** ISO date `YYYY-MM-DD` n days after the given date. */
function plusDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Replication timestamp: the source event instant plus a CDC lag. */
function replicatedAt(sourceIso: string, lagMinutes = 12): string {
  const d = new Date(sourceIso);
  d.setUTCMinutes(d.getUTCMinutes() + lagMinutes);
  return d.toISOString().replace(".000Z", "Z");
}

const MASTER_DATA_LOAD_AT = "2026-04-01T03:00:00Z"; // initial full load

/* ── reference data: plants (T001W) ──────────────────────────────────── */

interface Plant {
  werks: string;
  name1: string;
  regio: string;
}

const PLANTS: readonly Plant[] = [
  { werks: "1500", name1: "NYC Metro DC", regio: "NY" },
  { werks: "2100", name1: "Miami DC", regio: "FL" },
  { werks: "2500", name1: "Houston DC", regio: "TX" },
  { werks: "3200", name1: "Portland DC", regio: "OR" },
  { werks: "3400", name1: "Chicago Central DC", regio: "IL" },
  { werks: "3450", name1: "Memphis National DC", regio: "TN" },
  { werks: "4100", name1: "Atlanta DC", regio: "GA" },
  { werks: "5200", name1: "Dallas Distribution Hub", regio: "TX" },
  { werks: "6100", name1: "Denver DC", regio: "CO" },
  { werks: "6500", name1: "Denver National DC", regio: "CO" },
  { werks: "7800", name1: "LA Distribution Hub", regio: "CA" },
];

/* ── reference data: customers (KNA1) ────────────────────────────────── */
// The five sold-to parties mirror the `account_id`s used by
// MOCK_EXCEPTIONS. The remaining customers carry the BP numbers that
// appear in the mock OrderAnalysis `entity_profile.bp_number` fields
// (BP-102440 -> kunnr 0000102440, ...) and serve as ship-to partners /
// clean-order sold-tos, so the UI's entity profiles join back to KNA1.

interface Customer {
  kunnr: string;
  name1: string;
  sortl: string;
  ort01: string;
  regio: string;
  pstlz: string;
  accountId?: string;
  ediFrom?: string;
}

const CUSTOMERS: readonly Customer[] = [
  { kunnr: "0000100001", name1: "Walmart", sortl: "WMT", ort01: "Bentonville", regio: "AR", pstlz: "72712", accountId: "acct-walmart", ediFrom: "orders@buying.walmart.example.com" },
  { kunnr: "0000100002", name1: "Kroger", sortl: "KR", ort01: "Cincinnati", regio: "OH", pstlz: "45202", accountId: "acct-kroger", ediFrom: "po@kroger.example.com" },
  { kunnr: "0000100003", name1: "Target", sortl: "TGT", ort01: "Minneapolis", regio: "MN", pstlz: "55403", accountId: "acct-target", ediFrom: "supplychain@target.example.com" },
  { kunnr: "0000100004", name1: "Costco", sortl: "CST", ort01: "Issaquah", regio: "WA", pstlz: "98027", accountId: "acct-costco", ediFrom: "buying@costco.example.com" },
  { kunnr: "0000100005", name1: "Southeast Beverage Distributors", sortl: "SEBEV", ort01: "Atlanta", regio: "GA", pstlz: "30303", accountId: "acct-southeast-distrib", ediFrom: "po@sebev.example.com" },
  { kunnr: "0000102440", name1: "Metro Grocery Holdings", sortl: "METRO", ort01: "Atlanta", regio: "GA", pstlz: "30310" },
  { kunnr: "0000118903", name1: "Sunrise Beverages Co", sortl: "SUNRS", ort01: "Miami", regio: "FL", pstlz: "33101" },
  { kunnr: "0000207815", name1: "QuickMart Distribution", sortl: "QKMRT", ort01: "Dallas", regio: "TX", pstlz: "75201" },
  { kunnr: "0000310092", name1: "FreshCo Wholesale Ltd", sortl: "FRSHC", ort01: "Chicago", regio: "IL", pstlz: "60601" },
  { kunnr: "0000330210", name1: "CornerShop Express", sortl: "CRNR", ort01: "Houston", regio: "TX", pstlz: "77001" },
  { kunnr: "0000445520", name1: "ValuePack Stores Inc", sortl: "VALPK", ort01: "Los Angeles", regio: "CA", pstlz: "90001" },
  { kunnr: "0000520871", name1: "PowerDrink Distributors", sortl: "PWRDK", ort01: "Denver", regio: "CO", pstlz: "80201" },
  { kunnr: "0000660134", name1: "ActiveLife Health Stores", sortl: "ACTLF", ort01: "New York", regio: "NY", pstlz: "10001" },
  { kunnr: "0000890045", name1: "GreenLeaf Natural Foods", sortl: "GRNLF", ort01: "Portland", regio: "OR", pstlz: "97201" },
];

const CUSTOMER_BY_ACCOUNT = new Map(
  CUSTOMERS.filter((c) => c.accountId).map((c) => [c.accountId as string, c]),
);
const CUSTOMER_BY_KUNNR = new Map(CUSTOMERS.map((c) => [c.kunnr, c]));

/* ── reference data: materials (MARA/MAKT/MARM/MVKE) ─────────────────── */

interface Material {
  matnr: string;
  maktx: string;
  matkl: string;
  /** PR00 list price per case; null = price record intentionally missing
   *  (exc-005: new SKU whose PR00 was never loaded). */
  pr00: number | null;
  /** MVKE-AUMNG minimum order quantity (0 = none). */
  aumng?: number;
  /** Cases per pallet + cases per layer -> MARM `PAL` row. */
  pal?: { umrez: number; layer: number };
  /** Eaches per case -> MARM `EA` row. Deliberately absent for SKU-5521
   *  (exc-004: CS->EA conversion factor missing from the material master). */
  eaPerCs?: number;
}

const MATERIALS: readonly Material[] = [
  { matnr: "SKU-0042", maktx: "12-pk Cola", matkl: "042", pr00: 14.88, eaPerCs: 12 },
  { matnr: "SKU-0099", maktx: "Sparkling Citrus 12-pk (new)", matkl: "042", pr00: null, eaPerCs: 12 },
  { matnr: "SKU-001", maktx: "Espresso Roast 12pk", matkl: "201", pr00: 63.0, eaPerCs: 12 },
  { matnr: "SKU-1180", maktx: "24-pk Water", matkl: "041", pr00: 9.6, eaPerCs: 24 },
  { matnr: "SKU-1181", maktx: "12-pk Sparkling", matkl: "041", pr00: 11.4, eaPerCs: 12 },
  { matnr: "SKU-2210", maktx: "Snack Bar 18ct", matkl: "055", pr00: 14.22 },
  { matnr: "SKU-2220", maktx: "Protein Bar 12ct", matkl: "055", pr00: 15.0 },
  { matnr: "SKU-2230", maktx: "Granola Bar 12ct", matkl: "055", pr00: 10.5 },
  { matnr: "SKU-2240", maktx: "Kids Bar 8ct", matkl: "055", pr00: 10.0 },
  { matnr: "SKU-3500", maktx: "Premium Coffee 12oz 24pk", matkl: "201", pr00: 52.0, pal: { umrez: 168, layer: 24 } },
  { matnr: "SKU-3510", maktx: "Decaf Coffee 12oz 24pk", matkl: "201", pr00: 54.0, pal: { umrez: 84, layer: 14 } },
  { matnr: "SKU-3520", maktx: "Cold Brew 10oz 12pk", matkl: "201", pr00: 30.0, pal: { umrez: 48, layer: 12 } },
  { matnr: "SKU-4410", maktx: "Sports Water 24pk", matkl: "044", pr00: 8.4, eaPerCs: 24 },
  { matnr: "SKU-4420", maktx: "Isotonic Sport 12pk", matkl: "044", pr00: 14.0, eaPerCs: 12 },
  // exc-004: prices in CS in SAP, the buyer PO came in EA — the CS->EA
  // MARM conversion row is intentionally NOT generated for this SKU.
  { matnr: "SKU-5521", maktx: "Family Pack x6", matkl: "048", pr00: 42.0 },
  { matnr: "SKU-6100", maktx: "Craft Lager 24pk", matkl: "061", pr00: 18.5 },
  { matnr: "SKU-6110", maktx: "Premium Lager 24pk", matkl: "061", pr00: 19.8 },
  { matnr: "SKU-6120", maktx: "Craft Lager 12pk", matkl: "061", pr00: 9.95 },
  { matnr: "SKU-6200", maktx: "Hard Seltzer Variety 12pk", matkl: "062", pr00: 22.0 },
  { matnr: "SKU-7701", maktx: "Energy Drink 4pk", matkl: "071", pr00: 8.96 },
  { matnr: "SKU-7705", maktx: "Energy Drink 8pk", matkl: "071", pr00: 17.5 },
  { matnr: "SKU-7800", maktx: "Organic Kombucha 6pk", matkl: "078", pr00: 21.5, aumng: 72 },
  { matnr: "SKU-7810", maktx: "Ginger Kombucha 6pk", matkl: "078", pr00: 21.5, aumng: 50 },
  { matnr: "SKU-7900", maktx: "Iced Tea 12pk", matkl: "079", pr00: 13.5, eaPerCs: 12 },
  { matnr: "SKU-8101", maktx: "Premium Mixer 24pk", matkl: "101", pr00: 100.0 },
  { matnr: "SKU-8102", maktx: "Premium Mixer Lime 24pk", matkl: "102", pr00: 100.0 },
  { matnr: "SKU-9010", maktx: "Sparkling Mineral 12pk", matkl: "090", pr00: 7.8 },
  { matnr: "SKU-9015", maktx: "Still Mineral 12pk", matkl: "090", pr00: 7.2 },
  { matnr: "SKU-9020", maktx: "Flavored Water 24pk", matkl: "090", pr00: 12.6 },
  { matnr: "SKU-KR-1100", maktx: "Kombucha Variety 6pk", matkl: "078", pr00: 19.8, aumng: 72 },
  { matnr: "SKU-KR-1110", maktx: "Ginger Kombucha 6pk (KR)", matkl: "078", pr00: 19.8, aumng: 50 },
  { matnr: "SKU-COST-EOQ-A", maktx: "Costco Club-Pack Bundle 36ct", matkl: "048", pr00: 24.0, pal: { umrez: 300, layer: 60 } },
  { matnr: "SKU-COST-EOQ-B", maktx: "Costco Club-Pack Bundle 48ct", matkl: "048", pr00: 30.0, pal: { umrez: 300, layer: 60 } },
  { matnr: "SKU-Q1R-2076", maktx: "Q1 Reset Display Pack", matkl: "207", pr00: 20.0 },
  { matnr: "SKU-PRICE-MM", maktx: "EDI Routed Pricing Demo Pack", matkl: "205", pr00: 100.0 },
  // NOTE: SKU-999-UNKNOWN (exc-019) is deliberately absent from MARA —
  // the inbound EDI line referencing it is the hard-reject scenario.
];

const MATERIAL_BY_MATNR = new Map(MATERIALS.map((m) => [m.matnr, m]));

/** Materials safe to use for PRNG-generated clean orders: priced, no
 *  MOQ constraint, and not reserved for a curated scenario. */
const CLEAN_CATALOG = MATERIALS.filter(
  (m) =>
    m.pr00 !== null &&
    !m.aumng &&
    !m.matnr.startsWith("SKU-COST-EOQ") &&
    m.matnr !== "SKU-Q1R-2076" &&
    m.matnr !== "SKU-PRICE-MM" &&
    m.matnr !== "SKU-5521",
);

/* ── pricing condition records (KONH/KONP + A304/A305) ───────────────── */
// PR00 (list price, sales-org/material -> A304) per priced material.
// Customer-specific contract / promo conditions (-> A305):
//   ZPROM/155  Walmart x SKU-0042  -1.68  valid 2025-10-01..2025-12-31 (EXPIRED — exc-001 root cause)
//   ZA01/620   Walmart x SKU-0042   0.00  contract 4600012840 tier (no extra discount)
//   ZA01/621   Walmart x SKU-0099  17.28  contract rate (PR00 missing — exc-005)
//   ZTEA/730   Costco  x SKU-7900  -1.50  Q4 2025 (EXPIRED)
//   ZTEA/731   Costco  x SKU-7900  -1.50  Q1 2026 reload (exc-008 auto-resolution)

interface CondRecord {
  knumh: string;
  kschl: string;
  kbetr: number;
  datab: string;
  datbi: string;
  matnr: string;
  kunnr?: string; // present -> A305 (customer/material), absent -> A304
}

const COND_RECORDS: CondRecord[] = [];
{
  let n = 1001;
  for (const m of MATERIALS) {
    if (m.pr00 === null) continue; // exc-005: PR00 never loaded for SKU-0099
    COND_RECORDS.push({
      knumh: String(n++).padStart(10, "0"),
      kschl: "PR00",
      kbetr: m.pr00,
      datab: "2026-01-01",
      datbi: "9999-12-31",
      matnr: m.matnr,
    });
  }
}
COND_RECORDS.push(
  { knumh: "0000000155", kschl: "ZPROM", kbetr: -1.68, datab: "2025-10-01", datbi: "2025-12-31", matnr: "SKU-0042", kunnr: "0000100001" },
  { knumh: "0000000620", kschl: "ZA01", kbetr: 0.0, datab: "2026-01-01", datbi: "9999-12-31", matnr: "SKU-0042", kunnr: "0000100001" },
  { knumh: "0000000621", kschl: "ZA01", kbetr: 17.28, datab: "2026-01-01", datbi: "9999-12-31", matnr: "SKU-0099", kunnr: "0000100001" },
  { knumh: "0000000730", kschl: "ZTEA", kbetr: -1.5, datab: "2025-10-01", datbi: "2025-12-31", matnr: "SKU-7900", kunnr: "0000100004" },
  { knumh: "0000000731", kschl: "ZTEA", kbetr: -1.5, datab: "2026-01-01", datbi: "2026-06-30", matnr: "SKU-7900", kunnr: "0000100004" },
);

/* ── customer-material info records (KNMT, zzmax_qty Z-append) ───────── */
// OVER_MAX ceilings live on the customer-material info record via the
// customer Z-append `zzmax_qty` (a common CPG pattern).

interface KnmtRecord {
  kunnr: string;
  matnr: string;
  zzmaxQty: number | null;
}

const KNMT_RECORDS: readonly KnmtRecord[] = [
  // exc-012 (SO-10100, Costco)
  { kunnr: "0000100004", matnr: "SKU-9010", zzmaxQty: 900 },
  { kunnr: "0000100004", matnr: "SKU-9015", zzmaxQty: 800 },
  { kunnr: "0000100004", matnr: "SKU-9020", zzmaxQty: 300 },
  // exc-030 (PO-COST-EOQ-2026Q1, Costco)
  { kunnr: "0000100004", matnr: "SKU-COST-EOQ-A", zzmaxQty: 1500 },
  { kunnr: "0000100004", matnr: "SKU-COST-EOQ-B", zzmaxQty: 1500 },
  // a couple of unconstrained info records so the table isn't only ceilings
  { kunnr: "0000100001", matnr: "SKU-0042", zzmaxQty: null },
  { kunnr: "0000100002", matnr: "SKU-1180", zzmaxQty: null },
];

/* ── credit master (KNKK) ────────────────────────────────────────────── */
// Target appears in two credit control areas: CC10 carries the hard
// breach behind exc-003 (SO-2200, exposure $142,500 > limit $125,000),
// CC20 carries the 90%-warning profile behind exc-007 (SO-6001,
// exposure $93,200 against $100,000).

interface KnkkRecord {
  kunnr: string;
  kkber: string;
  klimk: number;
  skfor: number;
  ctlpc: string;
  crblb: string | null;
}

const KNKK_RECORDS: readonly KnkkRecord[] = [
  { kunnr: "0000100001", kkber: "CC10", klimk: 2_000_000, skfor: 815_400, ctlpc: "A", crblb: null },
  { kunnr: "0000100002", kkber: "CC10", klimk: 1_200_000, skfor: 402_750, ctlpc: "A", crblb: null },
  { kunnr: "0000100003", kkber: "CC10", klimk: 125_000, skfor: 142_500, ctlpc: "C", crblb: "X" },
  { kunnr: "0000100003", kkber: "CC20", klimk: 100_000, skfor: 93_200, ctlpc: "B", crblb: null },
  { kunnr: "0000100004", kkber: "CC10", klimk: 1_500_000, skfor: 611_200, ctlpc: "A", crblb: null },
  { kunnr: "0000100005", kkber: "CC10", klimk: 250_000, skfor: 96_300, ctlpc: "B", crblb: null },
];

/* ── warehouse stock (MARD) ──────────────────────────────────────────── */
// Substantiates the back-order availability gaps in exc-010/011/028 and
// the substitute availabilities the BackOrder recipe quotes.

interface MardRecord {
  matnr: string;
  werks: string;
  labst: number;
}

const MARD_RECORDS: readonly MardRecord[] = [
  // exc-010 (SO-9200): ordered 800, primary DC Dallas has 480
  { matnr: "SKU-6100", werks: "5200", labst: 480 },
  { matnr: "SKU-6100", werks: "6500", labst: 200 },
  { matnr: "SKU-6100", werks: "7800", labst: 150 },
  { matnr: "SKU-6100", werks: "1500", labst: 80 },
  // exc-010 substitutes
  { matnr: "SKU-6110", werks: "5200", labst: 300 },
  { matnr: "SKU-6120", werks: "5200", labst: 600 },
  // exc-011 (SO-9450): ordered 200, primary Houston has 140, Chicago 120
  { matnr: "SKU-6200", werks: "2500", labst: 140 },
  { matnr: "SKU-6200", werks: "3400", labst: 120 },
  // exc-028 (PO-WMT-Q1-RESET-001): ordered 1600, Atlanta 1280 + alternates
  { matnr: "SKU-Q1R-2076", werks: "4100", labst: 1280 },
  { matnr: "SKU-Q1R-2076", werks: "3450", labst: 400 },
  { matnr: "SKU-Q1R-2076", werks: "5200", labst: 220 },
  // healthy stock for a few clean-catalog SKUs
  { matnr: "SKU-0042", werks: "4100", labst: 12_400 },
  { matnr: "SKU-1180", werks: "5200", labst: 22_000 },
  { matnr: "SKU-3500", werks: "3400", labst: 5_100 },
  { matnr: "SKU-9010", werks: "7800", labst: 9_800 },
];

/* ── curated sales orders (VBAK/VBAP/VBEP/VBPA/PRCD_ELEMENTS) ────────── */

interface OrderCond {
  kschl: string;
  kbetr: number;
  /** PRCD_ELEMENTS-KINAK: condition present but inactive (e.g. an
   *  expired promo the pricing run excluded — exc-001). */
  inactive?: boolean;
}

interface OrderLine {
  matnr: string;
  qty: number;
  /** Net price per unit currently on the SAP item. */
  netpr: number;
  werks: string;
  /** Confirmed quantity if short (drives a split VBEP schedule). */
  confirmed?: number;
  /** Rejection reason (ABGRU) — '52' = duplicate order. */
  abgru?: string;
  /** Extra document conditions beyond the PR00 row. */
  conds?: OrderCond[];
  /** Unit price as transmitted on the inbound EDI 850 (defaults to
   *  netpr). Diverges where the agent corrected the SAP price after
   *  receipt — the staging table keeps the as-received truth. */
  ediPrice?: number;
}

interface OrderSeed {
  /** UI `order_id` this order embodies, when the exception points at it. */
  uiOrderId?: string;
  /** Exceptions in MOCK_EXCEPTIONS this order substantiates. */
  excIds: string[];
  bstnk: string;
  kunnr: string;
  shipTo?: string;
  erdat: string;
  vdatu: string;
  lifsk?: string;
  cmgst?: string;
  gbstk: "A" | "B" | "C";
  lines: OrderLine[];
  note: string;
}

const W = "0000100001"; // Walmart
const K = "0000100002"; // Kroger
const T = "0000100003"; // Target
const C = "0000100004"; // Costco
const S = "0000100005"; // Southeast Beverage Distributors

// Delivery-block reason codes used below (ZSD custom blocks):
//   Z1 duplicate-PO hold · Z2 over-max qty hold · Z3 MOQ hold
//   Z4 pallet-config hold · ZP pricing hold
const ORDER_SEEDS: readonly OrderSeed[] = [
  {
    uiOrderId: "SO-1001", excIds: ["exc-001"], bstnk: "PO-WMT-44120", kunnr: W, shipTo: "0000102440",
    erdat: "2026-04-11", vdatu: "2026-04-21", gbstk: "C",
    lines: [
      { matnr: "SKU-0042", qty: 200, netpr: 14.88, werks: "4100", ediPrice: 13.2, conds: [{ kschl: "ZPROM", kbetr: -1.68, inactive: true }, { kschl: "ZA01", kbetr: 0 }] },
      { matnr: "SKU-0042", qty: 180, netpr: 14.88, werks: "4100", ediPrice: 13.2, conds: [{ kschl: "ZPROM", kbetr: -1.68, inactive: true }] },
      { matnr: "SKU-0042", qty: 76, netpr: 14.88, werks: "4100", ediPrice: 14.9 },
    ],
    note: "Expired ZPROM/155 promo: PO priced at $13.20, pricing run reverted to base $14.88. Resolved — SAP shows corrected price, staging keeps as-received.",
  },
  {
    excIds: ["exc-002"], bstnk: "PO-88419", kunnr: K, shipTo: "0000207815",
    erdat: "2026-04-09", vdatu: "2026-04-18", gbstk: "B",
    lines: [
      { matnr: "SKU-1180", qty: 500, netpr: 9.6, werks: "5200" },
      { matnr: "SKU-1181", qty: 200, netpr: 11.4, werks: "5200" },
    ],
    note: "Original order for duplicate pair exc-002 (in fulfilment).",
  },
  {
    uiOrderId: "SO-1042", excIds: ["exc-002"], bstnk: "PO-88421", kunnr: K, shipTo: "0000207815",
    erdat: "2026-04-11", vdatu: "2026-04-18", lifsk: "Z1", gbstk: "B",
    lines: [
      { matnr: "SKU-1180", qty: 500, netpr: 9.62, werks: "5200" },
      { matnr: "SKU-1181", qty: 200, netpr: 10.0, werks: "5200" },
    ],
    note: "Suspected EDI retransmission of PO-88419 36h later — delivery-blocked Z1 pending buyer confirmation.",
  },
  {
    uiOrderId: "SO-2200", excIds: ["exc-003"], bstnk: "PO-TGT-77410", kunnr: T, shipTo: "0000310092",
    erdat: "2026-04-19", vdatu: "2026-04-29", cmgst: "B", gbstk: "B",
    lines: [
      { matnr: "SKU-2210", qty: 600, netpr: 14.22, werks: "3400" },
      { matnr: "SKU-2220", qty: 240, netpr: 15.0, werks: "3400" },
      { matnr: "SKU-2230", qty: 100, netpr: 10.5, werks: "3400" },
      { matnr: "SKU-2240", qty: 60, netpr: 10.0, werks: "3400" },
    ],
    note: "Credit block: KNKK CC10 exposure $142,500 over $125,000 limit; CMGST=B.",
  },
  {
    uiOrderId: "SO-3100", excIds: ["exc-004"], bstnk: "PO-CST-90112", kunnr: C, shipTo: "0000445520",
    erdat: "2026-04-11", vdatu: "2026-04-20", gbstk: "C",
    lines: [
      { matnr: "SKU-5521", qty: 150, netpr: 42.0, werks: "7800", ediPrice: 36.0 },
      { matnr: "SKU-5521", qty: 120, netpr: 42.0, werks: "7800", ediPrice: 36.0 },
    ],
    note: "UOM error: PO priced in EA, SAP in CS — MARM CS->EA row missing for SKU-5521. Resolved.",
  },
  {
    uiOrderId: "SO-4455", excIds: ["exc-005"], bstnk: "PO-WMT-44550", kunnr: W, shipTo: "0000118903",
    erdat: "2026-04-21", vdatu: "2026-04-30", gbstk: "C",
    lines: [
      { matnr: "SKU-0099", qty: 360, netpr: 17.28, werks: "2100", conds: [{ kschl: "ZA01", kbetr: 17.28 }] },
    ],
    note: "New SKU-0099 has no PR00 record (A304 row absent); contract rate ZA01/621 approved.",
  },
  {
    excIds: ["exc-006"], bstnk: "PO-91203", kunnr: K, shipTo: "0000520871",
    erdat: "2026-04-07", vdatu: "2026-04-15", gbstk: "C",
    lines: [
      { matnr: "SKU-7701", qty: 410, netpr: 8.96, werks: "6100" },
      { matnr: "SKU-7705", qty: 200, netpr: 17.5, werks: "6100" },
    ],
    note: "Original (shipped) order for ambiguous-duplicate pair exc-006.",
  },
  {
    uiOrderId: "SO-5010", excIds: ["exc-006"], bstnk: "PO-91210", kunnr: K, shipTo: "0000520871",
    erdat: "2026-04-09", vdatu: "2026-04-17", lifsk: "Z1", gbstk: "B",
    lines: [
      { matnr: "SKU-7701", qty: 480, netpr: 8.5, werks: "6100" },
      { matnr: "SKU-7705", qty: 240, netpr: 16.0, werks: "6100" },
    ],
    note: "Possible duplicate of PO-91203 with 15% quantity drift — escalated, buyer confirmation requested.",
  },
  {
    uiOrderId: "SO-6001", excIds: ["exc-007"], bstnk: "PO-TGT-66010", kunnr: T, shipTo: "0000660134",
    erdat: "2026-04-22", vdatu: "2026-05-01", cmgst: "A", gbstk: "A",
    lines: [{ matnr: "SKU-4420", qty: 360, netpr: 14.0, werks: "1500" }],
    note: "Within credit limit but past the 90% warning threshold (KNKK CC20) — credit check approved with warning.",
  },
  {
    uiOrderId: "SO-7200", excIds: ["exc-008"], bstnk: "PO-CST-72001", kunnr: C, shipTo: "0000890045",
    erdat: "2026-04-09", vdatu: "2026-04-18", gbstk: "C",
    lines: [
      { matnr: "SKU-7900", qty: 250, netpr: 12.0, werks: "3200", conds: [{ kschl: "ZTEA", kbetr: -1.5 }] },
      { matnr: "SKU-9015", qty: 150, netpr: 7.2, werks: "3200" },
    ],
    note: "Expired ZTEA/730 promo auto-replaced by Q1 reload ZTEA/731; closed.",
  },
  {
    excIds: ["exc-009"], bstnk: "PO-55100", kunnr: W, shipTo: "0000330210",
    erdat: "2026-04-11", vdatu: "2026-04-19", gbstk: "B",
    lines: [{ matnr: "SKU-4410", qty: 60, netpr: 8.4, werks: "2500" }],
    note: "Original order for exact-duplicate pair exc-009 (in fulfilment).",
  },
  {
    uiOrderId: "SO-8100", excIds: ["exc-009"], bstnk: "PO-55102", kunnr: W, shipTo: "0000330210",
    erdat: "2026-04-11", vdatu: "2026-04-19", gbstk: "C",
    lines: [{ matnr: "SKU-4410", qty: 60, netpr: 8.4, werks: "2500", abgru: "52" }],
    note: "Exact retransmission 4h after PO-55100 — auto-rejected (ABGRU 52), buyer notified.",
  },
  {
    uiOrderId: "SO-9200", excIds: ["exc-010"], bstnk: "PO-KR-92001", kunnr: K,
    erdat: "2026-04-10", vdatu: "2026-04-17", gbstk: "B",
    lines: [{ matnr: "SKU-6100", qty: 800, netpr: 18.5, werks: "5200", confirmed: 480 }],
    note: "Back order: ATP confirms 480 of 800 at Dallas (MARD); alternates hold 430 across 3 DCs.",
  },
  {
    uiOrderId: "SO-9450", excIds: ["exc-011"], bstnk: "PO-TGT-94501", kunnr: T,
    erdat: "2026-04-17", vdatu: "2026-04-24", gbstk: "B",
    lines: [{ matnr: "SKU-6200", qty: 200, netpr: 22.0, werks: "2500", confirmed: 140 }],
    note: "Back order resolved by split schedule: 140 from Houston now, 60 sourced from Chicago.",
  },
  {
    uiOrderId: "SO-10100", excIds: ["exc-012"], bstnk: "PO-CST-10100", kunnr: C,
    erdat: "2026-04-07", vdatu: "2026-04-16", lifsk: "Z2", gbstk: "B",
    lines: [
      { matnr: "SKU-9010", qty: 1200, netpr: 7.8, werks: "7800" },
      { matnr: "SKU-9015", qty: 800, netpr: 7.2, werks: "7800" },
      { matnr: "SKU-9020", qty: 600, netpr: 12.6, werks: "7800" },
    ],
    note: "Over-max: lines exceed KNMT zzmax_qty ceilings (900/800/300) — Z2 quantity hold.",
  },
  {
    uiOrderId: "SO-11200", excIds: ["exc-013"], bstnk: "PO-WMT-11200", kunnr: W,
    erdat: "2026-04-15", vdatu: "2026-04-24", lifsk: "Z3", gbstk: "B",
    lines: [
      { matnr: "SKU-7800", qty: 40, netpr: 21.5, werks: "4100" },
      { matnr: "SKU-7810", qty: 25, netpr: 21.5, werks: "4100" },
    ],
    note: "Below MOQ: MVKE AUMNG is 72 / 50 — Z3 hold pending round-up or waiver.",
  },
  {
    uiOrderId: "SO-12300", excIds: ["exc-014"], bstnk: "PO-KR-12300", kunnr: K,
    erdat: "2026-04-12", vdatu: "2026-04-22", lifsk: "Z4", gbstk: "B",
    lines: [
      { matnr: "SKU-3500", qty: 170, netpr: 52.0, werks: "3400" },
      { matnr: "SKU-3510", qty: 85, netpr: 54.0, werks: "3400" },
      { matnr: "SKU-3520", qty: 50, netpr: 30.0, werks: "3400" },
    ],
    note: "Pallet config: quantities break full layers (MARM PAL/zzlayer_qty) — Z4 hold.",
  },
  {
    uiOrderId: "SO-13400", excIds: ["exc-015"], bstnk: "PO-WMT-13400", kunnr: W,
    erdat: "2026-04-13", vdatu: "2026-04-22", gbstk: "A",
    lines: [{ matnr: "SKU-0042", qty: 300, netpr: 14.88, werks: "4100" }],
    note: "Pipeline crashed mid-recipe (FAIL_TO_HUMAN) — SAP order untouched, still open.",
  },
  {
    uiOrderId: "SO-14200", excIds: ["exc-016"], bstnk: "PO-TGT-14200", kunnr: T,
    erdat: "2026-04-08", vdatu: "2026-04-18", gbstk: "B",
    lines: [{ matnr: "SKU-1180", qty: 420, netpr: 9.6, werks: "1500" }],
    note: "Delivery delay: LIKP planned 04-18, carrier ETA slipped to 04-24 (6 days late).",
  },
  {
    uiOrderId: "PO-PHR-001", excIds: ["exc-017"], bstnk: "PO-PHR-001", kunnr: W,
    erdat: "2026-04-06", vdatu: "2026-04-15", gbstk: "C",
    lines: [{ matnr: "SKU-8101", qty: 50, netpr: 101.0, werks: "4100" }],
    note: "Price hold auto-released: PO $101.00 vs base $100.00 within 2% tolerance.",
  },
  {
    uiOrderId: "PO-PHR-002", excIds: ["exc-018"], bstnk: "PO-PHR-002", kunnr: K,
    erdat: "2026-04-28", vdatu: "2026-05-07", lifsk: "ZP", gbstk: "B",
    lines: [{ matnr: "SKU-8102", qty: 40, netpr: 105.0, werks: "3400" }],
    note: "Price hold escalate band: PO $105.00 vs base $100.00 (5% > 2% tolerance, < 10% hard block).",
  },
  {
    uiOrderId: "PO-PM-ROUTING-001", excIds: ["exc-021"], bstnk: "PO-PM-ROUTING-001", kunnr: W,
    erdat: "2026-04-27", vdatu: "2026-05-06", gbstk: "C",
    lines: [{ matnr: "SKU-PRICE-MM", qty: 100, netpr: 100.0, werks: "4100", ediPrice: 95.0 }],
    note: "EDI line mismatch routed as PRICE_MISMATCH -> contractual correction; resolved to ERP price.",
  },
  {
    uiOrderId: "SO-CB-001", excIds: ["exc-022"], bstnk: "PO-WMT-CB001", kunnr: W,
    erdat: "2026-04-29", vdatu: "2026-05-08", gbstk: "A",
    lines: [
      { matnr: "SKU-9010", qty: 400, netpr: 7.8, werks: "4100" },
      { matnr: "SKU-9015", qty: 300, netpr: 7.2, werks: "4100" },
    ],
    note: "Mass pricing recalc halted at a conditional gate (circuit breaker) — order untouched.",
  },
  {
    uiOrderId: "SO-NR-001", excIds: ["exc-023"], bstnk: "PO-KR-NR001", kunnr: K,
    erdat: "2026-04-23", vdatu: "2026-05-02", gbstk: "A",
    lines: [{ matnr: "SKU-9020", qty: 250, netpr: 12.6, werks: "3400" }],
    note: "Mass pricing recalc halted (no recipe matched) — order untouched.",
  },
  {
    uiOrderId: "SO-GW-001", excIds: ["exc-024"], bstnk: "PO-TGT-GW001", kunnr: T,
    erdat: "2026-04-20", vdatu: "2026-04-29", gbstk: "A",
    lines: [{ matnr: "SKU-4410", qty: 90, netpr: 8.4, werks: "2500" }],
    note: "Duplicate-PO recipe failed at a gate (FAIL_TO_HUMAN) — order left open.",
  },
  {
    uiOrderId: "PO-PHR-BAD", excIds: ["exc-025"], bstnk: "PO-PHR-BAD", kunnr: C,
    erdat: "2026-04-16", vdatu: "2026-04-25", lifsk: "ZP", gbstk: "B",
    lines: [{ matnr: "SKU-8101", qty: 25, netpr: 103.5, werks: "7800" }],
    note: "Price-hold release recipe crashed — ZP hold still in place.",
  },
  {
    uiOrderId: "PO-WMT-Q1-RESET-001", excIds: ["exc-027", "exc-028"], bstnk: "PO-WMT-Q1-RESET-001", kunnr: W,
    erdat: "2026-05-04", vdatu: "2026-05-11", lifsk: "ZP", gbstk: "B",
    lines: [{ matnr: "SKU-Q1R-2076", qty: 1600, netpr: 21.1, werks: "4100", confirmed: 1280 }],
    note: "Q1 reset: price hold ($21.10 vs base $20.00, escalate band) + back order (ATP 1280/1600, split shipment executed).",
  },
  {
    uiOrderId: "PO-WMT-Q1-RESET-001-R2", excIds: ["exc-029"], bstnk: "PO-WMT-Q1-RESET-001-R2", kunnr: W,
    erdat: "2026-05-05", vdatu: "2026-05-11", gbstk: "C",
    lines: [{ matnr: "SKU-Q1R-2076", qty: 1600, netpr: 21.1, werks: "4100", abgru: "52" }],
    note: "Buyer EDI retransmit 18h later — auto-rejected duplicate (ABGRU 52), 855 ack on original.",
  },
  {
    uiOrderId: "PO-COST-EOQ-2026Q1", excIds: ["exc-030", "exc-031"], bstnk: "PO-COST-EOQ-2026Q1", kunnr: C,
    erdat: "2026-05-06", vdatu: "2026-05-15", lifsk: "Z2", gbstk: "B",
    lines: [
      { matnr: "SKU-COST-EOQ-A", qty: 2000, netpr: 24.0, werks: "7800" },
      { matnr: "SKU-COST-EOQ-B", qty: 2000, netpr: 30.0, werks: "7800" },
    ],
    note: "EOQ push: both lines over KNMT zzmax_qty 1500 (Z2 hold); pallet plan auto-aligned to 6 full pallets each.",
  },
  {
    uiOrderId: "PO-KR-WK15-2026", excIds: ["exc-032", "exc-033"], bstnk: "PO-KR-WK15-2026", kunnr: K,
    erdat: "2026-05-07", vdatu: "2026-05-14", lifsk: "Z3", gbstk: "B",
    lines: [
      { matnr: "SKU-KR-1100", qty: 50, netpr: 19.8, werks: "3400" },
      { matnr: "SKU-KR-1110", qty: 20, netpr: 19.8, werks: "3400" },
    ],
    note: "Wk-15 replenishment: both SKUs below MOQ (Z3 hold); carrier slip auto-re-routed via FedEx direct lane.",
  },
  {
    excIds: ["exc-040"], bstnk: "PO-SED-2026-0418", kunnr: S,
    erdat: "2026-05-12", vdatu: "2026-05-22", gbstk: "B",
    lines: [{ matnr: "SKU-1180", qty: 600, netpr: 9.6, werks: "4100" }],
    note: "Open order targeted by email change request EML-CHG-2026-0051 (quantity reduction).",
  },
  {
    excIds: ["exc-041"], bstnk: "PO-SED-2026-0502", kunnr: S,
    erdat: "2026-05-14", vdatu: "2026-05-26", gbstk: "B",
    lines: [{ matnr: "SKU-7800", qty: 144, netpr: 21.5, werks: "4100" }],
    note: "Open order targeted by email change request EML-CHG-2026-0052 (expedite).",
  },
  {
    excIds: ["exc-042"], bstnk: "PO-WMT-2026-1101", kunnr: W,
    erdat: "2026-05-15", vdatu: "2026-05-27", gbstk: "B",
    lines: [{ matnr: "SKU-0042", qty: 500, netpr: 14.88, werks: "4100" }],
    note: "Open order targeted by email change request EML-CHG-2026-0053 (full cancellation — escalated).",
  },
  {
    excIds: ["exc-043"], bstnk: "PO-KR-2026-0907", kunnr: K,
    erdat: "2026-05-16", vdatu: "2026-05-28", gbstk: "B",
    lines: [{ matnr: "SKU-6110", qty: 220, netpr: 19.8, werks: "3400" }],
    note: "Open order targeted by email change request EML-CHG-2026-0054 (SKU substitution).",
  },
  {
    uiOrderId: "SO-5100012501", excIds: ["exc-045"], bstnk: "PO-WMT-12501", kunnr: W,
    erdat: "2026-05-10", vdatu: "2026-05-15", gbstk: "C",
    lines: [{ matnr: "SKU-3500", qty: 480, netpr: 52.0, werks: "3400" }],
    note: "Short shipment behind complaint EML-CMP-2026-0062: delivery picked 380 of 480 CS.",
  },
  {
    uiOrderId: "EDI-PO-2026-7781", excIds: ["exc-046"], bstnk: "EDI-PO-2026-7781", kunnr: K,
    erdat: "2026-05-22", vdatu: "2026-05-30", gbstk: "A",
    lines: [{ matnr: "SKU-1180", qty: 250, netpr: 9.6, werks: "5200" }],
    note: "Happy-path manual order intake — order auto-created from the email PO.",
  },
];

/* ── vbeln assignment ────────────────────────────────────────────────── */
// `SO-<digits>` UI ids keep their digits zero-padded to 10 so demo
// queries line up visually; everything else draws from a sequential
// 0000090001+ range in declaration order. The mapping is recorded in
// zasoe_exception_link either way.

const VBELN_SEQ_START = 90_001;

function assignVbeln(seeds: readonly OrderSeed[]): Map<OrderSeed, string> {
  const out = new Map<OrderSeed, string>();
  let seq = VBELN_SEQ_START;
  for (const seed of seeds) {
    const m = seed.uiOrderId?.match(/^SO-(\d+)$/);
    const vbeln = m ? m[1].padStart(10, "0") : String(seq++).padStart(10, "0");
    out.set(seed, vbeln);
  }
  const seen = new Set<string>();
  for (const v of out.values()) {
    if (seen.has(v)) throw new Error(`Duplicate vbeln assigned: ${v}`);
    seen.add(v);
  }
  return out;
}

/* ── clean orders (no exception) ─────────────────────────────────────── */

function buildCleanOrders(count: number): OrderSeed[] {
  const out: OrderSeed[] = [];
  for (let i = 0; i < count; i++) {
    const cust = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)];
    const erdat = plusDays("2026-04-01", randInt(0, 54));
    const lineCount = randInt(1, 3);
    const used = new Set<string>();
    const lines: OrderLine[] = [];
    while (lines.length < lineCount) {
      const mat = pick(CLEAN_CATALOG);
      if (used.has(mat.matnr)) continue;
      used.add(mat.matnr);
      lines.push({
        matnr: mat.matnr,
        qty: randInt(2, 40) * 12,
        netpr: mat.pr00 as number,
        werks: pick(PLANTS).werks,
      });
    }
    out.push({
      excIds: [],
      bstnk: `PO-${cust.sortl}-${String(6000 + i)}`,
      kunnr: cust.kunnr,
      erdat,
      vdatu: plusDays(erdat, randInt(7, 14)),
      gbstk: rand() < 0.7 ? "C" : "A",
      lines,
      note: "Clean order — no exception raised.",
    });
  }
  return out;
}

/* ── outbound deliveries (LIKP/LIPS) ─────────────────────────────────── */

interface DeliverySeed {
  vbelnVl: string;
  forUiOrderId: string;
  lfdat: string;
  /** Z-append: carrier-projected ETA (delivery-delay scenarios). */
  zzeta: string | null;
  wadatIst: string | null;
  route: string;
  /** Picked qty override for the first item (short-ship scenario). */
  lfimgOverride?: number;
}

const DELIVERY_SEEDS: readonly DeliverySeed[] = [
  // exc-016: planned 04-18, projected 04-24 (6 days late), not yet shipped
  { vbelnVl: "0080014200", forUiOrderId: "SO-14200", lfdat: "2026-04-18", zzeta: "2026-04-24", wadatIst: null, route: "TR-EAST-2" },
  // exc-033: planned 05-09, carrier slipped to 05-14, re-routed FedEx -> ETA 05-10
  { vbelnVl: "0080090011", forUiOrderId: "PO-KR-WK15-2026", lfdat: "2026-05-09", zzeta: "2026-05-10", wadatIst: null, route: "TR-FEDEX-D" },
  // exc-045: shipped on time but short-picked 380 of 480
  { vbelnVl: "0080012501", forUiOrderId: "SO-5100012501", lfdat: "2026-05-15", zzeta: null, wadatIst: "2026-05-15", route: "TR-MIDW-1", lfimgOverride: 380 },
];

/* ── intake staging (ZEDI_850_IN / ZEMAIL_INTAKE) ────────────────────── */
// Channel rows derive from each exception's event_type:
//   EDI_850_* / DUPLICATE_PO_RECEIVED -> zedi_850_in (+ lines)
//   EMAIL_*                           -> zemail_intake
// SAP-internal events (BACK_ORDER_OOS, OVER_MAX_QTY, MIN_ORDER_QTY,
// PALLET_CONFIG_VIOLATION, DELIVERY_DELAY, CREDIT_LIMIT_BREACH,
// MASS_PRICING_RECALC, ORDER_RECEIVED) have no intake row.

function isEdiEvent(eventType: string): boolean {
  return eventType.startsWith("EDI_850") || eventType === "DUPLICATE_PO_RECEIVED";
}

function isEmailEvent(eventType: string): boolean {
  return eventType.startsWith("EMAIL_");
}

/** Curated staging payloads for exceptions with no SAP order. */
const STAGING_ONLY_EDI_LINES: Record<string, { matnr: string; qty: number; price: number }[]> = {
  // exc-019: inbound references a material absent from MARA — hard reject
  "exc-019": [{ matnr: "SKU-999-UNKNOWN", qty: 80, price: 63.0 }],
  // exc-020: qty mismatch — expected 120 per PO history, received 144
  "exc-020": [{ matnr: "SKU-9020", qty: 144, price: 12.6 }],
};

const EDI_PROC_STATUS_OVERRIDES: Record<string, { status: string; reason: string | null }> = {
  "exc-019": { status: "REJECTED", reason: "Material SKU-999-UNKNOWN not in material master (MARA)" },
  "exc-020": { status: "IN_REVIEW", reason: "Line qty 144 differs from expected 120" },
};

const EMAIL_SUBJECTS: Record<string, string> = {
  "exc-026": "PO 2026-0042 — May order for Atlanta DC",
  "exc-040": "Change request: please reduce quantity on PO-SED-2026-0418",
  "exc-041": "Expedite request — PO-SED-2026-0502",
  "exc-042": "URGENT: cancel PO-WMT-2026-1101 in full",
  "exc-043": "SKU substitution on PO-KR-2026-0907",
  "exc-044": "Order status inquiry — April deliveries",
  "exc-045": "Complaint: short shipment on SO-5100012501",
  "exc-046": "New order — EDI-PO-2026-7781",
  "exc-047": "General question — holiday delivery schedule",
};

/* ── lineage notes (coverage-asserted against MOCK_EXCEPTIONS) ───────── */
// Every exception id MUST appear here. Adding a mock exception without a
// scenario makes the generator fail — keep the replica in sync.

const SCENARIO_NOTES: Record<string, string> = {
  "exc-001": "Expired promo ZPROM/155 (A305/KONP validity) vs EDI price 13.20 in zedi_850_in_lines.",
  "exc-002": "Duplicate pair VBAK 0000001040 / 0000001042; dup order delivery-blocked Z1.",
  "exc-003": "KNKK CC10 breach (142,500 > 125,000, CRBLB=X); VBAK CMGST=B.",
  "exc-004": "MARM CS->EA row intentionally missing for SKU-5521; EDI line priced in EA.",
  "exc-005": "No A304/PR00 record for SKU-0099; ZA01/621 contract rate on the order.",
  "exc-006": "Ambiguous duplicate pair VBAK 0000005008 / 0000005010 (qty drift 15%).",
  "exc-007": "KNKK CC20 at 93.2% of limit; order approved with warning (CMGST=A).",
  "exc-008": "ZTEA/730 expired, Q1 reload ZTEA/731 active in KONH/KONP validity windows.",
  "exc-009": "Exact duplicate auto-rejected: VBAP ABGRU=52 on VBAK 0000008100.",
  "exc-010": "VBEP confirms 480/800; MARD stock across Dallas + 3 alternate DCs.",
  "exc-011": "VBEP split schedule 140 + 60; MARD Houston 140 / Chicago 120.",
  "exc-012": "Lines exceed KNMT zzmax_qty (900/800/300); LIFSK=Z2.",
  "exc-013": "Lines below MVKE AUMNG (72/50); LIFSK=Z3.",
  "exc-014": "Quantities break MARM PAL zzlayer_qty layers; LIFSK=Z4.",
  "exc-015": "Recipe crashed — VBAK 0000013400 untouched (GBSTK=A).",
  "exc-016": "LIKP 0080014200: LFDAT 04-18 vs zzeta_date 04-24 (6 days late).",
  "exc-017": "PO 101.00 vs PR00 100.00 (within 2% tolerance) — hold released, no LIFSK.",
  "exc-018": "PO 105.00 vs PR00 100.00 (escalate band) — LIFSK=ZP.",
  "exc-019": "zedi_850_in REJECTED: line matnr SKU-999-UNKNOWN has no MARA row; no VBAK created.",
  "exc-020": "zedi_850_in IN_REVIEW: received qty 144 vs expected 120; no VBAK created.",
  "exc-021": "EDI line price 95.00 vs PR00 100.00 — routed to contractual correction; resolved.",
  "exc-022": "Mass pricing recalc circuit-breaker halt; VBAK 0000090004 untouched.",
  "exc-023": "Mass pricing recalc no-recipe halt; VBAK 0000090005 untouched.",
  "exc-024": "Duplicate-PO recipe gate failure; VBAK 0000090006 untouched.",
  "exc-025": "Price-hold recipe crash; LIFSK=ZP still set on VBAK 0000090007.",
  "exc-026": "zemail_intake PENDING — extracted PO not yet posted to SAP.",
  "exc-027": "PO 21.10 vs PR00 20.00 on the Q1 reset order; LIFSK=ZP.",
  "exc-028": "Same order: VBEP 1280/1600 split; MARD Atlanta/Memphis/Dallas stock.",
  "exc-029": "Retransmit order auto-rejected (ABGRU=52); duplicate zedi_850_in row.",
  "exc-030": "Both EOQ lines over KNMT zzmax_qty 1500; LIFSK=Z2.",
  "exc-031": "Same order: MARM PAL 300/layer 60 — pallet plan auto-aligned.",
  "exc-032": "Lines below MVKE AUMNG (72/50) on the wk-15 order; LIFSK=Z3.",
  "exc-033": "Same order: LIKP 0080090011 re-routed TR-FEDEX-D, zzeta within 1 day.",
  "exc-040": "zemail_intake change request against VBAK 0000090012.",
  "exc-041": "zemail_intake expedite request against VBAK 0000090013.",
  "exc-042": "zemail_intake cancellation request against VBAK 0000090014 (escalated).",
  "exc-043": "zemail_intake substitution request against VBAK 0000090015.",
  "exc-044": "zemail_intake inquiry — no order reference.",
  "exc-045": "zemail_intake complaint; LIPS 0080012501 picked 380 of VBAP 480.",
  "exc-046": "zemail_intake COMPLETED — VBAK 0000090016 auto-created from email PO.",
  "exc-047": "zemail_intake general correspondence — no order reference.",
};

/* ── schema DDL ──────────────────────────────────────────────────────── */

function schemaSql(): string {
  return `${GENERATED_BANNER}
-- Landing schema for the SAP S/4HANA -> Azure PostgreSQL replication.
-- Table and column names follow the SAP originals (lower-cased); SAP DATS
-- and TIMS columns are mapped to native date/time types by the
-- replication pipeline. Z-prefixed tables/columns are customer
-- extensions, exactly as they exist in the source system. The three
-- _replication columns are the CDC envelope added by the pipeline.
-- kschl is widened to 5 chars (SAP: 4) to carry the ZPROM custom
-- condition type the ASOE UI fixtures reference.

DROP SCHEMA IF EXISTS sap_replica CASCADE;
CREATE SCHEMA sap_replica;
SET search_path TO sap_replica;

-- ── plants ────────────────────────────────────────────────────────────
CREATE TABLE t001w (
  mandt           char(3)      NOT NULL DEFAULT '100',
  werks           varchar(4)   NOT NULL,
  name1           varchar(30)  NOT NULL,
  regio           varchar(3)   NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, werks)
);
COMMENT ON TABLE t001w IS 'Plants / distribution centers (SAP T001W).';

-- ── customer master ───────────────────────────────────────────────────
CREATE TABLE kna1 (
  mandt           char(3)      NOT NULL DEFAULT '100',
  kunnr           varchar(10)  NOT NULL,
  name1           varchar(35)  NOT NULL,
  sortl           varchar(10)  NOT NULL,
  ort01           varchar(35)  NOT NULL,
  regio           varchar(3)   NOT NULL,
  pstlz           varchar(10)  NOT NULL,
  land1           char(2)      NOT NULL DEFAULT 'US',
  ktokd           varchar(4)   NOT NULL DEFAULT 'KUNA',
  erdat           date         NOT NULL DEFAULT '2024-01-15',
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, kunnr)
);
COMMENT ON TABLE kna1 IS 'Customer master, general data (SAP KNA1). kunnr digits match the BP numbers shown in the ASOE UI entity profiles (BP-102440 -> 0000102440).';

CREATE TABLE knvv (
  mandt           char(3)      NOT NULL DEFAULT '100',
  kunnr           varchar(10)  NOT NULL,
  vkorg           varchar(4)   NOT NULL,
  vtweg           varchar(2)   NOT NULL,
  spart           varchar(2)   NOT NULL,
  kdgrp           varchar(2)   NOT NULL,
  waers           char(3)      NOT NULL DEFAULT 'USD',
  inco1           varchar(3)   NOT NULL DEFAULT 'DAP',
  vsbed           varchar(2)   NOT NULL DEFAULT '01',
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, kunnr, vkorg, vtweg, spart),
  FOREIGN KEY (mandt, kunnr) REFERENCES kna1 (mandt, kunnr)
);
COMMENT ON TABLE knvv IS 'Customer master, sales area data (SAP KNVV).';

CREATE TABLE knkk (
  mandt           char(3)      NOT NULL DEFAULT '100',
  kunnr           varchar(10)  NOT NULL,
  kkber           varchar(4)   NOT NULL,
  klimk           numeric(15,2) NOT NULL,
  skfor           numeric(15,2) NOT NULL,
  ctlpc           varchar(3)   NOT NULL,
  crblb           char(1),
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, kunnr, kkber),
  FOREIGN KEY (mandt, kunnr) REFERENCES kna1 (mandt, kunnr)
);
COMMENT ON TABLE knkk IS 'Customer credit management (SAP KNKK): klimk = credit limit, skfor = current exposure, crblb = blocked flag.';

-- ── material master ───────────────────────────────────────────────────
CREATE TABLE mara (
  mandt           char(3)      NOT NULL DEFAULT '100',
  matnr           varchar(18)  NOT NULL,
  mtart           varchar(4)   NOT NULL DEFAULT 'FERT',
  matkl           varchar(9)   NOT NULL,
  meins           varchar(3)   NOT NULL DEFAULT 'CS',
  spart           varchar(2)   NOT NULL DEFAULT '00',
  ersda           date         NOT NULL DEFAULT '2024-06-01',
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, matnr)
);
COMMENT ON TABLE mara IS 'Material master, general data (SAP MARA). SKU-999-UNKNOWN is deliberately absent — the exc-019 hard-reject scenario.';

CREATE TABLE makt (
  mandt           char(3)      NOT NULL DEFAULT '100',
  matnr           varchar(18)  NOT NULL,
  spras           char(1)      NOT NULL DEFAULT 'E',
  maktx           varchar(40)  NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, matnr, spras),
  FOREIGN KEY (mandt, matnr) REFERENCES mara (mandt, matnr)
);
COMMENT ON TABLE makt IS 'Material descriptions (SAP MAKT).';

CREATE TABLE marm (
  mandt           char(3)      NOT NULL DEFAULT '100',
  matnr           varchar(18)  NOT NULL,
  meinh           varchar(3)   NOT NULL,
  umrez           integer      NOT NULL,
  umren           integer      NOT NULL DEFAULT 1,
  zzlayer_qty     integer,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, matnr, meinh),
  FOREIGN KEY (mandt, matnr) REFERENCES mara (mandt, matnr)
);
COMMENT ON TABLE marm IS 'Units of measure (SAP MARM). zzlayer_qty (Z-append) = cases per pallet layer on PAL rows. The CS->EA row for SKU-5521 is intentionally missing (exc-004 UOM error).';

CREATE TABLE mvke (
  mandt           char(3)      NOT NULL DEFAULT '100',
  matnr           varchar(18)  NOT NULL,
  vkorg           varchar(4)   NOT NULL,
  vtweg           varchar(2)   NOT NULL,
  aumng           numeric(13,3) NOT NULL DEFAULT 0,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, matnr, vkorg, vtweg),
  FOREIGN KEY (mandt, matnr) REFERENCES mara (mandt, matnr)
);
COMMENT ON TABLE mvke IS 'Material sales data (SAP MVKE): aumng = minimum order quantity (MOQ scenarios).';

CREATE TABLE knmt (
  mandt           char(3)      NOT NULL DEFAULT '100',
  vkorg           varchar(4)   NOT NULL DEFAULT '1000',
  vtweg           varchar(2)   NOT NULL DEFAULT '10',
  kunnr           varchar(10)  NOT NULL,
  matnr           varchar(18)  NOT NULL,
  kdmat           varchar(35)  NOT NULL,
  zzmax_qty       numeric(13,3),
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, vkorg, vtweg, kunnr, matnr),
  FOREIGN KEY (mandt, kunnr) REFERENCES kna1 (mandt, kunnr),
  FOREIGN KEY (mandt, matnr) REFERENCES mara (mandt, matnr)
);
COMMENT ON TABLE knmt IS 'Customer-material info records (SAP KNMT). zzmax_qty (Z-append) = per-order quantity ceiling (OVER_MAX scenarios).';

CREATE TABLE mard (
  mandt           char(3)      NOT NULL DEFAULT '100',
  matnr           varchar(18)  NOT NULL,
  werks           varchar(4)   NOT NULL,
  lgort           varchar(4)   NOT NULL DEFAULT '0001',
  labst           numeric(13,3) NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, matnr, werks, lgort),
  FOREIGN KEY (mandt, matnr) REFERENCES mara (mandt, matnr),
  FOREIGN KEY (mandt, werks) REFERENCES t001w (mandt, werks)
);
COMMENT ON TABLE mard IS 'Storage-location stock (SAP MARD): labst = unrestricted-use stock (back-order ATP scenarios).';

-- ── pricing condition records ─────────────────────────────────────────
CREATE TABLE konh (
  mandt           char(3)      NOT NULL DEFAULT '100',
  knumh           varchar(10)  NOT NULL,
  kschl           varchar(5)   NOT NULL,
  datab           date         NOT NULL,
  datbi           date         NOT NULL,
  ernam           varchar(12)  NOT NULL DEFAULT 'PRICING_OPS',
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, knumh)
);
COMMENT ON TABLE konh IS 'Condition header (SAP KONH). Validity windows drive the expired-promo scenarios (ZPROM/155, ZTEA/730).';

CREATE TABLE konp (
  mandt           char(3)      NOT NULL DEFAULT '100',
  knumh           varchar(10)  NOT NULL,
  kopos           varchar(2)   NOT NULL DEFAULT '01',
  kschl           varchar(5)   NOT NULL,
  kbetr           numeric(11,2) NOT NULL,
  konwa           char(3)      NOT NULL DEFAULT 'USD',
  kmein           varchar(3)   NOT NULL DEFAULT 'CS',
  loevm_ko        char(1),
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, knumh, kopos),
  FOREIGN KEY (mandt, knumh) REFERENCES konh (mandt, knumh)
);
COMMENT ON TABLE konp IS 'Condition items (SAP KONP): kbetr = rate.';

CREATE TABLE a304 (
  mandt           char(3)      NOT NULL DEFAULT '100',
  kschl           varchar(5)   NOT NULL,
  vkorg           varchar(4)   NOT NULL DEFAULT '1000',
  matnr           varchar(18)  NOT NULL,
  datbi           date         NOT NULL,
  datab           date         NOT NULL,
  knumh           varchar(10)  NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, kschl, vkorg, matnr, datbi),
  FOREIGN KEY (mandt, matnr) REFERENCES mara (mandt, matnr),
  FOREIGN KEY (mandt, knumh) REFERENCES konh (mandt, knumh)
);
COMMENT ON TABLE a304 IS 'Condition access: material list price (SAP A304, PR00). SKU-0099 has no row — the exc-005 missing-price scenario.';

CREATE TABLE a305 (
  mandt           char(3)      NOT NULL DEFAULT '100',
  kschl           varchar(5)   NOT NULL,
  vkorg           varchar(4)   NOT NULL DEFAULT '1000',
  kunnr           varchar(10)  NOT NULL,
  matnr           varchar(18)  NOT NULL,
  datbi           date         NOT NULL,
  datab           date         NOT NULL,
  knumh           varchar(10)  NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL DEFAULT '${MASTER_DATA_LOAD_AT}',
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, kschl, vkorg, kunnr, matnr, datbi),
  FOREIGN KEY (mandt, kunnr) REFERENCES kna1 (mandt, kunnr),
  FOREIGN KEY (mandt, matnr) REFERENCES mara (mandt, matnr),
  FOREIGN KEY (mandt, knumh) REFERENCES konh (mandt, knumh)
);
COMMENT ON TABLE a305 IS 'Condition access: customer/material (SAP A305) — contract (ZA01) and promo (ZPROM/ZTEA) records.';

-- ── sales documents ───────────────────────────────────────────────────
CREATE TABLE vbak (
  mandt           char(3)      NOT NULL DEFAULT '100',
  vbeln           varchar(10)  NOT NULL,
  erdat           date         NOT NULL,
  erzet           time         NOT NULL,
  auart           varchar(4)   NOT NULL DEFAULT 'ZOR',
  vkorg           varchar(4)   NOT NULL DEFAULT '1000',
  vtweg           varchar(2)   NOT NULL DEFAULT '10',
  spart           varchar(2)   NOT NULL DEFAULT '00',
  kunnr           varchar(10)  NOT NULL,
  bstnk           varchar(35)  NOT NULL,
  bstdk           date         NOT NULL,
  vdatu           date         NOT NULL,
  netwr           numeric(15,2) NOT NULL,
  waerk           char(3)      NOT NULL DEFAULT 'USD',
  knumv           varchar(10)  NOT NULL,
  lifsk           varchar(2),
  faksk           varchar(2),
  cmgst           char(1),
  gbstk           char(1)      NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, vbeln),
  FOREIGN KEY (mandt, kunnr) REFERENCES kna1 (mandt, kunnr)
);
COMMENT ON TABLE vbak IS 'Sales order header (SAP VBAK; S/4HANA — VBUK status fields folded in). bstnk = customer PO number, lifsk = delivery block (Z1 dup / Z2 over-max / Z3 MOQ / Z4 pallet / ZP pricing), cmgst = credit status, gbstk = overall status (A open / B in process / C complete).';

CREATE TABLE vbap (
  mandt           char(3)      NOT NULL DEFAULT '100',
  vbeln           varchar(10)  NOT NULL,
  posnr           varchar(6)   NOT NULL,
  matnr           varchar(18)  NOT NULL,
  arktx           varchar(40)  NOT NULL,
  kwmeng          numeric(15,3) NOT NULL,
  vrkme           varchar(3)   NOT NULL DEFAULT 'CS',
  netpr           numeric(11,2) NOT NULL,
  netwr           numeric(15,2) NOT NULL,
  werks           varchar(4)   NOT NULL,
  abgru           varchar(2),
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, vbeln, posnr),
  FOREIGN KEY (mandt, vbeln) REFERENCES vbak (mandt, vbeln),
  FOREIGN KEY (mandt, matnr) REFERENCES mara (mandt, matnr),
  FOREIGN KEY (mandt, werks) REFERENCES t001w (mandt, werks)
);
COMMENT ON TABLE vbap IS 'Sales order items (SAP VBAP). abgru = rejection reason (52 = duplicate order).';

CREATE TABLE vbep (
  mandt           char(3)      NOT NULL DEFAULT '100',
  vbeln           varchar(10)  NOT NULL,
  posnr           varchar(6)   NOT NULL,
  etenr           varchar(4)   NOT NULL,
  edatu           date         NOT NULL,
  wmeng           numeric(15,3) NOT NULL,
  bmeng           numeric(15,3) NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, vbeln, posnr, etenr),
  FOREIGN KEY (mandt, vbeln, posnr) REFERENCES vbap (mandt, vbeln, posnr)
);
COMMENT ON TABLE vbep IS 'Schedule lines (SAP VBEP): wmeng = requested, bmeng = ATP-confirmed. bmeng < wmeng marks the back-order scenarios.';

CREATE TABLE vbpa (
  mandt           char(3)      NOT NULL DEFAULT '100',
  vbeln           varchar(10)  NOT NULL,
  posnr           varchar(6)   NOT NULL DEFAULT '000000',
  parvw           char(2)      NOT NULL,
  kunnr           varchar(10)  NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, vbeln, posnr, parvw),
  FOREIGN KEY (mandt, vbeln) REFERENCES vbak (mandt, vbeln),
  FOREIGN KEY (mandt, kunnr) REFERENCES kna1 (mandt, kunnr)
);
COMMENT ON TABLE vbpa IS 'Document partners (SAP VBPA): AG = sold-to, WE = ship-to. Ship-to rows carry the BP numbers the ASOE UI shows in entity profiles.';

CREATE TABLE prcd_elements (
  mandt           char(3)      NOT NULL DEFAULT '100',
  knumv           varchar(10)  NOT NULL,
  kposn           varchar(6)   NOT NULL,
  stunr           varchar(3)   NOT NULL,
  kschl           varchar(5)   NOT NULL,
  kbetr           numeric(11,2) NOT NULL,
  waers           char(3)      NOT NULL DEFAULT 'USD',
  kwert           numeric(15,2) NOT NULL,
  kinak           char(1),
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, knumv, kposn, stunr)
);
COMMENT ON TABLE prcd_elements IS 'Document pricing conditions (S/4HANA PRCD_ELEMENTS, classic KONV). kinak = inactive flag — expired promos appear inactive (exc-001).';

CREATE TABLE likp (
  mandt           char(3)      NOT NULL DEFAULT '100',
  vbeln           varchar(10)  NOT NULL,
  lfdat           date         NOT NULL,
  wadat_ist       date,
  route           varchar(10)  NOT NULL,
  vstel           varchar(4)   NOT NULL,
  kunnr           varchar(10)  NOT NULL,
  zzeta_date      date,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, vbeln),
  FOREIGN KEY (mandt, kunnr) REFERENCES kna1 (mandt, kunnr)
);
COMMENT ON TABLE likp IS 'Outbound delivery header (SAP LIKP). zzeta_date (Z-append) = carrier-projected ETA fed by the TM integration — drives the delivery-delay scenarios.';

CREATE TABLE lips (
  mandt           char(3)      NOT NULL DEFAULT '100',
  vbeln           varchar(10)  NOT NULL,
  posnr           varchar(6)   NOT NULL,
  vgbel           varchar(10)  NOT NULL,
  vgpos           varchar(6)   NOT NULL,
  matnr           varchar(18)  NOT NULL,
  lfimg           numeric(13,3) NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, vbeln, posnr),
  FOREIGN KEY (mandt, vbeln) REFERENCES likp (mandt, vbeln),
  FOREIGN KEY (mandt, vgbel, vgpos) REFERENCES vbap (mandt, vbeln, posnr)
);
COMMENT ON TABLE lips IS 'Outbound delivery items (SAP LIPS): vgbel/vgpos reference the sales order item; lfimg < ordered qty marks the short-ship scenario (exc-045).';

-- ── intake channel staging (customer Z-tables) ────────────────────────
CREATE TABLE zedi_850_in (
  mandt           char(3)      NOT NULL DEFAULT '100',
  edi_msg_id      varchar(20)  NOT NULL,
  isa_ctrl        varchar(9)   NOT NULL,
  gs_ctrl         varchar(9)   NOT NULL,
  st_ctrl         varchar(9)   NOT NULL,
  sndprn          varchar(20)  NOT NULL,
  po_number       varchar(35)  NOT NULL,
  po_date         date         NOT NULL,
  received_at     timestamptz  NOT NULL,
  idoc_num        varchar(16)  NOT NULL,
  proc_status     varchar(12)  NOT NULL,
  reject_reason   text,
  vbeln           varchar(10),
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, edi_msg_id),
  FOREIGN KEY (mandt, vbeln) REFERENCES vbak (mandt, vbeln)
);
COMMENT ON TABLE zedi_850_in IS 'Inbound EDI 850 staging (custom Z-table over the IDoc layer). Keeps the AS-RECEIVED payload; proc_status: POSTED / BLOCKED / REJECTED / IN_REVIEW.';

CREATE TABLE zedi_850_in_lines (
  mandt           char(3)      NOT NULL DEFAULT '100',
  edi_msg_id      varchar(20)  NOT NULL,
  line_no         integer      NOT NULL,
  matnr_received  varchar(18)  NOT NULL,
  qty             numeric(13,3) NOT NULL,
  uom             varchar(3)   NOT NULL DEFAULT 'CS',
  unit_price      numeric(11,2) NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, edi_msg_id, line_no),
  FOREIGN KEY (mandt, edi_msg_id) REFERENCES zedi_850_in (mandt, edi_msg_id)
);
COMMENT ON TABLE zedi_850_in_lines IS 'Inbound EDI 850 line staging. matnr_received is the unvalidated buyer payload — deliberately NO foreign key to MARA (exc-019 references SKU-999-UNKNOWN).';

CREATE TABLE zemail_intake (
  mandt           char(3)      NOT NULL DEFAULT '100',
  email_msg_id    varchar(20)  NOT NULL,
  from_address    varchar(120) NOT NULL,
  received_at     timestamptz  NOT NULL,
  subject         varchar(200) NOT NULL,
  classification  varchar(40)  NOT NULL,
  ref_bstnk       varchar(35),
  ref_vbeln       varchar(10),
  proc_status     varchar(12)  NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'SAPS4PRD',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (mandt, email_msg_id),
  FOREIGN KEY (mandt, ref_vbeln) REFERENCES vbak (mandt, vbeln)
);
COMMENT ON TABLE zemail_intake IS 'Customer-inbox intake staging (custom Z-table fed by the email intelligence agent). proc_status: PENDING / IN_REVIEW / COMPLETED / ESCALATED.';

-- ── ASOE lineage (integration-maintained mapping) ─────────────────────
CREATE TABLE zasoe_exception_link (
  exception_id    varchar(20)  NOT NULL,
  ui_order_id     varchar(35)  NOT NULL,
  vbeln           varchar(10),
  edi_msg_id      varchar(20),
  email_msg_id    varchar(20),
  intent          varchar(40)  NOT NULL,
  lifecycle_state varchar(30)  NOT NULL,
  scenario        text         NOT NULL,
  _source_system  text         NOT NULL DEFAULT 'ASOE',
  _replicated_at  timestamptz  NOT NULL,
  _replication_op char(1)      NOT NULL DEFAULT 'I',
  PRIMARY KEY (exception_id)
);
COMMENT ON TABLE zasoe_exception_link IS 'Demo lineage: maps each ASOE UI exception (src/lib/mock-data/exceptions.ts) to the SAP documents that substantiate it. intent/lifecycle_state are denormalised copies for demo joins — the ASOE store remains authoritative.';
`;
}

/* ── data emission ───────────────────────────────────────────────────── */

function masterDataSql(): string {
  let sql = `${GENERATED_BANNER}\nSET search_path TO sap_replica;\n\n`;

  sql += insertRows(
    "t001w",
    ["werks", "name1", "regio"],
    PLANTS.map((p) => [p.werks, p.name1, p.regio]),
  );

  sql += insertRows(
    "kna1",
    ["kunnr", "name1", "sortl", "ort01", "regio", "pstlz"],
    CUSTOMERS.map((c) => [c.kunnr, c.name1, c.sortl, c.ort01, c.regio, c.pstlz]),
  );

  sql += insertRows(
    "knvv",
    ["kunnr", "vkorg", "vtweg", "spart", "kdgrp"],
    CUSTOMERS.map((c) => [c.kunnr, "1000", "10", "00", c.accountId ? "01" : "02"]),
  );

  sql += insertRows(
    "knkk",
    ["kunnr", "kkber", "klimk", "skfor", "ctlpc", "crblb"],
    KNKK_RECORDS.map((r) => [r.kunnr, r.kkber, money(r.klimk), money(r.skfor), r.ctlpc, r.crblb]),
  );

  sql += insertRows(
    "mara",
    ["matnr", "matkl"],
    MATERIALS.map((m) => [m.matnr, m.matkl]),
  );

  sql += insertRows(
    "makt",
    ["matnr", "maktx"],
    MATERIALS.map((m) => [m.matnr, m.maktx]),
  );

  const marmRows: SqlValue[][] = [];
  for (const m of MATERIALS) {
    marmRows.push([m.matnr, "CS", 1, 1, null]);
    if (m.eaPerCs) marmRows.push([m.matnr, "EA", 1, m.eaPerCs, null]);
    if (m.pal) marmRows.push([m.matnr, "PAL", m.pal.umrez, 1, m.pal.layer]);
  }
  sql += insertRows("marm", ["matnr", "meinh", "umrez", "umren", "zzlayer_qty"], marmRows);

  sql += insertRows(
    "mvke",
    ["matnr", "vkorg", "vtweg", "aumng"],
    MATERIALS.map((m) => [m.matnr, "1000", "10", m.aumng ?? 0]),
  );

  sql += insertRows(
    "knmt",
    ["kunnr", "matnr", "kdmat", "zzmax_qty"],
    KNMT_RECORDS.map((r) => [r.kunnr, r.matnr, `C-${r.matnr}`, r.zzmaxQty]),
  );

  sql += insertRows(
    "mard",
    ["matnr", "werks", "labst"],
    MARD_RECORDS.map((r) => [r.matnr, r.werks, r.labst]),
  );

  sql += insertRows(
    "konh",
    ["knumh", "kschl", "datab", "datbi"],
    COND_RECORDS.map((r) => [r.knumh, r.kschl, r.datab, r.datbi]),
  );

  sql += insertRows(
    "konp",
    ["knumh", "kschl", "kbetr"],
    COND_RECORDS.map((r) => [r.knumh, r.kschl, money(r.kbetr)]),
  );

  sql += insertRows(
    "a304",
    ["kschl", "matnr", "datbi", "datab", "knumh"],
    COND_RECORDS.filter((r) => !r.kunnr).map((r) => [r.kschl, r.matnr, r.datbi, r.datab, r.knumh]),
  );

  sql += insertRows(
    "a305",
    ["kschl", "kunnr", "matnr", "datbi", "datab", "knumh"],
    COND_RECORDS.filter((r) => r.kunnr).map((r) => [r.kschl, r.kunnr as string, r.matnr, r.datbi, r.datab, r.knumh]),
  );

  return sql;
}

interface BuiltOrders {
  sql: string;
  vbelnBySeed: Map<OrderSeed, string>;
  vbelnByUiOrderId: Map<string, string>;
  orderCount: number;
}

function salesDocumentsSql(allOrders: readonly OrderSeed[]): BuiltOrders {
  const vbelnBySeed = assignVbeln(allOrders);
  const vbelnByUiOrderId = new Map<string, string>();
  for (const seed of allOrders) {
    if (seed.uiOrderId) vbelnByUiOrderId.set(seed.uiOrderId, vbelnBySeed.get(seed) as string);
  }

  const vbakRows: SqlValue[][] = [];
  const vbapRows: SqlValue[][] = [];
  const vbepRows: SqlValue[][] = [];
  const vbpaRows: SqlValue[][] = [];
  const prcdRows: SqlValue[][] = [];

  for (const seed of allOrders) {
    const vbeln = vbelnBySeed.get(seed) as string;
    const knumv = `9${vbeln.slice(1)}`;
    const netwr = seed.lines.reduce((acc, l) => acc + l.qty * l.netpr, 0);
    const erzet = `${String(7 + (Number(vbeln.slice(-2)) % 11)).padStart(2, "0")}:15:00`;
    const repAt = replicatedAt(`${seed.erdat}T12:00:00Z`);

    vbakRows.push([
      vbeln, seed.erdat, erzet, seed.kunnr, seed.bstnk, seed.erdat, seed.vdatu,
      money(netwr), knumv, seed.lifsk ?? null, seed.cmgst ?? null, seed.gbstk, repAt,
    ]);

    vbpaRows.push([vbeln, "AG", seed.kunnr, repAt]);
    vbpaRows.push([vbeln, "WE", seed.shipTo ?? seed.kunnr, repAt]);

    seed.lines.forEach((line, i) => {
      const posnr = String((i + 1) * 10).padStart(6, "0");
      const mat = MATERIAL_BY_MATNR.get(line.matnr);
      if (!mat) throw new Error(`Order ${seed.bstnk} references unknown material ${line.matnr}`);

      vbapRows.push([
        vbeln, posnr, line.matnr, mat.maktx, line.qty, money(line.netpr),
        money(line.qty * line.netpr), line.werks, line.abgru ?? null, repAt,
      ]);

      const confirmed = line.confirmed ?? line.qty;
      vbepRows.push([vbeln, posnr, "0001", seed.vdatu, line.qty, confirmed, repAt]);
      if (confirmed < line.qty) {
        vbepRows.push([vbeln, posnr, "0002", plusDays(seed.vdatu, 7), 0, line.qty - confirmed, repAt]);
      }

      let stunr = 10;
      const baseRate = mat.pr00 ?? line.netpr;
      prcdRows.push([knumv, posnr, String(stunr).padStart(3, "0"), "PR00", money(baseRate), money(baseRate * line.qty), null, repAt]);
      for (const cond of line.conds ?? []) {
        stunr += 10;
        prcdRows.push([
          knumv, posnr, String(stunr).padStart(3, "0"), cond.kschl, money(cond.kbetr),
          money(cond.inactive ? 0 : cond.kbetr * line.qty), cond.inactive ? "X" : null, repAt,
        ]);
      }
    });
  }

  const likpRows: SqlValue[][] = [];
  const lipsRows: SqlValue[][] = [];
  for (const d of DELIVERY_SEEDS) {
    const orderVbeln = vbelnByUiOrderId.get(d.forUiOrderId);
    if (!orderVbeln) throw new Error(`Delivery ${d.vbelnVl} references unknown order ${d.forUiOrderId}`);
    const seed = allOrders.find((s) => vbelnBySeed.get(s) === orderVbeln) as OrderSeed;
    const repAt = replicatedAt(`${d.lfdat}T06:00:00Z`);
    likpRows.push([d.vbelnVl, d.lfdat, d.wadatIst, d.route, seed.lines[0].werks, seed.shipTo ?? seed.kunnr, d.zzeta, repAt]);
    seed.lines.forEach((line, i) => {
      const posnr = String((i + 1) * 10).padStart(6, "0");
      const lfimg = i === 0 && d.lfimgOverride !== undefined ? d.lfimgOverride : (line.confirmed ?? line.qty);
      lipsRows.push([d.vbelnVl, posnr, orderVbeln, posnr, line.matnr, lfimg, repAt]);
    });
  }

  let sql = `${GENERATED_BANNER}\nSET search_path TO sap_replica;\n\n`;
  sql += insertRows(
    "vbak",
    ["vbeln", "erdat", "erzet", "kunnr", "bstnk", "bstdk", "vdatu", "netwr", "knumv", "lifsk", "cmgst", "gbstk", "_replicated_at"],
    vbakRows,
  );
  sql += insertRows(
    "vbap",
    ["vbeln", "posnr", "matnr", "arktx", "kwmeng", "netpr", "netwr", "werks", "abgru", "_replicated_at"],
    vbapRows,
  );
  sql += insertRows(
    "vbep",
    ["vbeln", "posnr", "etenr", "edatu", "wmeng", "bmeng", "_replicated_at"],
    vbepRows,
  );
  sql += insertRows("vbpa", ["vbeln", "parvw", "kunnr", "_replicated_at"], vbpaRows);
  sql += insertRows(
    "prcd_elements",
    ["knumv", "kposn", "stunr", "kschl", "kbetr", "kwert", "kinak", "_replicated_at"],
    prcdRows,
  );
  sql += insertRows(
    "likp",
    ["vbeln", "lfdat", "wadat_ist", "route", "vstel", "kunnr", "zzeta_date", "_replicated_at"],
    likpRows,
  );
  sql += insertRows(
    "lips",
    ["vbeln", "posnr", "vgbel", "vgpos", "matnr", "lfimg", "_replicated_at"],
    lipsRows,
  );

  return { sql, vbelnBySeed, vbelnByUiOrderId, orderCount: allOrders.length };
}

interface IntakeIds {
  ediByExcId: Map<string, string>;
  emailByExcId: Map<string, string>;
}

function intakeSql(built: BuiltOrders): { sql: string; ids: IntakeIds } {
  const ediByExcId = new Map<string, string>();
  const emailByExcId = new Map<string, string>();

  const orderByExcId = new Map<string, OrderSeed>();
  for (const [seed] of built.vbelnBySeed) {
    for (const excId of seed.excIds) {
      // Keep the order that carries the exception's own uiOrderId when
      // a pair exists (duplicate scenarios list two orders per excId).
      const existing = orderByExcId.get(excId);
      if (!existing || seed.uiOrderId) orderByExcId.set(excId, seed);
    }
  }

  const ediRows: SqlValue[][] = [];
  const ediLineRows: SqlValue[][] = [];
  const emailRows: SqlValue[][] = [];
  let ediSeq = 1;
  let emailSeq = 1;

  for (const exc of MOCK_EXCEPTIONS) {
    const cust = CUSTOMER_BY_ACCOUNT.get(exc.account_id ?? "");
    const receivedAt = exc.created_at;
    const repAt = replicatedAt(receivedAt);
    const order = orderByExcId.get(exc.id);
    const vbeln = order ? (built.vbelnBySeed.get(order) as string) : null;

    if (isEdiEvent(exc.event_type)) {
      const msgId = `EDI-2026-${String(ediSeq).padStart(4, "0")}`;
      ediSeq += 1;
      ediByExcId.set(exc.id, msgId);

      const override = EDI_PROC_STATUS_OVERRIDES[exc.id];
      const status = override
        ? override.status
        : exc.lifecycle_state === "BLOCKED"
          ? "BLOCKED"
          : "POSTED";
      const poNumber = order?.bstnk ?? exc.order_id;
      const poDate = order?.erdat ?? receivedAt.slice(0, 10);

      ediRows.push([
        msgId,
        String(100000 + ediSeq).padStart(9, "0"),
        String(2000 + ediSeq).padStart(9, "0"),
        String(ediSeq).padStart(9, "0"),
        cust ? `GLN-${cust.kunnr.slice(-6)}` : "GLN-UNKNOWN",
        poNumber, poDate, receivedAt,
        `49000000${String(ediSeq).padStart(6, "0")}`.slice(0, 16),
        status, override?.reason ?? null, vbeln, repAt,
      ]);

      const curated = STAGING_ONLY_EDI_LINES[exc.id];
      const lines = curated
        ? curated.map((l, i) => ({ lineNo: i + 1, matnr: l.matnr, qty: l.qty, price: l.price }))
        : (order?.lines ?? []).map((l, i) => ({
            lineNo: i + 1,
            matnr: l.matnr,
            qty: l.qty,
            price: l.ediPrice ?? l.netpr,
          }));
      for (const l of lines) {
        ediLineRows.push([msgId, l.lineNo, l.matnr, l.qty, money(l.price), repAt]);
      }
    }

    if (isEmailEvent(exc.event_type)) {
      const msgId = `MSG-2026-${String(emailSeq).padStart(4, "0")}`;
      emailSeq += 1;
      emailByExcId.set(exc.id, msgId);

      const status =
        exc.lifecycle_state === "RESOLVED" || exc.lifecycle_state === "CLOSED"
          ? "COMPLETED"
          : exc.lifecycle_state === "ESCALATED"
            ? "ESCALATED"
            : "PENDING";

      emailRows.push([
        msgId,
        cust?.ediFrom ?? "unknown@customer.example.com",
        receivedAt,
        EMAIL_SUBJECTS[exc.id] ?? `Customer correspondence (${exc.event_type})`,
        exc.event_type,
        order?.bstnk ?? exc.order_id,
        vbeln,
        status,
        repAt,
      ]);
    }
  }

  let sql = `${GENERATED_BANNER}\nSET search_path TO sap_replica;\n\n`;
  sql += insertRows(
    "zedi_850_in",
    ["edi_msg_id", "isa_ctrl", "gs_ctrl", "st_ctrl", "sndprn", "po_number", "po_date", "received_at", "idoc_num", "proc_status", "reject_reason", "vbeln", "_replicated_at"],
    ediRows,
  );
  sql += insertRows(
    "zedi_850_in_lines",
    ["edi_msg_id", "line_no", "matnr_received", "qty", "unit_price", "_replicated_at"],
    ediLineRows,
  );
  sql += insertRows(
    "zemail_intake",
    ["email_msg_id", "from_address", "received_at", "subject", "classification", "ref_bstnk", "ref_vbeln", "proc_status", "_replicated_at"],
    emailRows,
  );

  return { sql, ids: { ediByExcId, emailByExcId } };
}

function lineageSql(built: BuiltOrders, ids: IntakeIds): string {
  const orderByExcId = new Map<string, string>();
  for (const [seed, vbeln] of built.vbelnBySeed) {
    for (const excId of seed.excIds) {
      const existing = orderByExcId.get(excId);
      if (!existing || seed.uiOrderId) orderByExcId.set(excId, vbeln);
    }
  }

  const rows: SqlValue[][] = MOCK_EXCEPTIONS.map((exc) => {
    const note = SCENARIO_NOTES[exc.id];
    if (!note) {
      throw new Error(
        `Coverage gap: MOCK_EXCEPTIONS contains ${exc.id} (${exc.intent}) but ` +
          `scripts/generate-synthetic-data.ts has no SCENARIO_NOTES entry for it. ` +
          `Add a scenario (order seed / staging payload / note) so the SAP replica stays in sync.`,
      );
    }
    return [
      exc.id, exc.order_id, orderByExcId.get(exc.id) ?? null,
      ids.ediByExcId.get(exc.id) ?? null, ids.emailByExcId.get(exc.id) ?? null,
      exc.intent ?? "UNCLASSIFIED", exc.lifecycle_state ?? "UNKNOWN",
      note, replicatedAt(exc.updated_at),
    ];
  });

  const staleNotes = Object.keys(SCENARIO_NOTES).filter(
    (id) => !MOCK_EXCEPTIONS.some((e) => e.id === id),
  );
  if (staleNotes.length > 0) {
    throw new Error(
      `Stale SCENARIO_NOTES entries (no matching MOCK_EXCEPTIONS row): ${staleNotes.join(", ")}`,
    );
  }

  let sql = `${GENERATED_BANNER}\nSET search_path TO sap_replica;\n\n`;
  sql += insertRows(
    "zasoe_exception_link",
    ["exception_id", "ui_order_id", "vbeln", "edi_msg_id", "email_msg_id", "intent", "lifecycle_state", "scenario", "_replicated_at"],
    rows,
  );
  return sql;
}

/* ── main ────────────────────────────────────────────────────────────── */

function main(): void {
  const cleanOrders = buildCleanOrders(25);
  const allOrders = [...ORDER_SEEDS, ...cleanOrders];

  const built = salesDocumentsSql(allOrders);
  const intake = intakeSql(built);
  const lineage = lineageSql(built, intake.ids); // also runs the coverage assertion

  mkdirSync(OUT_DIR, { recursive: true });
  const files: Record<string, string> = {
    "00_schema.sql": schemaSql(),
    "10_master_data.sql": masterDataSql(),
    "20_sales_documents.sql": built.sql,
    "30_intake_channels.sql": intake.sql,
    "40_asoe_lineage.sql": lineage,
  };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(OUT_DIR, name), content);
  }

  const ediCount = intake.ids.ediByExcId.size;
  const emailCount = intake.ids.emailByExcId.size;
  console.log(
    `Synthetic SAP replica generated in data/synthetic/:\n` +
      `  exceptions covered : ${MOCK_EXCEPTIONS.length}\n` +
      `  sales orders       : ${built.orderCount} (${ORDER_SEEDS.length} scenario + ${cleanOrders.length} clean)\n` +
      `  customers          : ${CUSTOMERS.length}\n` +
      `  materials          : ${MATERIALS.length}\n` +
      `  EDI staging msgs   : ${ediCount}\n` +
      `  email intake msgs  : ${emailCount}`,
  );
}

main();
