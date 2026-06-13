# asoe2 execution brief — synthetic SAP scenarios → sandbox seed + catalog

**Purpose:** a portable, self-contained brief to paste into a **Claude Code
session started on `kumarabhijit/asoe2`** (this asoe-ui session is single-repo-
bound and cannot write to asoe2). It carries everything the asoe2 session needs
to execute Phases 1–4 and 7 of the migration RFC
(`asoe-ui:docs/synthetic-data-placement-rfc.md`) without rediscovery.

This is a **handoff/draft**. The canonical scenario catalog is authored and
CODEOWNERS-gated in asoe2 — not here. Everything below is derived from asoe-ui
truth (the mock layer) and must be **reconciled to asoe2's real seed entities**
before it lands (see §5).

---

## 1. Decisions already made (do not relitigate)

- **A now / B later.** Fold these scenarios into asoe2's existing domain-shaped
  sandbox seed (`tests/sandbox/seed.py`) + stub gateways. Do **not** introduce
  raw SAP tables. The "replicate SAP → Azure Postgres" pattern is a separate,
  deferred ADR (`ASOE_SAP_DRIVER=azure_replica`), not this work.
- **UI mocks generate from the catalog** (asoe-ui side, separate session).

## 2. Architecture facts (confirmed by reading asoe2 main)

- SAP is read **live via OData** (`gateways/sap_live.py`, `ASOE_SAP_DRIVER=s4hana`),
  returning domain `GatewayResponse` objects (`sap_order`/`sap_doc`/`sap_contract`,
  `contracts/models.py`). No raw SAP table names anywhere.
- The sandbox double already exists: `tests/sandbox/seed.py` → 8 domain tables
  (`customers`, `distribution_centers`, `sap_pricing`, `retailer_contracts`,
  `promotions`, `credit_profiles`, `edi_events`, +1) with ~60 inline EDI events.
- Mode routing: `api/sandbox_gateways.py` (StubGateway set over the seed) /
  `api/preprod_gateways.py` (same + live-or-stub per driver). `ASOE_ENV` =
  `sandbox` | `preprod` | `production`.

## 3. What to reuse vs discard from asoe-ui PR #250

| Artifact (asoe-ui) | Verdict |
|---|---|
| Scenario *semantics* (the 41 cases, their intents, the exception-causing fact, $ impact) — appendix below | **Reuse** — this is the value |
| `.eml` intake fixtures (`data/synthetic/emails/`) | **Reuse** — relocate to asoe2 `email_intelligence/` fixtures |
| `data/synthetic/*.sql` raw-SAP-table DDL (`vbak`/`vbap`/`konv`…) | **Discard** — wrong layer; asoe2 has no SAP-table replica. (Keep only as the *draft target* attached to the Decision B ADR.) |
| `data/synthetic/docker-compose.yml` + `sandbox:db:*` scripts | **Discard** — asoe2's own `docker-compose.yml` + `scripts/setup-sandbox.sh` own sandbox orchestration |
| `scripts/generate-synthetic-data.ts` | **Discard** — replaced by catalog-driven seed generation in asoe2 |
| `kschl varchar(5)` widening | **Discard** — the canary; any such shape must come from real DDL, not demo-fitting |

## 4. Phases for this session

1. **Confirm seams (read first).** Open `tests/sandbox/seed.py` (exact table DDL
   + the real retailer/SKU/DC ids), `api/sandbox_gateways.py` (stub↔seed wiring),
   `contracts/models.py` (`GatewayResponse` + sap_order/doc/contract fields), and
   `infra/` Bicep (confirm whether any SAP-replica Postgres is provisioned —
   tests the "Azure real db" premise; expected answer: no, SAP is OData).
2. **Author the catalog** `fixtures/scenarios/catalog.yaml` (schema §6) from the
   appendix §7 **diffed against** the existing ~60 seed events — many of these 41
   are likely already represented; add only the genuinely-new ones.
