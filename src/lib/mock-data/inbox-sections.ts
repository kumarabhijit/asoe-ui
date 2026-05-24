/**
 * Mock Customer-Inbox evidence sections (ADR-042 Phases 3–7).
 *
 * Rich, prototype-flavoured payloads so the inbox sections render with real
 * shapes in MOCK MODE (the dev default). These mirror the backend contracts in
 * `src/types/exceptions.ts` exactly — the sections are dumb projectors, so what
 * we author here is what an operator sees. Keyed bundles are spread into
 * `MOCK_ORDER_ANALYSES` (see order-analyses.ts).
 *
 * NOTE: validation / demo data only. The authoritative builders live in asoe2
 * (`gateways/edi850.py`, `recipes/ChangeAnalysisRecipe.py`, …); these are static
 * stand-ins shaped to match.
 */
import type {
  ChangeAnalysis,
  DraftReply,
  Edi850Document,
  EntitiesAnalysisData,
  KnowledgeGraphPayload,
  OrderEntryExtraction,
  SapDataAnalysisData,
} from "@/types/exceptions";

// ── EDI 850 ────────────────────────────────────────────────────────────────

function edi850(opts: {
  poNumber: string;
  poDate: string;
  buyerName: string;
  buyerId: string;
  sellerName: string;
  sellerId: string;
  currency?: string;
  requestedDate?: string;
  lines: { line_num: string; material: string; description: string; quantity: number; uom: string; unit_price: number }[];
}): Edi850Document {
  const currency = opts.currency ?? "USD";
  const seg = (seg_id: string, group: string, meaning: string, raw: string) => ({
    seg_id, elements: [], raw, meaning, group,
  });
  const lineItems = opts.lines.map((l) => ({
    line_num: l.line_num,
    quantity: l.quantity,
    uom: l.uom,
    unit_price: l.unit_price,
    product_qualifier: "VP",
    product_id: l.material,
    description: l.description,
    extended_amount: Math.round(l.quantity * l.unit_price * 100) / 100,
  }));
  const totalQty = opts.lines.reduce((a, l) => a + l.quantity, 0);
  const totalAmount = Math.round(lineItems.reduce((a, l) => a + (l.extended_amount ?? 0), 0) * 100) / 100;
  const ymd = opts.poDate.replace(/-/g, "");
  const segments = [
    seg("ISA", "envelope", "Interchange Control Header", `ISA*00**00**ZZ*${opts.buyerId.padEnd(15)}*ZZ*${opts.sellerId.padEnd(15)}*${ymd.slice(2)}*0000*U*00501*000012345*0*P*>~`),
    seg("GS", "envelope", "Functional Group Header", `GS*PO*${opts.buyerId}*${opts.sellerId}*${ymd}*0000*12345*X*005010~`),
    seg("ST", "envelope", "Transaction Set Header", "ST*850*0001~"),
    seg("BEG", "header", "Beginning Segment for Purchase Order", `BEG*00*SA*${opts.poNumber}**${ymd}~`),
    seg("CUR", "header", "Currency", `CUR*BY*${currency}~`),
    seg("REF", "header", "Reference Identification", `REF*PO*${opts.poNumber}~`),
    seg("DTM", "dates", "Date/Time Reference", `DTM*004*${ymd}~`),
    ...(opts.requestedDate ? [seg("DTM", "dates", "Date/Time Reference", `DTM*002*${opts.requestedDate.replace(/-/g, "")}~`)] : []),
    seg("N1", "party", "Party Identification", `N1*BY*${opts.buyerName}*92*${opts.buyerId}~`),
    seg("N1", "party", "Party Identification", `N1*SE*${opts.sellerName}*92*${opts.sellerId}~`),
    ...opts.lines.flatMap((l) => [
      seg("PO1", "line", "Baseline Item Data", `PO1*${l.line_num}*${l.quantity}*${l.uom}*${l.unit_price}*PE*VP*${l.material}~`),
      seg("PID", "line", "Product/Item Description", `PID*F****${l.description}~`),
    ]),
    seg("CTT", "trailer", "Transaction Totals", `CTT*${opts.lines.length}*${totalQty}~`),
    seg("SE", "trailer", "Transaction Set Trailer", `SE*${opts.lines.length * 2 + 9}*0001~`),
    seg("GE", "trailer", "Functional Group Trailer", "GE*1*12345~"),
    seg("IEA", "trailer", "Interchange Control Trailer", "IEA*1*000012345~"),
  ];
  return {
    standard: "ANSI X12 5010",
    transaction_set: "850",
    envelope: {
      sender_id: opts.buyerId,
      receiver_id: opts.sellerId,
      interchange_control_number: "000012345",
      group_control_number: "12345",
      transaction_set_control_number: "0001",
      usage_indicator: "P",
      x12_version: "005010",
    },
    header: {
      purpose_code: "00",
      po_type: "SA",
      po_number: opts.poNumber,
      po_date: opts.poDate,
      currency,
      requested_delivery_date: opts.requestedDate ?? null,
    },
    parties: [
      { entity_code: "BY", role: "Buying Party (Purchaser)", name: opts.buyerName, id_qualifier: "92", id_value: opts.buyerId, address: null, city_state_zip: null },
      { entity_code: "SE", role: "Selling Party", name: opts.sellerName, id_qualifier: "92", id_value: opts.sellerId, address: null, city_state_zip: null },
    ],
    line_items: lineItems,
    totals: { total_line_items: opts.lines.length, total_quantity: totalQty, total_amount: totalAmount },
    segments,
    raw_x12: segments.map((s) => s.raw).join("\n"),
  };
}

