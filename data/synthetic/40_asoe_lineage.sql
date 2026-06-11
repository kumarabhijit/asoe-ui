-- GENERATED FILE — do not edit by hand.
-- Produced by scripts/generate-synthetic-data.ts (npm run synthetic:gen).
-- Synthetic SAP S/4HANA -> Azure PostgreSQL replica for ASOE demos.
-- All customers, orders, prices and documents are fictitious.

SET search_path TO sap_replica;

INSERT INTO zasoe_exception_link (exception_id, ui_order_id, vbeln, edi_msg_id, email_msg_id, intent, lifecycle_state, scenario, _replicated_at) VALUES
  ('exc-001', 'SO-1001', '0000001001', 'EDI-2026-0001', NULL, 'CONTRACTUAL_CORRECTION', 'RESOLVED', 'Expired promo ZPROM/155 (A305/KONP validity) vs EDI price 13.20 in zedi_850_in_lines.', '2026-04-24T08:32:00Z'),
  ('exc-002', 'SO-1042', '0000001042', 'EDI-2026-0002', NULL, 'DUPLICATE_PO', 'PENDING_REVIEW', 'Duplicate pair VBAK 0000001040 / 0000001042; dup order delivery-blocked Z1.', '2026-04-25T09:25:00Z'),
  ('exc-003', 'SO-2200', '0000002200', NULL, NULL, 'CREDIT_BLOCK', 'BLOCKED', 'KNKK CC10 breach (142,500 > 125,000, CRBLB=X); VBAK CMGST=B.', '2026-04-19T10:43:00Z'),
  ('exc-004', 'SO-3100', '0000003100', 'EDI-2026-0003', NULL, 'MASS_PRICING_ERROR', 'RESOLVED', 'MARM CS->EA row intentionally missing for SKU-5521; EDI line priced in EA.', '2026-04-11T11:14:00Z'),
  ('exc-005', 'SO-4455', '0000004455', 'EDI-2026-0004', NULL, 'CONTRACTUAL_CORRECTION', 'RESOLVED', 'No A304/PR00 record for SKU-0099; ZA01/621 contract rate on the order.', '2026-04-21T14:42:00Z'),
  ('exc-006', 'SO-5010', '0000005010', 'EDI-2026-0005', NULL, 'DUPLICATE_PO', 'ESCALATED', 'Ambiguous duplicate pair VBAK 0000005008 / 0000005010 (qty drift 15%).', '2026-04-08T08:57:00Z'),
  ('exc-007', 'SO-6001', '0000006001', NULL, NULL, 'CREDIT_BLOCK', 'PENDING_REVIEW', 'KNKK CC20 at 93.2% of limit; order approved with warning (CMGST=A).', '2026-04-22T07:34:00Z'),
  ('exc-008', 'SO-7200', '0000007200', 'EDI-2026-0006', NULL, 'CONTRACTUAL_CORRECTION', 'CLOSED', 'ZTEA/730 expired, Q1 reload ZTEA/731 active in KONH/KONP validity windows.', '2026-04-09T12:42:00Z'),
  ('exc-009', 'SO-8100', '0000008100', 'EDI-2026-0007', NULL, 'DUPLICATE_PO', 'RESOLVED', 'Exact duplicate auto-rejected: VBAP ABGRU=52 on VBAK 0000008100.', '2026-04-14T06:34:00Z'),
  ('exc-010', 'SO-9200', '0000009200', NULL, NULL, 'BACK_ORDER', 'PENDING_REVIEW', 'VBEP confirms 480/800; MARD stock across Dallas + 3 alternate DCs.', '2026-04-10T10:34:00Z'),
  ('exc-011', 'SO-9450', '0000009450', NULL, NULL, 'BACK_ORDER', 'RESOLVED', 'VBEP split schedule 140 + 60; MARD Houston 140 / Chicago 120.', '2026-04-17T08:17:00Z'),
  ('exc-012', 'SO-10100', '0000010100', NULL, NULL, 'OVER_MAX', 'PENDING_REVIEW', 'Lines exceed KNMT zzmax_qty (900/800/300); LIFSK=Z2.', '2026-04-07T09:50:00Z'),
  ('exc-013', 'SO-11200', '0000011200', NULL, NULL, 'MIN_ORDER_QTY', 'PENDING_REVIEW', 'Lines below MVKE AUMNG (72/50); LIFSK=Z3.', '2026-04-15T08:04:00Z'),
  ('exc-014', 'SO-12300', '0000012300', NULL, NULL, 'PALLET_CONFIG', 'PENDING_REVIEW', 'Quantities break MARM PAL zzlayer_qty layers; LIFSK=Z4.', '2026-04-12T11:40:00Z'),
  ('exc-015', 'SO-13400', '0000013400', NULL, NULL, 'CONTRACTUAL_CORRECTION', 'FAILED', 'Recipe crashed — VBAK 0000013400 untouched (GBSTK=A).', '2026-04-13T14:17:42Z'),
  ('exc-016', 'SO-14200', '0000014200', NULL, NULL, 'DELIVERY_DELAY', 'PENDING_REVIEW', 'LIKP 0080014200: LFDAT 04-18 vs zzeta_date 04-24 (6 days late).', '2026-04-18T09:47:00Z'),
  ('exc-017', 'PO-PHR-001', '0000090004', 'EDI-2026-0008', NULL, 'PRICE_HOLD_RELEASE', 'RESOLVED', 'PO 101.00 vs PR00 100.00 (within 2% tolerance) — hold released, no LIFSK.', '2026-04-06T08:13:00Z'),
  ('exc-018', 'PO-PHR-002', '0000090005', 'EDI-2026-0009', NULL, 'PRICE_HOLD_RELEASE', 'PENDING_REVIEW', 'PO 105.00 vs PR00 100.00 (escalate band) — LIFSK=ZP.', '2026-04-28T08:18:00Z'),
  ('exc-019', 'PO-EDM-SKU-001', NULL, 'EDI-2026-0010', NULL, 'EDI_MISMATCH', 'BLOCKED', 'zedi_850_in REJECTED: line matnr SKU-999-UNKNOWN has no MARA row; no VBAK created.', '2026-04-26T09:13:00Z'),
  ('exc-020', 'PO-EDM-QTY-001', NULL, 'EDI-2026-0011', NULL, 'EDI_MISMATCH', 'PENDING_REVIEW', 'zedi_850_in IN_REVIEW: received qty 144 vs expected 120; no VBAK created.', '2026-04-05T09:18:00Z'),
  ('exc-021', 'PO-PM-ROUTING-001', '0000090006', 'EDI-2026-0012', NULL, 'CONTRACTUAL_CORRECTION', 'RESOLVED', 'EDI line price 95.00 vs PR00 100.00 — routed to contractual correction; resolved.', '2026-04-27T10:13:00Z'),
  ('exc-022', 'SO-CB-001', '0000090007', NULL, NULL, 'MASS_PRICING_ERROR', 'FAILED', 'Mass pricing recalc circuit-breaker halt; VBAK 0000090004 untouched.', '2026-04-29T07:12:01Z'),
  ('exc-023', 'SO-NR-001', '0000090008', NULL, NULL, 'MASS_PRICING_ERROR', 'FAILED', 'Mass pricing recalc no-recipe halt; VBAK 0000090005 untouched.', '2026-04-23T07:42:00Z'),
  ('exc-024', 'SO-GW-001', '0000090009', 'EDI-2026-0013', NULL, 'DUPLICATE_PO', 'FAILED', 'Duplicate-PO recipe gate failure; VBAK 0000090006 untouched.', '2026-04-20T08:12:02Z'),
  ('exc-025', 'PO-PHR-BAD', '0000090010', 'EDI-2026-0014', NULL, 'PRICE_HOLD_RELEASE', 'FAILED', 'Price-hold recipe crash; LIFSK=ZP still set on VBAK 0000090007.', '2026-04-16T08:42:00Z'),
  ('exc-026', 'EML-PO-2026-0042', NULL, NULL, 'MSG-2026-0001', 'MANUAL_ORDER_INTAKE', 'PENDING_REVIEW', 'zemail_intake PENDING — extracted PO not yet posted to SAP.', '2026-04-30T10:25:30Z'),
  ('exc-040', 'EML-CHG-2026-0051', '0000090015', NULL, 'MSG-2026-0002', 'MANUAL_ORDER_INTAKE', 'PENDING_REVIEW', 'zemail_intake change request against VBAK 0000090012.', '2026-05-18T09:15:10Z'),
  ('exc-041', 'EML-CHG-2026-0052', '0000090016', NULL, 'MSG-2026-0003', 'MANUAL_ORDER_INTAKE', 'PENDING_REVIEW', 'zemail_intake expedite request against VBAK 0000090013.', '2026-05-18T11:33:05Z'),
  ('exc-042', 'EML-CHG-2026-0053', '0000090017', NULL, 'MSG-2026-0004', 'MANUAL_ORDER_INTAKE', 'ESCALATED', 'zemail_intake cancellation request against VBAK 0000090014 (escalated).', '2026-05-19T08:28:40Z'),
  ('exc-043', 'EML-CHG-2026-0054', '0000090018', NULL, 'MSG-2026-0005', 'MANUAL_ORDER_INTAKE', 'PENDING_REVIEW', 'zemail_intake substitution request against VBAK 0000090015.', '2026-05-19T13:53:12Z'),
  ('exc-044', 'EML-INQ-2026-0061', NULL, NULL, 'MSG-2026-0006', 'MANUAL_ORDER_INTAKE', 'PENDING_REVIEW', 'zemail_intake inquiry — no order reference.', '2026-05-20T14:17:00Z'),
  ('exc-045', 'EML-CMP-2026-0062', '5100012501', NULL, 'MSG-2026-0007', 'MANUAL_ORDER_INTAKE', 'ESCALATED', 'zemail_intake complaint; LIPS 0080012501 picked 380 of VBAP 480.', '2026-05-21T09:42:00Z'),
  ('exc-046', 'EDI-PO-2026-7781', '0000090019', NULL, 'MSG-2026-0008', 'MANUAL_ORDER_INTAKE', 'RESOLVED', 'zemail_intake COMPLETED — VBAK 0000090016 auto-created from email PO.', '2026-05-22T07:22:18Z'),
  ('exc-047', 'EML-GEN-2026-0071', NULL, NULL, 'MSG-2026-0009', 'MANUAL_ORDER_INTAKE', 'PENDING_REVIEW', 'zemail_intake general correspondence — no order reference.', '2026-05-22T15:14:00Z'),
  ('exc-027', 'PO-WMT-Q1-RESET-001', '0000090011', 'EDI-2026-0015', NULL, 'PRICE_HOLD_RELEASE', 'PENDING_REVIEW', 'PO 21.10 vs PR00 20.00 on the Q1 reset order; LIFSK=ZP.', '2026-05-04T07:23:30Z'),
  ('exc-028', 'PO-WMT-Q1-RESET-001', '0000090011', NULL, NULL, 'BACK_ORDER', 'RESOLVED', 'Same order: VBEP 1280/1600 split; MARD Atlanta/Memphis/Dallas stock.', '2026-05-04T07:26:30Z'),
  ('exc-029', 'PO-WMT-Q1-RESET-001-R2', '0000090012', 'EDI-2026-0016', NULL, 'DUPLICATE_PO', 'BLOCKED', 'Retransmit order auto-rejected (ABGRU=52); duplicate zedi_850_in row.', '2026-05-05T01:43:30Z'),
  ('exc-030', 'PO-COST-EOQ-2026Q1', '0000090013', NULL, NULL, 'OVER_MAX', 'PENDING_REVIEW', 'Both EOQ lines over KNMT zzmax_qty 1500; LIFSK=Z2.', '2026-05-06T11:14:00Z'),
  ('exc-031', 'PO-COST-EOQ-2026Q1', '0000090013', NULL, NULL, 'PALLET_CONFIG', 'RESOLVED', 'Same order: MARM PAL 300/layer 60 — pallet plan auto-aligned.', '2026-05-06T11:17:00Z'),
  ('exc-032', 'PO-KR-WK15-2026', '0000090014', NULL, NULL, 'MIN_ORDER_QTY', 'PENDING_REVIEW', 'Lines below MVKE AUMNG (72/50) on the wk-15 order; LIFSK=Z3.', '2026-05-07T06:54:00Z'),
  ('exc-033', 'PO-KR-WK15-2026', '0000090014', NULL, NULL, 'DELIVERY_DELAY', 'RESOLVED', 'Same order: LIKP 0080090011 re-routed TR-FEDEX-D, zzeta within 1 day.', '2026-05-07T06:59:30Z');