3. **Generate the seed from the catalog.** Refactor `tests/sandbox/seed.py` to
   build its 8-table rows from `catalog.yaml` (keep current inline data as the
   migrated baseline). Add a coverage lock asserting `seed ⊇ catalog`.
4. **Relocate emails.** Move the 9 `.eml` fixtures into `email_intelligence/`
   (or `tests/fixtures/gateway/msgraph_intake/`); add a parse + intake test.
7. **(Deferred) Decision B ADR** `docs/adr/` — the `azure_replica` driver;
   attach the discarded asoe-ui DDL as the draft replica target.

## 5. Reconciliation REQUIRED before authoring (do not invent)

The appendix uses **asoe-ui vocabulary** (Walmart/Kroger/Target/Costco/SEBev,
beverage SKUs like `SKU-0042`, order ids like `SO-1001`). asoe2's seed uses its
own entities (`R-01`…`R-10`; ~10 cleaning/personal-care SKUs; 5 DCs). Before
writing catalog entries, map — **reading the real `seed.py`**, not guessing:

| asoe-ui concept | asoe2 seed target | Action |
|---|---|---|
| account_name (Walmart/Kroger/…) | `customers.retailer_id` (R-0x) | map or extend the retailer set |
| beverage SKUs | `sap_pricing.sku` | extend the SKU set, or remap to existing SKUs |
| plant/DC codes | `distribution_centers.dc_id` | remap to the 5 existing DCs |
| credit breach / near-limit | `credit_profiles` (over-limit / at-risk rows) | likely already present — reuse |
| expired promo | `promotions` (`active=false`, past `end_date`) | add per scenario |
| contract discount | `retailer_contracts.discount_pct` | add/relate per scenario |
| price mismatch | `edi_events` (`po_price` vs `sap_price`) | add/diff vs existing events |

Fake precision here (inventing R-ids/SKUs) is the exact dishonesty this whole
effort is correcting. Bind to real seed entities only.

## 6. Catalog schema (proposed)

```yaml
- id: exc-001                      # stable scenario id
  intent: CONTRACTUAL_CORRECTION
  event_type: EDI_850_PRICE_MISMATCH
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  customer: { retailer_id: R-0x, tier: PREMIUM }   # ← reconcile to seed
  order:    { order_id: SO-1001, po_number: PO-WMT-44120 }
  sap_facts:                       # domain-shaped facts that CAUSE the exception
    sap_pricing:  [{ sku: <seed sku>, base_price: 14.88 }]
    promotions:   [{ sku: <seed sku>, promo_type: TPR, discount_pct: 11.3,
                     end_date: 2025-12-31, active: false }]
    edi_event:    { po_price: 13.20, sap_price: 14.88, line_count: 3 }
  revenue_at_risk: 1218.24
  note: "Expired promo: PO at promo price, pricing reverted to base."
```

Every field maps onto a seed table **and** onto an asoe-ui `ExceptionSummary` —
that dual mapping is the point. Expressed in asoe2 **domain** vocabulary.

## 7. Appendix — the 41 scenarios (faithfully derived from asoe-ui)

Source: `MOCK_EXCEPTIONS` + `MOCK_ORDER_ANALYSES` via
`asoe-ui:scripts/scenario-catalog-report.ts` (read-only, deterministic).
Fields here are trustworthy as-is; `account`/`order_id`/SKUs need the §5
reconciliation. `diagnosis` is the exception-causing fact in plain language.