// ── Change Analysis (the prototype's 10-constraint evaluator) ────────────────

type CheckStatus = "PASS" | "CONDITIONAL" | "WARNING";

function check(name: string, status: CheckStatus, detail: string, metric: string, agent: string, system_ref: string) {
  return { name, status, detail, metric, agent, system_ref };
}

const LIFECYCLE = ["Created", "Confirmed", "Released", "Picked", "Shipped"];

export type ChangeVariant = "qty_reduction" | "expedite" | "cancellation" | "sku_substitution";

export function changeAnalysisFor(variant: ChangeVariant): ChangeAnalysis {
  const base = {
    inventory: check("Inventory", "PASS", "ATP covers the requested quantity.", "ATP 920 vs 600", "Inventory Agent", "SAP MM/ATP"),
    production: check("Production", "PASS", "Production order released; change can be incorporated.", "Order status REL", "Production Agent", "SAP PP"),
    transport: check("Transport", "PASS", "Route and carrier capacity available.", "route=true, carrier=true", "Transport Agent", "TMS"),
    warehouse: check("Warehouse", "PASS", "Pick/pack is feasible for the change.", "pick_pack_feasible=true", "Warehouse Agent", "WMS"),
    order_status: check("Order Status", "CONDITIONAL", "Order is mid-fulfilment; change needs coordination.", "fulfilment stage 2/5", "Order Lifecycle Agent", "SAP SD"),
    sla: check("SLA", "PASS", "Change stays within the contractual delivery window.", "4 days to deadline", "SLA Agent", "Contract DB"),
    financial: check("Financial", "PASS", "Revenue impact is below the four-eyes threshold.", "$5,184.00 revenue impact", "Finance Agent", "SAP FI/CO"),
    dependencies: check("Dependencies", "PASS", "No linked orders or deliveries affected.", "0 linked orders", "Dependency Agent", "SAP SD"),
    network: check("Network", "PASS", "DC routing supports the change.", "dc_routing_ok=true", "Network Optimization", "Network Opt"),
    priority: check("Priority", "CONDITIONAL", "Customer tier requires manual approval of the change.", "tier GOLD", "Priority Agent", "CRM"),
  };

  const variants: Record<ChangeVariant, () => ChangeAnalysis> = {
    qty_reduction: () => assemble(
      [{ field: "Line 001 quantity", from_value: "600 CS", to_value: "420 CS" }],
      { ...base },
      [
        scenario("Approve as requested", "Reduce the line to 420 CS and re-confirm.", true, "All constraints clear or conditional.", 0),
        scenario("Partial keep + backorder", "Keep 480 CS now, backorder the rest if demand returns.", false, "Protects margin on the original commitment.", 1555.2),
      ],
      decision("Approve as requested", 0.86, "Change is feasible with conditions; review the conditional checks.", 27216, false, ["VA02: update sales order"]),
    ),
    expedite: () => assemble(
      [{ field: "Requested delivery", from_value: "2026-05-24", to_value: "2026-05-20" }],
      { ...base, sla: check("SLA", "CONDITIONAL", "Change is within window but the deadline is tight.", "1 day to deadline", "SLA Agent", "Contract DB"), transport: check("Transport", "CONDITIONAL", "Partial transport availability; re-plan may be needed.", "route=true, carrier=false", "Transport Agent", "TMS") },
      [
        scenario("Approve as requested", "Pull the delivery in four days as requested.", false, "One or more constraints flag a warning.", 0),
        scenario("Expedite shipping", "Upgrade the carrier service to hold the SLA window.", true, "Holds the delivery window at added freight cost.", -1360.8),
      ],
      decision("Expedite shipping", 0.74, "Change is feasible with conditions; review the conditional checks.", 27216, false, ["VA02: update sales order", "VT02N: re-plan shipment"]),
    ),
    cancellation: () => assemble(
      [{ field: "Order status", from_value: "Open", to_value: "Cancelled" }],
      { ...base, order_status: check("Order Status", "WARNING", "Order is late in fulfilment; change is high-risk.", "fulfilment stage 4/5", "Order Lifecycle Agent", "SAP SD"), warehouse: check("Warehouse", "WARNING", "Pick/pack is not feasible at the current stage.", "pick_pack_feasible=false", "Warehouse Agent", "WMS"), financial: check("Financial", "CONDITIONAL", "Revenue impact meets the four-eyes threshold; cosign required.", "$48,200.00 revenue impact", "Finance Agent", "SAP FI/CO") },
      [
        scenario("Approve as requested", "Cancel the order in full.", false, "One or more constraints raised a warning.", 0),
        scenario("Partial fulfilment", "Ship the already-picked portion, cancel the remainder.", false, "Protects the delivery date for the available portion.", -12050),
        scenario("Reject / escalate to planner", "Decline the cancellation and route to a supply planner.", true, "Avoids committing to an infeasible change.", null),
      ],
      decision("Reject / escalate to planner", 0.45, "One or more constraints raised a warning; see the flagged checks.", 48200, true, ["VA02: update sales order"]),
    ),
    sku_substitution: () => assemble(
      [{ field: "Line 002 material", from_value: "BEV-LEMON-6PK", to_value: "BEV-LEMON-12PK" }],
      { ...base, inventory: check("Inventory", "CONDITIONAL", "ATP partially covers the change; partial ship feasible.", "ATP 180 vs 240", "Inventory Agent", "SAP MM/ATP") },
      [
        scenario("Approve as requested", "Substitute to the 12-pack SKU.", false, "One or more constraints flag a warning.", 0),
        scenario("Partial fulfilment", "Ship available 12-pack now, backorder the balance.", true, "Protects the delivery date for the available portion.", -2120),
      ],
      decision("Partial fulfilment", 0.78, "Change is feasible with conditions; review the conditional checks.", 8480, false, ["VA02: update sales order"]),
    ),
  };
  return variants[variant]();
}

