# Synthetic SAP → Azure PostgreSQL replica

Demo-scale synthetic dataset modelling the slice of an **SAP S/4HANA SD
system** that a CDC replication pipeline (SAP SLT / Azure Data Factory)
would land in an **Azure Database for PostgreSQL** schema named
`sap_replica`. It substantiates every exception in the ASOE UI mock
layer: for each record in `src/lib/mock-data/exceptions.ts` the replica
contains the SAP documents — orders, pricing conditions, blocks, stock,
EDI/email intake rows — that would have caused the ASOE pipeline to
raise that exception.

All customers, orders, prices and documents are **fictitious**.

## Files (load in order)

| File | Contents |
| --- | --- |
| `00_schema.sql` | `DROP SCHEMA … CASCADE` + full DDL with FKs and `COMMENT ON` docs |
| `10_master_data.sql` | Plants, customers, credit, materials, UoM, MOQ/max-qty info records, stock, pricing condition records |
| `20_sales_documents.sql` | Sales orders, items, schedule lines, partners, document pricing, deliveries |
| `30_intake_channels.sql` | Inbound EDI 850 staging + customer-inbox email staging |
| `40_asoe_lineage.sql` | `zasoe_exception_link` — maps each UI exception to its SAP documents |

## Local sandbox

One command spins up a loaded replica in Docker (no manual psql steps —
the postgres image auto-runs the numbered SQL files in order on first
boot):

```bash
npm run sandbox:db:up     # postgres:16 on localhost:5433, fully loaded
npm run sandbox:db:psql   # open a psql shell into it
npm run sandbox:db:down   # stop + wipe (next `up` reloads fresh)
```

Connection string: `postgresql://asoe:asoe@localhost:5433/asoe_replica`
(throwaway demo credentials — the data is synthetic). To pick up
regenerated SQL, run `sandbox:db:down` then `sandbox:db:up`.