```yaml
- id: exc-001
  intent: CONTRACTUAL_CORRECTION
  event_type: EDI_850_PRICE_MISMATCH
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Walmart"
  order_id: "SO-1001"
  revenue_at_risk: 1218.24
  diagnosis: "Two line items reference promo pricing from an expired Q4 trade promotion (ZPROM condition valid through 12/31). One line has a $0.02 EDI rounding variance with"
- id: exc-002
  intent: DUPLICATE_PO
  event_type: EDI_850_DUPLICATE_PO
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Kroger"
  order_id: "SO-1042"
  revenue_at_risk: 6720
  diagnosis: "PO #PO-88421 matches existing PO #PO-88419 received 36 hours prior. Identical line items, quantities, and ship-to address. Likely EDI retransmission or buyer sy"
- id: exc-003
  intent: CREDIT_BLOCK
  event_type: CREDIT_LIMIT_BREACH
  lifecycle: BLOCKED
  shadow_verdict: RED
  account: "Target"
  order_id: "SO-2200"
  revenue_at_risk: 13782
  diagnosis: "Customer credit exposure ($142,500) exceeds approved credit limit ($125,000) by $17,500 (14%). Four line items totalling $13,782 would push exposure to $156,282"
- id: exc-004
  intent: MASS_PRICING_ERROR
  event_type: EDI_850_PRICE_MISMATCH
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Costco"
  order_id: "SO-3100"
  revenue_at_risk: 14940
  diagnosis: "UOM conversion factor mismatch on both line items. Pack-size to case conversion not loaded in ERP master data."
- id: exc-005
  intent: CONTRACTUAL_CORRECTION
  event_type: EDI_850_PRICE_MISMATCH
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Walmart"
  order_id: "SO-4455"
  revenue_at_risk: 6220.8
  diagnosis: "Single line item — ERP base price not loaded for new SKU-0099. PO price matches contracted rate."
- id: exc-006
  intent: DUPLICATE_PO
  event_type: EDI_850_DUPLICATE_PO
  lifecycle: ESCALATED
  shadow_verdict: YELLOW
  account: "Kroger"
  order_id: "SO-5010"
  revenue_at_risk: 8092.8
  diagnosis: "PO flagged as potential duplicate. Similar line items but different quantities — may be a legitimate reorder vs. duplicate transmission."
- id: exc-007
  intent: CREDIT_BLOCK
  event_type: CREDIT_LIMIT_BREACH
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Target"
  order_id: "SO-6001"
  revenue_at_risk: 5040
  diagnosis: "Customer approaching credit limit. Current exposure $93,200 against $100,000 limit. This order ($5,040) would bring exposure to $98,240 — within limit but trigg"
- id: exc-008
  intent: CONTRACTUAL_CORRECTION
  event_type: EDI_850_PRICE_MISMATCH
  lifecycle: CLOSED
  shadow_verdict: GREEN
  account: "Costco"
  order_id: "SO-7200"
  revenue_at_risk: 3375
  diagnosis: "One line with expired seasonal promotion, one line priced correctly. Auto-resolved — promo condition reloaded from Q1 trade plan."
- id: exc-009
  intent: DUPLICATE_PO
  event_type: EDI_850_DUPLICATE_PO
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Walmart"
  order_id: "SO-8100"
  revenue_at_risk: 504
  diagnosis: "PO #PO-55102 is an exact retransmission of PO #PO-55100 received 4 hours prior. Identical customer, SKU, quantity, and ship-to. Low-value order ($504) auto-bloc"
- id: exc-010
  intent: BACK_ORDER
  event_type: BACK_ORDER_OOS
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Kroger"
  order_id: "SO-9200"
  revenue_at_risk: 21280
  diagnosis: "Customer ordered 800 CS of Premium Lager but only 480 CS available at primary DC. Gap of 320 CS (40%). Alternate DC in Denver has 200 CS with 3-day transit. Pro"
- id: exc-011
  intent: BACK_ORDER
  event_type: BACK_ORDER_OOS
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Target"
  order_id: "SO-9450"
  revenue_at_risk: 4400
  diagnosis: "Customer ordered 200 CS of Craft IPA. Only 140 CS available at primary DC. Alternate DC in Chicago has 120 CS with 2-day transit. Auto-resolved via split shipme"
- id: exc-012
  intent: OVER_MAX
  event_type: OVER_MAX_QTY
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Costco"
  order_id: "SO-10100"
  revenue_at_risk: 30020
  diagnosis: "Total order quantity (2,600 CS) exceeds contract maximum (2,000 CS) by 600 CS (30%). Three line items, two exceeding per-line maximums. SAP block V4080 applied."
- id: exc-013
  intent: MIN_ORDER_QTY
  event_type: MIN_ORDER_QTY
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Walmart"
  order_id: "SO-11200"
  revenue_at_risk: 1790
  diagnosis: "Order for 65 CS total (2 SKUs) is below the minimum order quantity of 100 CS for this distribution channel. SAP V4082 block applied. Two lines: one can be round"
- id: exc-014
  intent: PALLET_CONFIG
  event_type: PALLET_CONFIG_VIOLATION
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Kroger"
  order_id: "SO-12300"
  revenue_at_risk: 11162.5
  diagnosis: "Order has 3 SKUs with pallet alignment violations. 2 broken layers and 1 partial pallet. Total 37 loose cases requiring manual handling — estimated 1.5 extra la"
- id: exc-015
  intent: CONTRACTUAL_CORRECTION
  event_type: ORDER_RECEIVED
  lifecycle: FAILED
  shadow_verdict: GREEN
  account: "Walmart"
  order_id: "SO-13400"
  revenue_at_risk: null
  diagnosis: ""
- id: exc-016
  intent: DELIVERY_DELAY
  event_type: DELIVERY_DELAY
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Target"
  order_id: "SO-14200"
  revenue_at_risk: 48600
  diagnosis: "Shipment is 6 days behind the contracted delivery window. Root cause is a carrier hub closure in the Southwest corridor. SLA breach is imminent; three alternate"
- id: exc-017
  intent: PRICE_HOLD_RELEASE
  event_type: EDI_850_PRICE_HOLD
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Walmart"
  order_id: "PO-PHR-001"
  revenue_at_risk: 1010
  diagnosis: "Inbound PO PO-PHR-001 landed with a pricing block because line 1's PO price ($101.00) deviates +1.0% from the SAP base ($100.00) at Plant 4100. Variance is with"
- id: exc-018
  intent: PRICE_HOLD_RELEASE
  event_type: EDI_850_PRICE_HOLD
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Kroger"
  order_id: "PO-PHR-002"
  revenue_at_risk: 5250
  diagnosis: "Inbound PO PO-PHR-002 from Kroger is held on pricing-block check: line 1's PO price ($105.00) deviates +5.0% from the SAP base ($100.00). Above the 2.0% auto-re"
- id: exc-019
  intent: EDI_MISMATCH
  event_type: EDI_850_LINE_MISMATCH
  lifecycle: BLOCKED
  shadow_verdict: RED
  account: "Target"
  order_id: "PO-EDM-SKU-001"
  revenue_at_risk: 5040
  diagnosis: "Target PO PO-EDM-SKU-001 references material SKU-999-UNKNOWN on line 1 — not present in the SAP material master (MARA). Inbound-order validation hard-rejected t"
- id: exc-020
  intent: EDI_MISMATCH
  event_type: EDI_850_LINE_MISMATCH
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Costco"
  order_id: "PO-EDM-QTY-001"
  revenue_at_risk: 7200
  diagnosis: "Costco PO PO-EDM-QTY-001 received quantity 144 CS on line 1 instead of the contract-aligned 120 CS (+20%). Variance exceeds pallet-break tolerance; EdiMismatchR"
- id: exc-021
  intent: CONTRACTUAL_CORRECTION
  event_type: EDI_850_LINE_MISMATCH
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Walmart"
  order_id: "PO-PM-ROUTING-001"
  revenue_at_risk: 9500
  diagnosis: "Inbound EDI 850 line 1 arrived with a price mismatch: received $95.00 against contract base $100.00 (−5.0%). The asoe2 classifier routed the event to CONTRACTUA"
- id: exc-022
  intent: MASS_PRICING_ERROR
  event_type: MASS_PRICING_RECALC
  lifecycle: FAILED
  shadow_verdict: —
  account: "Walmart"
  order_id: "SO-CB-001"
  revenue_at_risk: null
  diagnosis: ""
- id: exc-023
  intent: MASS_PRICING_ERROR
  event_type: MASS_PRICING_RECALC
  lifecycle: FAILED
  shadow_verdict: —
  account: "Kroger"
  order_id: "SO-NR-001"
  revenue_at_risk: null
  diagnosis: ""
- id: exc-024
  intent: DUPLICATE_PO
  event_type: DUPLICATE_PO_RECEIVED
  lifecycle: FAILED
  shadow_verdict: —
  account: "Target"
  order_id: "SO-GW-001"
  revenue_at_risk: null
  diagnosis: ""
- id: exc-025
  intent: PRICE_HOLD_RELEASE
  event_type: EDI_850_PRICE_HOLD
  lifecycle: FAILED
  shadow_verdict: —
  account: "Costco"
  order_id: "PO-PHR-BAD"
  revenue_at_risk: null
  diagnosis: ""
- id: exc-026
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_ORDER_ENTRY_REQUEST
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Southeast Beverage Distributors"
  order_id: "EML-PO-2026-0042"
  revenue_at_risk: 18400
  diagnosis: "Non-EDI PO from Southeast Beverage Distributors. Extracted four lines at composite confidence 0.88. All non-disable-able floor checks passed; ambiguous ship-to "
- id: exc-040
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_ORDER_CHANGE_REQUEST
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Southeast Beverage Distributors"
  order_id: "EML-CHG-2026-0051"
  revenue_at_risk: null
  diagnosis: "Buyer requests a quantity reduction on line 001 (600 → 420 CS). Mid-fulfilment change; supply + logistics clear, GOLD-tier approval required."
- id: exc-041
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_ORDER_CHANGE_REQUEST
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Southeast Beverage Distributors"
  order_id: "EML-CHG-2026-0052"
  revenue_at_risk: null
  diagnosis: "Buyer requests an expedite (delivery 2026-05-24 → 2026-05-20). SLA window tight and carrier capacity constrained."
- id: exc-042
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_ORDER_CHANGE_REQUEST
  lifecycle: ESCALATED
  shadow_verdict: RED
  account: "Walmart"
  order_id: "EML-CHG-2026-0053"
  revenue_at_risk: null
  diagnosis: "Buyer requests a full cancellation on an order already late in fulfilment (stage 4/5, picked). High-risk; revenue impact above the four-eyes threshold."
- id: exc-043
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_ORDER_CHANGE_REQUEST
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Kroger"
  order_id: "EML-CHG-2026-0054"
  revenue_at_risk: null
  diagnosis: "Buyer requests a SKU substitution (BEV-LEMON-6PK → BEV-LEMON-12PK). ATP partially covers the substitute."
- id: exc-044
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_INQUIRY
  lifecycle: PENDING_REVIEW
  shadow_verdict: GREEN
  account: "Southeast Beverage Distributors"
  order_id: "EML-INQ-2026-0061"
  revenue_at_risk: null
  diagnosis: "Buyer A/P inquiry on the status of order SO-5100012344 and invoice INV-2026-8841. Both settled; an informational reply is all that's needed."
- id: exc-045
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_COMPLAINT
  lifecycle: ESCALATED
  shadow_verdict: RED
  account: "Walmart"
  order_id: "EML-CMP-2026-0062"
  revenue_at_risk: null
  diagnosis: "Buyer complaint: short shipment on SO-5100012501 (received 380 of 480 CS). Replacement shipment + goodwill credit under review; escalated to Customer Care."
- id: exc-046
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_ORDER_ENTRY_REQUEST
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Kroger"
  order_id: "EDI-PO-2026-7781"
  revenue_at_risk: null
  diagnosis: "EDI 850 order from Kroger, 0.97 extraction confidence, all floor checks green — auto-validated, confirmed in SAP, and resolved without human review."
- id: exc-047
  intent: MANUAL_ORDER_INTAKE
  event_type: EMAIL_GENERAL
  lifecycle: PENDING_REVIEW
  shadow_verdict: GREEN
  account: "Southeast Beverage Distributors"
  order_id: "EML-GEN-2026-0071"
  revenue_at_risk: null
  diagnosis: "Uncategorised inbound email (trade-show booth invitation) — not an order-desk matter. Classified OTHER; routed to Marketing."
- id: exc-027
  intent: PRICE_HOLD_RELEASE
  event_type: EDI_850_PRICE_HOLD
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Walmart"
  order_id: "PO-WMT-Q1-RESET-001"
  revenue_at_risk: 33760
  diagnosis: "Q1 reset PO from Walmart held on pricing check: line 1's PO price ($21.10) deviates +5.5% from the SAP base ($20.00) at Plant 4100. Above the 2.0% auto-release "
- id: exc-028
  intent: BACK_ORDER
  event_type: BACK_ORDER_OOS
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Walmart"
  order_id: "PO-WMT-Q1-RESET-001"
  revenue_at_risk: 33760
  diagnosis: "Walmart ordered 1,600 CS of the Q1-reset SKU but Bentonville DC had only 1,280 CS on hand (320 CS / 20% gap). Agent split the shipment: 1,280 CS ex-Bentonville "
- id: exc-029
  intent: DUPLICATE_PO
  event_type: EDI_850_DUPLICATE_PO
  lifecycle: BLOCKED
  shadow_verdict: RED
  account: "Walmart"
  order_id: "PO-WMT-Q1-RESET-001-R2"
  revenue_at_risk: 33760
  diagnosis: "PO PO-WMT-Q1-RESET-001-R2 arrived 18h after the original PO-WMT-Q1-RESET-001 with identical line items, quantities, and ship-to. RED — DuplicatePORecipe auto-bl"
- id: exc-030
  intent: OVER_MAX
  event_type: OVER_MAX_QTY
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Costco"
  order_id: "PO-COST-EOQ-2026Q1"
  revenue_at_risk: 122000
  diagnosis: "Costco end-of-quarter PO totals 4,000 CS, exceeding the contract maximum of 3,000 CS by 1,000 CS (33%). Two SKUs blew through their per-line ceilings. SAP V4080"
- id: exc-031
  intent: PALLET_CONFIG
  event_type: PALLET_CONFIG_VIOLATION
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Costco"
  order_id: "PO-COST-EOQ-2026Q1"
  revenue_at_risk: 122000
  diagnosis: "Two SKUs on the same Costco EOQ PO arrived with quantities that didn't tile to Costco's club-pack pallet spec (300 CS/pallet, 60 CS/layer). PalletAlignmentRecip"
- id: exc-032
  intent: MIN_ORDER_QTY
  event_type: MIN_ORDER_QTY
  lifecycle: PENDING_REVIEW
  shadow_verdict: YELLOW
  account: "Kroger"
  order_id: "PO-KR-WK15-2026"
  revenue_at_risk: 1960
  diagnosis: "Kroger's WK-15 replenishment PO totals 70 CS across two SKUs, below the 100 CS MOQ for the DSD channel. SAP V4082 applied. One SKU rounds cleanly to MOQ; the ot"
- id: exc-033
  intent: DELIVERY_DELAY
  event_type: DELIVERY_DELAY
  lifecycle: RESOLVED
  shadow_verdict: GREEN
  account: "Kroger"
  order_id: "PO-KR-WK15-2026"
  revenue_at_risk: 1960
  diagnosis: "Kroger WK-15 PO was 5 days behind plan after a DHL equipment failure at the Indianapolis cross-dock. DeliveryDelayResolutionRecipe re-routed the load via FedEx "
```