function scenario(name: string, description: string, recommended: boolean, impact: string, financial_delta_usd: number | null) {
  return { name, description, recommended, impact, financial_delta_usd };
}

function decision(recommended_action: string, confidence: number, rationale: string, revenue_impact_usd: number, requires_cosign: boolean, sap_actions: string[]) {
  return { recommended_action, confidence, rationale, revenue_impact_usd, requires_cosign, sap_actions };
}

function assemble(
  change_items: { field: string; from_value: string; to_value: string }[],
  checksMap: Record<string, { name: string; status: CheckStatus; detail: string; metric: string; agent: string; system_ref: string }>,
  scenarios: ReturnType<typeof scenario>[],
  dec: ReturnType<typeof decision>,
): ChangeAnalysis {
  const checks = Object.values(checksMap);
  const count = (s: CheckStatus) => checks.filter((c) => c.status === s).length;
  return {
    evaluation: {
      lifecycle_stages: LIFECYCLE,
      lifecycle_index: 2,
      change_items,
      checks,
      pass_count: count("PASS"),
      conditional_count: count("CONDITIONAL"),
      warning_count: count("WARNING"),
    },
    scenarios,
    decision: dec,
  };
}

// ── Knowledge Graph ─────────────────────────────────────────────────────────

export function knowledgeGraphFor(opts: {
  orderId: string;
  customerName: string;
  customerBp: string;
  materials: { id: string; label: string; detail: string }[];
  sapDoc?: string;
}): KnowledgeGraphPayload {
  const root = `order:${opts.orderId.toLowerCase()}`;
  const cust = `customer:${opts.customerBp}`;
  const nodes = [
    { id: root, label: opts.orderId, kind: "order", detail: "Sales order" },
    { id: cust, label: opts.customerName, kind: "customer", detail: `BP ${opts.customerBp}` },
    ...opts.materials.map((m) => ({ id: `material:${m.id}`, label: m.label, kind: "material", detail: m.detail })),
    ...(opts.sapDoc ? [{ id: `sap_doc:${opts.sapDoc}`, label: opts.sapDoc, kind: "sap_doc", detail: "SO confirmed, ATP OK" }] : []),
  ];
  const edges = [
    { source: cust, target: root, relation: "places" },
    ...opts.materials.map((m) => ({ source: root, target: `material:${m.id}`, relation: "contains" })),
    ...(opts.sapDoc ? [{ source: root, target: `sap_doc:${opts.sapDoc}`, relation: "validated_by" }] : []),
  ];
  return { nodes, edges, root_id: root };
}