Scope note: this database is the **ERP layer behind the backend** — for
asoe2 development, intake-pipeline testing (pair it with `emails/`), and
demo SQL. The UI's own local sandbox keeps using the mock layer in
`src/lib/mock-data/` (the same fixture universe this dataset was derived
from); the UI never queries the database directly (CLAUDE.md Guardrails
#1/#6 — the UI consumes composed backend payloads only).

## Loading manually

```bash
# local / CI
psql "$CONN" -v ON_ERROR_STOP=1 -f 00_schema.sql -f 10_master_data.sql \
  -f 20_sales_documents.sql -f 30_intake_channels.sql -f 40_asoe_lineage.sql

# Azure Database for PostgreSQL (Flexible Server)
psql "host=<server>.postgres.database.azure.com port=5432 dbname=<db> \
  user=<user> sslmode=require" -v ON_ERROR_STOP=1 -f 00_schema.sql -f ...
```

The load is idempotent: `00_schema.sql` drops and recreates the schema.

## Regenerating

The SQL files are **generated** — do not edit them by hand.

```bash
npm run synthetic:gen      # regenerate data/synthetic/*.sql
npm run verify:synthetic   # regenerate + fail if committed SQL drifted
```

`scripts/generate-synthetic-data.ts` is deterministic (fixed-seed PRNG,
no wall-clock reads): the same mock fixtures always produce byte-identical
SQL. It imports `MOCK_EXCEPTIONS` and **asserts coverage** — adding an
exception to the mock layer without adding a scenario to the generator
fails generation, so the replica cannot silently drift from the UI
fixtures.

## Replication model

- Tables and columns keep their SAP names, lower-cased (`vbak.bstnk`,
  `knkk.klimk`). SAP `DATS`/`TIMS` map to native `date`/`time`;
  `CURR` maps to `numeric`.
- Every table carries the CDC envelope the pipeline appends:
  `_source_system` (`SAPS4PRD`), `_replicated_at` (source change time +
  replication lag), `_replication_op` (`I`/`U`/`D`).
- `mandt` (client `100`) is part of every SAP primary key, as in the
  source system.
- S/4HANA conventions: status fields live on `vbak` (classic `VBUK` is
  folded in); document pricing is `prcd_elements` (classic `KONV`).
- `Z`-prefixed tables (`zedi_850_in`, `zemail_intake`) and `zz`-prefixed
  columns (`knmt.zzmax_qty`, `marm.zzlayer_qty`, `likp.zzeta_date`) are
  customer extensions — standard practice in CPG SAP installs.
- One deliberate deviation: `kschl` is `varchar(5)` (SAP: 4 chars) so the
  `ZPROM` condition type referenced by the UI pricing waterfalls fits.

## Table inventory

| Area | Tables |
| --- | --- |
| Org / plants | `t001w` |
| Customer master | `kna1`, `knvv`, `knkk` (credit), `knmt` (customer-material info, max-qty ceilings) |
| Material master | `mara`, `makt`, `marm` (UoM + pallet specs), `mvke` (MOQ), `mard` (stock) |
| Pricing conditions | `konh`, `konp`, `a304` (list price), `a305` (customer/material contract + promo) |
| Sales documents | `vbak`, `vbap`, `vbep` (schedule/ATP), `vbpa` (partners), `prcd_elements` |
| Logistics | `likp`, `lips` (deliveries) |
| Intake staging | `zedi_850_in`, `zedi_850_in_lines`, `zemail_intake` |
| ASOE lineage | `zasoe_exception_link` |

## How the exception scenarios are encoded

The interesting property of this dataset is that exceptions are **derivable
from the data**, not just labelled:

- **Pricing / promo** (`exc-001`, `exc-008`): promo condition records
  (`konh` validity windows) expired before the order date; the EDI staging
  line keeps the as-received promo price while `prcd_elements` shows the
  reverted base price (expired condition present but `kinak = 'X'`).
- **Missing master data** (`exc-004`, `exc-005`, `exc-019`): the
  `marm` CS→EA row for `SKU-5521`, the `a304` PR00 record for `SKU-0099`,
  and the `mara` row for `SKU-999-UNKNOWN` are *intentionally absent*.
- **Duplicates** (`exc-002`, `exc-006`, `exc-009`, `exc-029`): order pairs
  share customer/SKUs/ship-to within a short window; the duplicate is
  either delivery-blocked (`vbak.lifsk = 'Z1'`) or rejected
  (`vbap.abgru = '52'`).
- **Credit** (`exc-003`, `exc-007`): `knkk.skfor` vs `knkk.klimk` per
  credit control area; the breached order carries `vbak.cmgst = 'B'`.
- **Back order** (`exc-010/011/028`): `vbep.bmeng < wmeng` with `mard`
  stock explaining the gap and the alternate-DC quantities.
- **Over-max / MOQ / pallet** (`exc-012/030`, `exc-013/032`,
  `exc-014/031`): line quantities violate `knmt.zzmax_qty`,
  `mvke.aumng`, or `marm` PAL layer specs; the order carries the matching
  `Z2`/`Z3`/`Z4` delivery block.
- **Delivery delay / short ship** (`exc-016/033`, `exc-045`):
  `likp.zzeta_date` past `lfdat`; `lips.lfimg` below the ordered quantity.
- **Price holds** (`exc-017/018/025/027`): order net price vs the PR00
  rate in `prcd_elements`; unresolved holds carry `lifsk = 'ZP'`.
- **Email intake** (`exc-026`, `exc-040…047`): `zemail_intake` rows with
  the referenced open orders; unposted intakes have no `vbak` row yet.

Plus 25 PRNG-generated **clean orders** (no exception) so exception-rate
queries and dashboards have a realistic denominator.

## Sample intake emails (`emails/`)

Nine RFC 5322 `.eml` fixtures for testing the email-intake pipeline
(extraction, classification, duplicate detection, change analysis),
generated alongside the SQL. `emails/manifest.json` carries the
machine-readable expectations (scenario, expected classification,
referenced PO, linked `zemail_intake` id).

| Scenario | Fixtures |
| --- | --- |
| **New order** | `msg-2026-0001` (ambiguous ship-to → clarification band), `msg-2026-0008` (clean, CSV attachment → happy path), `test-new-0003` (forwarded chain, no PO number, prose quantities → low confidence) |
| **Duplicate PO** | `test-dup-0001` (same-channel resend of msg-2026-0001), `test-dup-0002` (cross-channel: PO-88421 already arrived via EDI as SO `0000001042`) |
| **Order change** | `msg-2026-0002` (qty reduction), `msg-2026-0003` (expedite with freight condition), `msg-2026-0004` (urgent full cancellation), `msg-2026-0005` (SKU substitution with repricing condition) |

Fixtures whose `Message-ID` carries a `MSG-2026-*` id are the source
messages of the matching `zemail_intake` rows — feed one to the pipeline
and the replica already shows the post-processing state. `TEST-*`
fixtures are extra stimuli with **no** replica row: they are inputs the
pipeline has not seen yet (the two duplicates and the messy forward).
Files use CRLF line endings per RFC 5322 (`.gitattributes` marks them
`-text`).

## Joining back to the UI

`zasoe_exception_link` is the demo entry point — one row per UI exception:

```sql
SELECT l.exception_id, l.ui_order_id, v.bstnk, v.netwr, v.lifsk, l.scenario
FROM   sap_replica.zasoe_exception_link l
LEFT   JOIN sap_replica.vbak v ON v.vbeln = l.vbeln
ORDER  BY l.exception_id;
```

Other deliberate join seams:

- `kna1.kunnr` digits match the BP numbers shown in UI entity profiles
  (`BP-102440` → `0000102440`); those customers appear as ship-to
  partners (`vbpa.parvw = 'WE'`) on the exception orders.
- UI order ids of the form `SO-<digits>` keep their digits in `vbeln`
  (`SO-1001` → `0000001001`); all other ids map via the link table.
- `zedi_850_in_lines` keeps the **as-received** EDI payload (price/qty/SKU
  as the buyer sent it) even where the agent later corrected the SAP
  order — the variance the UI displays is the diff between staging and
  `vbak`/`prcd_elements`.
