-- GENERATED FILE — do not edit by hand.
-- Produced by scripts/generate-synthetic-data.ts (npm run synthetic:gen).
-- Synthetic SAP S/4HANA -> Azure PostgreSQL replica for ASOE demos.
-- All customers, orders, prices and documents are fictitious.

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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
  _replicated_at  timestamptz  NOT NULL DEFAULT '2026-04-01T03:00:00Z',
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