// ── Per-case section bundles ────────────────────────────────────────────────

type InboxSections = Pick<
  import("@/types/exceptions").OrderAnalysis,
  | "order_entry_extraction"
  | "edi_850_audit"
  | "change_analysis"
  | "knowledge_graph"
  | "draft_reply"
  | "entities_analysis"
  | "sap_data_analysis"
>;

const SE_ENTITIES: EntitiesAnalysisData = {
  extracted: [
    { key: "customer_po", value: "EML-PO-2026-0042", kind: "po", confidence: 0.98, source_span: "PO# EML-PO-2026-0042" },
    { key: "customer", value: "Southeast Beverage Distributors", kind: "customer", confidence: 0.95, source_span: "From: buyer@southeast-distrib.example" },
    { key: "ship_to", value: "Atlanta DC #6094", kind: "location", confidence: 0.88, source_span: "ship to Atlanta DC" },
    { key: "requested_date", value: "2026-05-24", kind: "date", confidence: 0.9, source_span: "need by May 24" },
    { key: "material", value: "BEV-COLA-12PK", kind: "material", confidence: 0.94, source_span: "Cola 12pk x 600" },
  ],
};

const SE_SAP: SapDataAnalysisData = {
  system: "S4H_PRD",
  validation_status: "Sold-to resolved · ATP OK · credit clear",
  order_value_usd: 27216.0,
  sap_doc_number: "5100012344",
};

const SE_ORDER_ENTRY: OrderEntryExtraction = {
  source_type: "PDF",
  confidence: 0.88,
  header: { customer_po: "EML-PO-2026-0042", order_type: "ZOR", sales_org: "1000", dist_channel: "10", requested_date: "2026-05-24", ship_window_from: null, ship_window_to: null },
  customer_name: "Southeast Beverage Distributors",
  customer_bp: "300042",
  line_items: [
    { line_num: "001", material: "BEV-COLA-12PK", description: "Cola 12-pack case", quantity: 600, uom: "CS", unit_price: 8.64, mdm_matched: true },
    { line_num: "002", material: "BEV-LEMON-6PK", description: "Lemon 6-pack case", quantity: 240, uom: "CS", unit_price: 5.5, mdm_matched: true },
  ],
  validation_flags: [
    { field: "ship_to", severity: "WARNING", message: "Ship-to 'Atlanta DC' is ambiguous — confirm DC #6094." },
    { field: "line 002", severity: "INFO", message: "Matched to material master." },
  ],
};

const SE_EDI = edi850({
  poNumber: "EML-PO-2026-0042", poDate: "2026-04-30",
  buyerName: "Southeast Beverage Distributors", buyerId: "300042",
  sellerName: "Acme Beverages Co", sellerId: "VENDOR-7788",
  requestedDate: "2026-05-24",
  lines: [
    { line_num: "001", material: "BEV-COLA-12PK", description: "Cola 12-pack case", quantity: 600, uom: "CS", unit_price: 8.64 },
    { line_num: "002", material: "BEV-LEMON-6PK", description: "Lemon 6-pack case", quantity: 240, uom: "CS", unit_price: 5.5 },
  ],
});

const SE_DRAFT: DraftReply = {
  status: "DRAFTED",
  reason: null,
  template_name: "order_clarification_request",
  recipient: "buyer@southeast-distrib.example",
  subject: "Re: PO EML-PO-2026-0042 — please confirm ship-to",
  body:
    "Hello,\n\nThanks for your order (PO EML-PO-2026-0042). Before we release it we need to confirm one detail:\n\n• Ship-to: you wrote \"Atlanta DC\" — please confirm this is DC #6094.\n\nOnce confirmed we'll process 600 CS of BEV-COLA-12PK and 240 CS of BEV-LEMON-6PK for delivery by 2026-05-24.\n\nThank you,\nAcme Beverages Order Desk",
  edits_applied: [
    { field: "subject", before: "Re: your order", after: "Re: PO EML-PO-2026-0042 — please confirm ship-to" },
  ],
  drafted_by: "analyst-1",
  drafted_at: "2026-04-30T10:20:00Z",
};

