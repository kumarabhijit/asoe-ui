# RFC: Placing the synthetic SAP data correctly (cross-repo)

**Status:** Accepted (decisions recorded below) — **execution blocked on asoe2 write access**
**Repos:** `kumarabhijit/asoe-ui` (this repo), `kumarabhijit/asoe2` (backend)
**Permanent home:** this RFC should move to asoe2 `docs/adr/` as an ADR once asoe2
is writable; it lives here only because asoe-ui is the sole repo in the current
session's scope.

> This RFC supersedes the placement implied by the synthetic-data work currently
> on branch `claude/peaceful-pasteur-bw2fex` (PR #250). That work put a raw
> SAP-table Postgres replica + generator under `data/synthetic/` in **this**
> repo. Reading asoe2 showed that to be both the wrong repo **and** the wrong
> layer. Details and the corrected design follow.

---

## 1. Decisions recorded

1. **SAP integration direction — "A now, B as ADR".**
   - **A (now):** fold the synthetic scenarios into asoe2's *existing*
     domain-shaped sandbox seed (`tests/sandbox/seed.py`) + stub gateways.
     No raw SAP tables. Honest to the architecture asoe2 actually runs.
   - **B (deferred ADR):** a future `ASOE_SAP_DRIVER=azure_replica` gateway
     that reads a Postgres SAP replica — i.e. the "replicate SAP → Azure DB"
     pattern — written up as an asoe2 ADR, adopted only if/when replication
     replaces OData as the SAP read path.
2. **asoe-ui mock layer — "generate from catalog".** `src/lib/mock-data/`
   (the Vercel-preview data) is **re-derived** from an exported scenario
   catalog owned by asoe2, the same way `src/types/generated.ts` is generated
   from asoe2's OpenAPI and reason-tags are snapshot-synced.
3. **PR #250 disposition — parked** by request; see §9.

---

## 2. The governing boundary

The platform runs three modes. They differ **only** in which gateway adapter
backs the SAP port — not in any code above it:

| Mode | `ASOE_ENV` | SAP data path |
|---|---|---|
| **local sandbox** | `sandbox` (default) | in-process `StubGateway` set (`api/sandbox_gateways.py`) reading the domain-shaped SQLite from `tests/sandbox/seed.py` |
| **Vercel preview** | n/a (no backend) | asoe-ui `MOCK_*` only |
| **Azure pre-prod** | `preprod` (`api/preprod_gateways.py`) | live-or-stub router swaps in `gateways/sap_live.py` (S/4HANA **OData**) when `ASOE_SAP_DRIVER=s4hana`; else the same stubs |

Governing principle: **synthetic SAP data lives below the gateway port; asoe-ui
lives above the API. The UI cannot observe whether the backend behind it reads
synthetic or live SAP, so synthetic SAP data cannot be an asoe-ui artifact.**
The only thing asoe-ui owns below the line is its mock substitute for the whole
backend (`MOCK_*`), used solely in Vercel mode.

---

## 3. Finding: how asoe2 actually integrates SAP

Confirmed by reading asoe2 `main` (hexagonal / ports-and-adapters, Python):

- **SAP is read live via OData**, not from a replicated DB. `gateways/sap_live.py`
  uses `ASOE_SAP_HOST/USER/PASSWORD/CLIENT`, activates on `ASOE_SAP_DRIVER=s4hana`,
  and returns domain `GatewayResponse` objects (`sap_order`, `sap_doc`,
  `sap_contract`) from `contracts/models.py`. **No raw SAP table names**
  (`vbak`/`vbap`/`konv`) appear anywhere — OData endpoints encapsulate them.
- **The sandbox SAP double is domain-shaped, and already exists.**
  `tests/sandbox/seed.py` builds 8 tables — `customers`,
  `distribution_centers`, `sap_pricing`, `retailer_contracts`, `promotions`,
  `credit_profiles`, `edi_events` (+1) — with ~60 inline EDI events spanning
  the same intents as our UI mocks (CONTRACTUAL_CORRECTION, CREDIT_BLOCK,
  MASS_PRICING_ERROR, DUPLICATE_PO, plus PRICE_HOLD / EDI_LINE_MISMATCH /
  BACK_ORDER_OOS / OVER_MAX_QTY / MIN_ORDER_QTY / PALLET_CONFIG / DELIVERY_DELAY).
- **The stubs read that seed.** `api/sandbox_gateways.py` registers the
  in-process `StubGateway` set (SAP doc/contract/block-status + customer-master
  + promotion + OMS + SLA + buyer-notification); `api/preprod_gateways.py`
  boots the same set and swaps live connectors per driver env var.
- **`db/migrations/V001…V022`** are the ASOE *application* schema (cases, audit
  hash-chain, order_case, classification) — also not SAP tables.
- Adjacent existing machinery: `scripts/seed-fixtures/*.event.json`
  (`ResolveRequest` demo events, `metadata.synthetic=true`),
  `scripts/reconcile_sap_block_codes.py` (SAP block-code fixtures),
  `gateways/recorded_backend.py` (`tests/fixtures/gateway/<gw>/<case>.recorded.json`
  for the extraction gateway), and asoe2's own `docker-compose.yml`
  (core/api/Streamlit-ui/inference/postgres+pgvector/redis + a `sandbox-db`
  volume).

**Consequence:** the `data/synthetic/` Postgres replica (raw `vbak`/`vbap`/`konv`
+ DDL + emails + compose) on PR #250 models a layer asoe2 does not consume. It
is mis-shaped, not just mis-placed. Under Decision A it is **re-authored** into
the domain seed shape, not lifted across.

Also note the terminology gap to avoid: pre-prod's "real DB" is asoe2's own
**application** Postgres (cases/audit). It is **not** a SAP replica. SAP in
pre-prod comes via the live OData connector.

---

## 4. Decision A — fold into the domain-shaped seed (do now)

**Source of truth:** asoe2's sandbox seed + `contracts/models.py` + taxonomy.
The SAP scenario universe is owned where the backend produces exceptions.

Work items, all in **asoe2**:

1. Introduce a **scenario catalog** (`fixtures/scenarios/catalog.yaml`, compliance-
   reviewable) — schema in §6 — as the single declarative source the seed is
   generated from.
2. Refactor `tests/sandbox/seed.py` to **generate its 8-table rows from the
   catalog** (keeping its current inline data as the migrated baseline), and add
   a coverage lock (`seed ⊇ catalog`) to asoe2 CI.
3. Map our 41 scenarios onto the catalog; author only the genuinely-new ones
   (heavy overlap with the existing ~60 events is expected — same intents).
4. Move the 9 `.eml` fixtures to asoe2 `email_intelligence/` fixtures (or
   `tests/fixtures/gateway/msgraph_intake/`) and add a parse/intake test. They
   feed the email-intake path; the UI only renders results.
5. Retire `data/synthetic/*.sql` + `scripts/generate-synthetic-data.ts` +
   `data/synthetic/docker-compose.yml` from asoe-ui (sandbox orchestration stays
   in asoe2's existing `docker-compose.yml` + `scripts/setup-sandbox.sh`).

No new compose, no new Postgres, no raw SAP tables.

---

## 5. Decision B — `azure_replica` driver (deferred ADR)

If the platform genuinely moves to "replicate SAP → Azure Postgres and read the
DB", that is an asoe2 **architecture change**, captured as a standalone ADR:

- New gateway driver `ASOE_SAP_DRIVER=azure_replica` (a sibling adapter to
  `sap_live.py`) reading a Postgres SAP replica and mapping rows → the same
  `GatewayResponse`/`contracts.models` the OData driver returns. The port
  contract is unchanged; only the adapter differs.
- The replica **schema must be reconciled with what the real SLT/ADF pipeline
  lands** (asoe2 `infra/` Bicep), not hand-authored. The `kschl varchar(5)`
  widening in the PR #250 DDL is exactly the kind of fit-the-demo hack that must
  instead come from the real replication DDL.
- Parity tests proving `azure_replica` and `s4hana` produce identical
  `GatewayResponse`s for the same scenario; compliance sign-off (audit-bearing
  registry is CODEOWNERS-gated).

The PR #250 DDL is a useful *first draft of the replica target* and should be
attached to this ADR as a starting point — but it is not wired into anything
until B is accepted.

---

## 6. The scenario catalog (linchpin of A and "generate from catalog")

One declarative file, owned by asoe2, from which **both** the sandbox seed and
the asoe-ui mocks are generated. Proposed schema (one entry per scenario):

```yaml
- id: exc-001                      # stable scenario id
  intent: CONTRACTUAL_CORRECTION
  event_type: EDI_850_PRICE_MISMATCH
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  customer: { retailer_id: R-01, name: Walmart, tier: PREMIUM, region: SE }
  order:    { order_id: SO-1001, po_number: PO-WMT-44120 }
  sap_facts:                       # domain-shaped facts that CAUSE the exception
    sap_pricing:  [{ sku: SKU-0042, base_price: 14.88 }]
    promotions:   [{ sku: SKU-0042, promo_type: TPR, discount_pct: 11.3,
                     end_date: 2025-12-31, active: false }]   # expired
    edi_event:    { po_price: 13.20, sap_price: 14.88, line_count: 3 }
  note: "Expired promo: PO at promo price, pricing reverted to base."
```

Every field maps onto an asoe2 seed table (`sap_pricing`, `promotions`,
`credit_profiles`, `retailer_contracts`, `edi_events`) **and** onto an asoe-ui
`ExceptionSummary` — that dual mapping is the whole point. The catalog is
expressed in asoe2's **domain** vocabulary (retailer/SKU/promotion/credit), not
SAP table vocabulary.

**Ownership:** authored and CODEOWNERS-gated in asoe2 alongside the
audit-bearing registry. asoe-ui consumes a pinned snapshot; it never authors it.

---

## 7. asoe-ui side — generate `MOCK_*` from the catalog

Mirror the mechanisms this repo already uses for asoe2-owned contracts
(`generate-types` ← OpenAPI, `verify:reason-tags`, taxonomy generation):

1. `scripts/gen-mock-data.ts` — reads the pinned `catalog.yaml` snapshot, emits
   `src/lib/mock-data/*` (today's `MOCK_EXCEPTIONS` / `MOCK_ORDER_ANALYSES` shape).
2. `npm run verify:scenario-catalog` — regenerate + `git diff --exit-code`, as a
   CI drift gate (identical pattern to `verify:reason-tags`).
3. `.env.local.example` — `NEXT_PUBLIC_API_BASE` → local asoe2 backend, plus a
   short "run the asoe2 sandbox, then `next dev`" doc for full-stack local mode.

This converts `MOCK_*` from a parallel hand-authored source into a checked
derivative, removing the inversion (today the SAP fixtures were generated *from*
`MOCK_EXCEPTIONS`, two hops downstream of the real source).

---

## 8. Per-mode data matrix (target)

| | local (sandbox) | Vercel (preview) | Azure (pre-prod) |
|---|---|---|---|
| UI data source | asoe2 API | `MOCK_*` (generated from catalog) | asoe2 API |
| SAP data | stub gateways ← `tests/sandbox/seed.py` (← catalog) | n/a | `sap_live.py` ← OData S/4HANA |
| App DB | sandbox SQLite/Postgres | n/a | Azure Postgres (cases/audit) |
| Emails | `email_intelligence` fixtures → intake | n/a | MS Graph live intake |
| Honest invariant | same gateway port + `contracts.models` as Azure | same scenarios as seed (snapshot-pinned) | — |

---

## 9. Migration phases

| Phase | Repo | Work |
|---|---|---|
| 1. Confirm seams | asoe2 (read) | verify `api/sandbox_gateways.py` stub↔seed wiring, `contracts/models.py` SAP domain fields, `infra/` (confirm no SAP-replica DB provisioned — tests the premise) |
| 2. Catalog | asoe2 | author `fixtures/scenarios/catalog.yaml` from the 41 scenarios + existing ~60 seed events |
| 3. Seed-from-catalog | asoe2 | refactor `tests/sandbox/seed.py` to generate from catalog; add `seed ⊇ catalog` lock |
| 4. Emails | asoe2 | relocate 9 `.eml` → intake fixtures + parse/intake test |
| 5. UI generate | asoe-ui | `gen-mock-data.ts` + `verify:scenario-catalog` + `.env.local.example`; pin catalog snapshot |
| 6. Retire | asoe-ui | remove `data/synthetic/` + `scripts/generate-synthetic-data.ts` (see §10) |
| 7. Replica ADR | asoe2 | write Decision B ADR; attach PR #250 DDL as draft target |

**PR #250 (parked):** under Decision A, "relocate" effectively means
"re-author in asoe2's domain shape", so the raw-SAP-table form does not survive
the move. Likely outcome: close #250 and land Phase 6 (retire) + Phase 5 (UI
generate) as the asoe-ui PR, with Phases 2–4/7 as asoe2 PRs. Final call
deferred per request.

---

## 10. Risks / honest caveats

- **Sunk cost:** the PR #250 SQL/DDL/compose largely does not survive Decision A
  (different shape). Keeping it would institutionalize a layer asoe2 doesn't have.
- **Compliance-adjacent:** the catalog and seed touch audit-bearing scenarios;
  changes need backend/compliance review, not a unilateral edit.
- **Execution blocker:** asoe2 is not in the current session's scope (GitHub MCP
  is restricted to asoe-ui; there is no `add_repo` capability available). Phases
  1–4 and 7 cannot be done from here. asoe2 was read for this RFC via public web
  fetch only; re-verify the three seams against real source before editing.
- **Premise check:** the user's stated "replicate SAP → Azure DB" is Decision B,
  not current asoe2 behavior (OData). Phase 1's `infra/` check confirms whether a
  replica DB exists at all today.

---

## 11. What unblocks execution

Add `kumarabhijit/asoe2` to the session scope (or run a session there). Then,
in order: Phase 1 (read real source), Phase 2 (catalog), Phase 3 (seed), Phase 5
(UI generate) — Phases 4/6/7 can follow. Until then this RFC is the durable
record of the plan and the two decisions.