const SE_KG = knowledgeGraphFor({
  orderId: "EML-PO-2026-0042",
  customerName: "Southeast Beverage Distributors",
  customerBp: "300042",
  materials: [
    { id: "bev-cola-12pk", label: "BEV-COLA-12PK", detail: "600 CS" },
    { id: "bev-lemon-6pk", label: "BEV-LEMON-6PK", detail: "240 CS" },
  ],
  sapDoc: "5100012344",
});

// ── Inquiry / complaint / happy-path fixtures ───────────────────────────────

const INQUIRY_ENTITIES: EntitiesAnalysisData = {
  extracted: [
    { key: "order_ref", value: "SO-5100012344", kind: "order_id", confidence: 0.96, source_span: "re: order SO-5100012344" },
    { key: "invoice_ref", value: "INV-2026-8841", kind: "invoice", confidence: 0.91, source_span: "invoice INV-2026-8841" },
    { key: "customer", value: "Southeast Beverage Distributors", kind: "customer", confidence: 0.97, source_span: "From: ap@southeast-distrib.example" },
  ],
};

const INQUIRY_SAP: SapDataAnalysisData = {
  system: "S4H_PRD",
  validation_status: "Order SO-5100012344 — delivered 2026-05-09; invoice cleared",
  order_value_usd: 27216.0,
  sap_doc_number: "5100012344",
};

const INQUIRY_DRAFT: DraftReply = {
  status: "DRAFTED",
  reason: null,
  template_name: "order_status_response",
  recipient: "ap@southeast-distrib.example",
  subject: "Re: Status of order SO-5100012344",
  body:
    "Hello,\n\nThanks for checking in. Order SO-5100012344 was delivered on 2026-05-09 and invoice INV-2026-8841 has cleared in full. No action is needed on your side.\n\nLet us know if you'd like the POD or a copy of the invoice.\n\nAcme Beverages Order Desk",
  edits_applied: [],
  drafted_by: "analyst-2",
  drafted_at: "2026-05-20T14:05:00Z",
};

const COMPLAINT_ENTITIES: EntitiesAnalysisData = {
  extracted: [
    { key: "order_ref", value: "SO-5100012501", kind: "order_id", confidence: 0.95, source_span: "order SO-5100012501" },
    { key: "issue", value: "short shipment", kind: "issue", confidence: 0.9, source_span: "received 380 of 480 cases" },
    { key: "material", value: "BEV-COLA-12PK", kind: "material", confidence: 0.93, source_span: "Cola 12pk" },
  ],
};

const COMPLAINT_SAP: SapDataAnalysisData = {
  system: "S4H_PRD",
  validation_status: "Delivery 8100044122 — 380/480 CS confirmed; 100 CS short",
  order_value_usd: 4147.2,
  sap_doc_number: "5100012501",
};

const COMPLAINT_DRAFT: DraftReply = {
  status: "DRAFTED",
  reason: null,
  template_name: "complaint_acknowledgement",
  recipient: "buyer@walmart.example",
  subject: "Re: Short shipment on SO-5100012501",
  body:
    "Hello,\n\nThank you for flagging this — we're sorry the BEV-COLA-12PK delivery arrived short (380 of 480 CS). We've opened a follow-up shipment for the missing 100 CS and a goodwill credit is under review.\n\nWe'll confirm the replacement ship date within one business day.\n\nAcme Beverages Customer Care",
  edits_applied: [
    { field: "body", before: "(template)", after: "goodwill credit is under review" },
  ],
  drafted_by: "analyst-3",
  drafted_at: "2026-05-21T09:30:00Z",
};

const HAPPY_ORDER_ENTRY: OrderEntryExtraction = {
  source_type: "EDI_850",
  confidence: 0.97,
  header: { customer_po: "EDI-PO-2026-7781", order_type: "ZOR", sales_org: "1000", dist_channel: "10", requested_date: "2026-05-26", ship_window_from: null, ship_window_to: null },
  customer_name: "Kroger Co",
  customer_bp: "300077",
  line_items: [
    { line_num: "001", material: "BEV-COLA-12PK", description: "Cola 12-pack case", quantity: 480, uom: "CS", unit_price: 8.64, mdm_matched: true },
  ],
  validation_flags: [
    { field: "line 001", severity: "INFO", message: "Matched to material master; all fields validated." },
  ],
};

const HAPPY_EDI = edi850({
  poNumber: "EDI-PO-2026-7781", poDate: "2026-05-22",
  buyerName: "Kroger Co", buyerId: "300077",
  sellerName: "Acme Beverages Co", sellerId: "VENDOR-7788",
  requestedDate: "2026-05-26",
  lines: [
    { line_num: "001", material: "BEV-COLA-12PK", description: "Cola 12-pack case", quantity: 480, uom: "CS", unit_price: 8.64 },
  ],
});

const HAPPY_KG = knowledgeGraphFor({
  orderId: "EDI-PO-2026-7781",
  customerName: "Kroger Co",
  customerBp: "300077",
  materials: [{ id: "bev-cola-12pk", label: "BEV-COLA-12PK", detail: "480 CS" }],
  sapDoc: "5100012799",
});

/** Section bundles keyed by exception id. Spread into MOCK_ORDER_ANALYSES. */
export const INBOX_SECTION_BUNDLES: Record<string, Partial<InboxSections>> = {
  // New email order — extraction + EDI 850 + entities + SAP + draft + graph.
  "exc-026": {
    order_entry_extraction: SE_ORDER_ENTRY,
    edi_850_audit: SE_EDI,
    entities_analysis: SE_ENTITIES,
    sap_data_analysis: SE_SAP,
    draft_reply: SE_DRAFT,
    knowledge_graph: SE_KG,
  },
  // Order-change requests — Change Analysis + graph (+ EDI of the original PO).
  "exc-040": {
    change_analysis: changeAnalysisFor("qty_reduction"),
    knowledge_graph: SE_KG,
    entities_analysis: SE_ENTITIES,
    sap_data_analysis: SE_SAP,
    edi_850_audit: SE_EDI,
  },
  "exc-041": {
    change_analysis: changeAnalysisFor("expedite"),
    knowledge_graph: SE_KG,
    sap_data_analysis: SE_SAP,
  },
  "exc-042": {
    change_analysis: changeAnalysisFor("cancellation"),
    knowledge_graph: SE_KG,
    sap_data_analysis: { ...SE_SAP, order_value_usd: 48200.0 },
  },
  "exc-043": {
    change_analysis: changeAnalysisFor("sku_substitution"),
    knowledge_graph: SE_KG,
    entities_analysis: SE_ENTITIES,
  },
  // Inquiry — buyer asks about an order/invoice status (no order/EDI section).
  "exc-044": {
    entities_analysis: INQUIRY_ENTITIES,
    sap_data_analysis: INQUIRY_SAP,
    draft_reply: INQUIRY_DRAFT,
  },
  // Complaint — short shipment; acknowledgement draft + the affected order graph.
  "exc-045": {
    entities_analysis: COMPLAINT_ENTITIES,
    sap_data_analysis: COMPLAINT_SAP,
    draft_reply: COMPLAINT_DRAFT,
    knowledge_graph: knowledgeGraphFor({
      orderId: "SO-5100012501", customerName: "Walmart", customerBp: "300001",
      materials: [{ id: "bev-cola-12pk", label: "BEV-COLA-12PK", detail: "380/480 CS" }],
      sapDoc: "5100012501",
    }),
  },
  // Happy path — high-confidence EDI order, auto-resolved end-to-end.
  "exc-046": {
    order_entry_extraction: HAPPY_ORDER_ENTRY,
    edi_850_audit: HAPPY_EDI,
    entities_analysis: {
      extracted: [
        { key: "customer_po", value: "EDI-PO-2026-7781", kind: "po", confidence: 0.99, source_span: "BEG*00*SA*EDI-PO-2026-7781" },
        { key: "customer", value: "Kroger Co", kind: "customer", confidence: 0.99, source_span: "N1*BY*Kroger Co" },
        { key: "material", value: "BEV-COLA-12PK", kind: "material", confidence: 0.98, source_span: "PO1*001*480*CS" },
      ],
    },
    sap_data_analysis: { system: "S4H_PRD", validation_status: "SO created · ATP OK · credit clear · auto-confirmed", order_value_usd: 4147.2, sap_doc_number: "5100012799" },
    knowledge_graph: HAPPY_KG,
  },
};
