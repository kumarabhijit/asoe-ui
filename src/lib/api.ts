/**
 * API client — aligned with asoe2 FastAPI endpoints (Section 6.2)
 *
 * In development: returns mock data with simulated latency.
 * In production: calls FastAPI at NEXT_PUBLIC_API_URL.
 *
 * All enum values (intents, lifecycle states, recipes) are fetched
 * from the health endpoint per Guardrail #2.
 */

import type { AuthUser, LoginCredentials, LoginResponse, MFAVerifyRequest, SSOInitResponse } from "@/types/auth";
import type {
  ResolveRequest,
  ResolveResponse,
  AsyncResolveResponse,
  ExceptionListResponse,
  ExceptionDetailResponse,
  OverrideRequest,
  ApproveRequest,
  RejectRequest,
  StatsResponse,
  TraceResponse,
  WorkflowRequest,
  WorkflowResult,
  PolicyOverrideRequest,
  PolicyOverrideResponse,
  APIError,
} from "@/types/api";
import type { HealthResponse, ExceptionSummary, LineItem, OrderAnalysis } from "@/types/exceptions";
import { ROLE_PERMISSIONS } from "./roles";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MOCK_DELAY = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── Mock data ─────────────────────────────────────────────────────── */

const MOCK_USER: AuthUser = {
  id: "usr_001",
  sub: "usr_001",
  email: "jane.doe@acme.com",
  name: "Jane Doe",
  roles: ["analyst", "manager"],
  org: "acme-corp",
  permissions: ROLE_PERMISSIONS.manager,
  env: "sandbox",
  auth_method: "sso",
};

const MOCK_EXCEPTIONS: ExceptionSummary[] = [
  {
    id: "exc-001",
    tenant_id: "acme-corp",
    order_id: "SO-1001",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "CONTRACTUAL_CORRECTION",
    lifecycle_state: "RESOLVED",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-11T08:12:00Z",
    updated_at: "2026-04-11T08:20:00Z",
  },
  {
    id: "exc-002",
    tenant_id: "acme-corp",
    order_id: "SO-1042",
    event_type: "EDI_850_DUPLICATE_PO",
    intent: "DUPLICATE_PO",
    lifecycle_state: "PENDING_REVIEW",
    shadow_verdict: "YELLOW",
    selected_recipe: "DuplicatePORecipe.py",
    final_status: "MANUAL_REVIEW_REQUIRED",
    created_at: "2026-04-11T09:05:00Z",
    updated_at: "2026-04-11T09:13:00Z",
  },
  {
    id: "exc-003",
    tenant_id: "acme-corp",
    order_id: "SO-2200",
    event_type: "CREDIT_LIMIT_BREACH",
    intent: "CREDIT_BLOCK",
    lifecycle_state: "BLOCKED",
    shadow_verdict: "RED",
    selected_recipe: undefined,
    final_status: "BLOCKED",
    created_at: "2026-04-11T10:30:00Z",
    updated_at: "2026-04-11T10:31:00Z",
  },
  {
    id: "exc-004",
    tenant_id: "acme-corp",
    order_id: "SO-3100",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "MASS_PRICING_ERROR",
    lifecycle_state: "EXECUTING",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: undefined,
    created_at: "2026-04-11T11:00:00Z",
    updated_at: "2026-04-11T11:02:00Z",
  },
  {
    id: "exc-005",
    tenant_id: "acme-corp",
    order_id: "SO-4455",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "CONTRACTUAL_CORRECTION",
    lifecycle_state: "RESOLVED",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-10T14:22:00Z",
    updated_at: "2026-04-10T14:30:00Z",
  },
  {
    id: "exc-006",
    tenant_id: "acme-corp",
    order_id: "SO-5010",
    event_type: "EDI_850_DUPLICATE_PO",
    intent: "DUPLICATE_PO",
    lifecycle_state: "ESCALATED",
    shadow_verdict: "YELLOW",
    selected_recipe: "DuplicatePORecipe.py",
    final_status: "MANUAL_REVIEW_REQUIRED",
    created_at: "2026-04-09T16:45:00Z",
    updated_at: "2026-04-11T08:45:00Z",
  },
  {
    id: "exc-007",
    tenant_id: "acme-corp",
    order_id: "SO-6001",
    event_type: "CREDIT_LIMIT_BREACH",
    intent: "CREDIT_BLOCK",
    lifecycle_state: "PENDING_REVIEW",
    shadow_verdict: "YELLOW",
    selected_recipe: "CreditHoldReleaseRecipe.py",
    final_status: "MANUAL_REVIEW_REQUIRED",
    created_at: "2026-04-11T07:15:00Z",
    updated_at: "2026-04-11T07:22:00Z",
  },
  {
    id: "exc-008",
    tenant_id: "acme-corp",
    order_id: "SO-7200",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "CONTRACTUAL_CORRECTION",
    lifecycle_state: "CLOSED",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-08T11:00:00Z",
    updated_at: "2026-04-08T12:30:00Z",
  },
];

const MOCK_HEALTH: HealthResponse = {
  status: "ok",
  version: "0.3.2",
  kill_switch: false,
  explain_mode: false,
  allowed_intents: ["CONTRACTUAL_CORRECTION", "CREDIT_BLOCK", "MASS_PRICING_ERROR", "DUPLICATE_PO"],
  lifecycle_states: [
    "INGESTED", "CLASSIFYING", "AUDITING", "PENDING_REVIEW",
    "ESCALATED", "EXECUTING", "RESOLVED", "FAILED",
    "BLOCKED", "REJECTED", "CLOSED",
  ],
  allowed_recipes: ["PriceAdjustmentRecipe.py", "CreditHoldReleaseRecipe.py", "DuplicatePORecipe.py"],
};

/* ── Auth API (/api/auth/*) ─────��──────────────────────────────────── */

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    await delay(MOCK_DELAY);
    if (credentials.email === "jane@acme.com" && credentials.password === "password") {
      return {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        user: MOCK_USER,
        mfa_required: false,
      };
    }
    throw new Error("Invalid email or password");
  },

  async mfaVerify(request: MFAVerifyRequest): Promise<LoginResponse> {
    await delay(MOCK_DELAY);
    return {
      access_token: "mock-access-token-mfa",
      refresh_token: "mock-refresh-token-mfa",
      token_type: "bearer",
      user: MOCK_USER,
      mfa_required: false,
    };
  },

  async ssoInit(provider?: string): Promise<SSOInitResponse> {
    await delay(MOCK_DELAY);
    return {
      redirect_url: `${API_URL}/api/auth/sso/redirect?provider=${provider || "default"}`,
    };
  },

  async me(token: string): Promise<AuthUser> {
    await delay(200);
    if (token) return MOCK_USER;
    throw new Error("Unauthorized");
  },

  async refresh(refreshToken: string): Promise<{ access_token: string }> {
    await delay(200);
    if (refreshToken) return { access_token: "mock-refreshed-token" };
    throw new Error("Invalid refresh token");
  },
};

/* ── Health API (/api/v1/health) ───────────────────────────────────── */

export const healthApi = {
  async get(): Promise<HealthResponse> {
    await delay(100);
    return MOCK_HEALTH;
  },
};

/* ── Exceptions API (/api/v1/exceptions/*) ─────────────────────────── */

export const exceptionsApi = {
  async list(params?: {
    status?: string;
    intent?: string;
    cursor?: string;
    limit?: number;
  }): Promise<ExceptionListResponse> {
    await delay(MOCK_DELAY);
    let filtered = [...MOCK_EXCEPTIONS];
    if (params?.status) {
      filtered = filtered.filter((e) => e.lifecycle_state === params.status);
    }
    if (params?.intent) {
      filtered = filtered.filter((e) => e.intent === params.intent);
    }
    return { data: filtered, has_more: false };
  },

  async get(id: string): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    return {
      ...exc,
      resolution_data: exc.final_status === "COMPLETE" ? {
        credit_amount: 1250.00,
        applied_condition: "YK07",
        new_net_price: 85.00,
      } : {},
      resolved_by: exc.lifecycle_state === "RESOLVED" ? "system" : undefined,
      resolved_action: undefined,
      resolution_notes: undefined,
    };
  },

  async resolve(request: ResolveRequest): Promise<ResolveResponse> {
    await delay(1200);
    return {
      exception_id: `exc-${Date.now()}`,
      trace_id: crypto.randomUUID(),
      intent: "CONTRACTUAL_CORRECTION",
      shadow_verdict: "GREEN",
      selected_recipe: "PriceAdjustmentRecipe.py",
      final_status: "COMPLETE",
      explanation: "Deterministic execution completed successfully.",
      effect_results: [],
    };
  },

  async resolveAsync(request: ResolveRequest): Promise<AsyncResolveResponse> {
    await delay(200);
    return {
      task_id: `task-${Date.now()}`,
      status: "queued",
    };
  },

  async explain(request: ResolveRequest): Promise<ResolveResponse> {
    await delay(800);
    return {
      exception_id: `exc-${Date.now()}`,
      trace_id: crypto.randomUUID(),
      intent: "CONTRACTUAL_CORRECTION",
      shadow_verdict: "GREEN",
      selected_recipe: "PriceAdjustmentRecipe.py",
      final_status: undefined,
      explanation: "Explain mode: recipe would have applied price adjustment.",
      effect_results: [],
    };
  },

  async override(id: string, request: OverrideRequest): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    return {
      ...exc,
      lifecycle_state: "RESOLVED",
      final_status: "COMPLETE",
      resolution_data: {},
      resolved_by: request.resolved_by,
      resolved_action: request.action,
      resolution_notes: request.notes,
    };
  },

  async approve(id: string, request?: ApproveRequest): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    const ts = new Date().toISOString();
    // Backend resumes graph execution to completion on approve
    return {
      ...exc,
      lifecycle_state: "RESOLVED",
      final_status: "COMPLETE",
      resolution_data: {
        action: "APPROVED_BY_REVIEWER",
        recipe_result: "Resolution applied successfully",
        reviewer_comment: request?.notes || null,
        reviewed_at: ts,
      },
      resolved_by: "jane.doe@acme.com",
      resolution_notes: request?.notes,
    };
  },

  async reject(id: string, request?: RejectRequest): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    const ts = new Date().toISOString();
    return {
      ...exc,
      lifecycle_state: "REJECTED",
      final_status: "REJECTED",
      resolution_data: {
        action: "REJECTED_BY_REVIEWER",
        rejection_reason: request?.reason || "No reason provided",
        reviewed_at: ts,
      },
      resolved_by: "jane.doe@acme.com",
      resolution_notes: request?.reason,
    };
  },

  async trace(id: string): Promise<TraceResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    return {
      trace_id: exc.id + "-trace",
      event_id: exc.order_id,
      skill_name: exc.intent ? `${exc.intent}.md` : undefined,
      intent_selected: exc.intent,
      shadow_verdict: exc.shadow_verdict,
      shadow_policy_hits: exc.shadow_verdict === "RED" ? ["PENALTY_MATRIX_VIOLATION"] : [],
      recipe_name: exc.selected_recipe,
      constrained_output_schemas: { intent: "IntentDecision", shadow: "ShadowDecisionSchema" },
      gateway_calls: exc.final_status === "COMPLETE" ? ["erp:update_condition_record"] : [],
      backend_fallback: "deterministic_fallback",
      is_fallback_generated: true,
      final_status: exc.final_status,
      explanation: "Deterministic execution completed successfully.",
    };
  },

  async stats(): Promise<StatsResponse> {
    await delay(MOCK_DELAY);
    return {
      total_exceptions: MOCK_EXCEPTIONS.length,
      open_exceptions: MOCK_EXCEPTIONS.filter(
        (e) => !["RESOLVED", "CLOSED", "REJECTED"].includes(e.lifecycle_state)
      ).length,
      auto_resolved: MOCK_EXCEPTIONS.filter(
        (e) => e.final_status === "COMPLETE" && e.shadow_verdict === "GREEN"
      ).length,
      manual_review: MOCK_EXCEPTIONS.filter(
        (e) => e.final_status === "MANUAL_REVIEW_REQUIRED"
      ).length,
      blocked: MOCK_EXCEPTIONS.filter(
        (e) => e.final_status === "BLOCKED"
      ).length,
      failed: MOCK_EXCEPTIONS.filter(
        (e) => e.final_status === "FAIL_TO_HUMAN"
      ).length,
      avg_resolution_time_seconds: 480,
      by_intent: {
        CONTRACTUAL_CORRECTION: 3,
        DUPLICATE_PO: 2,
        CREDIT_BLOCK: 2,
        MASS_PRICING_ERROR: 1,
      },
      by_lifecycle_state: {
        RESOLVED: 2,
        PENDING_REVIEW: 2,
        BLOCKED: 1,
        EXECUTING: 1,
        ESCALATED: 1,
        CLOSED: 1,
      },
      by_shadow_verdict: {
        GREEN: 4,
        YELLOW: 3,
        RED: 1,
      },
    };
  },

  async lineItems(id: string): Promise<LineItem[]> {
    await delay(MOCK_DELAY);
    return MOCK_LINE_ITEMS[id] ?? [];
  },

  async orderAnalysis(id: string): Promise<OrderAnalysis | null> {
    await delay(MOCK_DELAY);
    return MOCK_ORDER_ANALYSES[id] ?? null;
  },
};

/* ── Workflow API (/api/v1/workflows) ──────────────────────────────── */

export const workflowApi = {
  async execute(request: WorkflowRequest): Promise<WorkflowResult> {
    await delay(MOCK_DELAY);
    return {
      workflow_id: request.workflow_id,
      workflow_name: request.name,
      status: "COMPLETE",
      step_results: request.steps.map((s) => ({
        step_id: s.step_id,
        intent: s.intent,
        status: "COMPLETE",
        exception_id: `exc-wf-${s.step_id}`,
      })),
      compensation_log: [],
    };
  },
};

/* ── Policy API (/api/v1/policies) ─────────────────────────────────── */

export const policyApi = {
  async update(tenantId: string, request: PolicyOverrideRequest): Promise<PolicyOverrideResponse> {
    await delay(MOCK_DELAY);
    return {
      id: `pol-${Date.now()}`,
      tenant_id: tenantId,
      policy_key: request.policy_key,
      value: request.value,
      effective_from: new Date().toISOString(),
      created_by: MOCK_USER.sub,
    };
  },
};

/* ── Mock line-item data (adapted from samples/asoe-sample-screen.jsx) ── */

const MOCK_LINE_ITEMS: Record<string, LineItem[]> = {
  "exc-001": [
    { line_id: "L1", sku: "SKU-0042", description: "12-pk Cola", uom: "CS", quantity: 240, erp_price: 14.88, po_price: 13.20, root_cause: "PROMO_EXPIRED" },
    { line_id: "L2", sku: "SKU-0043", description: "12-pk Diet Cola", uom: "CS", quantity: 120, erp_price: 14.88, po_price: 13.20, root_cause: "PROMO_EXPIRED" },
    { line_id: "L3", sku: "SKU-0051", description: "12-pk Zero Sugar", uom: "CS", quantity: 96, erp_price: 14.88, po_price: 14.90, root_cause: "EDI_MISMATCH" },
  ],
  "exc-002": [
    { line_id: "L1", sku: "SKU-1180", description: "24-pk Water", uom: "CS", quantity: 500, erp_price: 9.60, po_price: 9.62, root_cause: "EDI_MISMATCH" },
    { line_id: "L2", sku: "SKU-1181", description: "12-pk Sparkling", uom: "CS", quantity: 200, erp_price: 11.40, po_price: 10.00, root_cause: "CONTRACT_GAP" },
  ],
  "exc-003": [
    { line_id: "L1", sku: "SKU-3310", description: "Snack Bar 48ct", uom: "CS", quantity: 300, erp_price: 28.44, po_price: 25.00, root_cause: "CONTRACT_GAP" },
    { line_id: "L2", sku: "SKU-3312", description: "Protein Bar 36ct", uom: "CS", quantity: 150, erp_price: 24.00, po_price: 21.50, root_cause: "PROMO_EXPIRED" },
    { line_id: "L3", sku: "SKU-3315", description: "Granola Bar 60ct", uom: "CS", quantity: 80, erp_price: 32.00, po_price: 32.00, root_cause: "EDI_MISMATCH" },
    { line_id: "L4", sku: "SKU-3320", description: "Kids Bar 24ct", uom: "CS", quantity: 200, erp_price: 18.00, po_price: 15.00, root_cause: "MASTER_DATA" },
  ],
  "exc-004": [
    { line_id: "L1", sku: "SKU-5521", description: "Family Pack x6", uom: "CS", quantity: 180, erp_price: 42.00, po_price: 36.00, root_cause: "UOM_ERROR" },
    { line_id: "L2", sku: "SKU-5525", description: "Mega Pack x12", uom: "CS", quantity: 90, erp_price: 82.00, po_price: 72.00, root_cause: "UOM_ERROR" },
  ],
  "exc-005": [
    { line_id: "L1", sku: "SKU-0099", description: "Juice 1L x12", uom: "CS", quantity: 360, erp_price: 19.20, po_price: 17.28, root_cause: "ERP_NOT_LOADED" },
  ],
  "exc-006": [
    { line_id: "L1", sku: "SKU-7701", description: "Energy Drink 4pk", uom: "CS", quantity: 480, erp_price: 8.96, po_price: 8.50, root_cause: "MASTER_DATA" },
    { line_id: "L2", sku: "SKU-7705", description: "Energy Drink 8pk", uom: "CS", quantity: 240, erp_price: 17.50, po_price: 16.00, root_cause: "MASTER_DATA" },
  ],
  "exc-007": [
    { line_id: "L1", sku: "SKU-2210", description: "Sports Drink 12pk", uom: "CS", quantity: 400, erp_price: 12.60, po_price: 11.00, root_cause: "CONTRACT_GAP" },
  ],
  "exc-008": [
    { line_id: "L1", sku: "SKU-8801", description: "Organic Tea 6pk", uom: "CS", quantity: 150, erp_price: 22.50, po_price: 20.00, root_cause: "PROMO_EXPIRED" },
    { line_id: "L2", sku: "SKU-8805", description: "Green Tea 12pk", uom: "CS", quantity: 200, erp_price: 18.00, po_price: 18.00 },
  ],
};

const MOCK_ORDER_ANALYSES: Record<string, OrderAnalysis> = {
  /* ── CONTRACTUAL_CORRECTION: Pricing / Promo exception ───────────── */
  "exc-001": {
    diagnosis: "Two line items reference promo pricing from an expired Q4 trade promotion (ZPROM condition valid through 12/31). One line has a $0.02 EDI rounding variance within tolerance. Recommend auto-override for the rounding and promo reload for the expired conditions.",
    confidence: 92,
    risk: "MEDIUM",
    resolution: "AUTO_OVERRIDE",
    root_cause: "Promotional condition ZPROM/155 expired 12/31/2025. PO still references promo pricing.",
    recommendation: "Adjust price to contract base — reload Q1 promotional conditions or approve at expired promo rate.",
    entity_profile: {
      customer_name: "Metro Grocery Holdings",
      bp_number: "BP-102440",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 4100 — Atlanta DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 1218.24,
      delta_amount: 766.08,
      delta_percentage: 11.3,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-12T18:00:00Z",
      affected_lines: 3,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "TPR discount ZPROM expired 12/31. PO reflects promo price $13.20 but ERP reverted to base $14.88.",
        resolution: "AUTO_OVERRIDE",
        risk: "MEDIUM",
        waterfall: [
          { type: "BASE", label: "Base Price (PR00)", record: "PR00/10", value: 14.88, running: 14.88, detail: "SAP list price, material group 042, effective 01/01/2025" },
          { type: "CONTRACT", label: "Contract Price (ZA01)", record: "ZA01/620", value: 0, running: 14.88, detail: "Active contract #4600012840 — no additional discount at this tier" },
          { type: "TPR", label: "Trade Promo (ZPROM)", record: "ZPROM/155", value: -1.68, running: 13.20, detail: "Q4 promo: 11.3% off-invoice. Valid 10/01–12/31/2025." },
          { type: "ERROR", label: "Promo Validity Check", record: "ZPROM/155", value: null, running: null, detail: "Condition expired 12/31/2025. Current date outside validity.", error: "Promotional condition expired. PO $13.20 reflects promo price, ERP $14.88 reflects reverted base. Delta: -$1.68/unit." },
          { type: "RESULT", label: "ERP Computed Price", record: "—", value: 14.88, running: 14.88, detail: "Final ERP price after condition chain (promo excluded)" },
        ],
      },
      {
        line_id: "L2",
        diagnosis: "Same expired ZPROM condition as L1. Identical root cause.",
        resolution: "AUTO_OVERRIDE",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L3",
        diagnosis: "EDI transmission rounding: $14.90 vs $14.88. Within ±$0.05 tolerance.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [],
      },
    ],
  },
  /* ── DUPLICATE_PO exception ──────────────────────────────────────── */
  "exc-002": {
    diagnosis: "PO #PO-88421 matches existing PO #PO-88419 received 36 hours prior. Identical line items, quantities, and ship-to address. Likely EDI retransmission or buyer system retry.",
    confidence: 88,
    risk: "MEDIUM",
    resolution: "BLOCK_AND_NOTIFY",
    root_cause: "Duplicate PO ID detected within 48-hour window. Identical SKUs, quantities, and delivery address.",
    recommendation: "Block duplicate PO and notify buyer for confirmation before processing.",
    entity_profile: {
      customer_name: "QuickMart Distribution",
      bp_number: "BP-207815",
      customer_tier: "Silver",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 5200 — Dallas DC",
      region: "Central",
    },
    impact_metrics: {
      revenue_at_risk: 6720.00,
      delta_amount: 0,
      delta_percentage: 0,
      fulfillment_gap_pct: 0,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-11T14:00:00Z",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Exact duplicate of PO-88419/L1. Same SKU, qty, ship-to.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Exact duplicate of PO-88419/L2. Same SKU, qty, ship-to.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
  },
  /* ── CREDIT_BLOCK exception (RED) ────────────────────────────────── */
  "exc-003": {
    diagnosis: "Customer credit exposure ($142,500) exceeds approved credit limit ($125,000) by $17,500 (14%). Four line items totalling $13,782 would push exposure to $156,282. Credit hold applied per policy CREDIT-001.",
    confidence: 99,
    risk: "HIGH",
    resolution: "ESCALATE",
    root_cause: "Credit limit breach — current exposure 114% of approved limit. Order would push to 125%.",
    recommendation: "Escalate to Credit Manager for limit review. Do not release hold until exposure is within policy.",
    entity_profile: {
      customer_name: "FreshCo Wholesale Ltd",
      bp_number: "BP-310092",
      customer_tier: "Standard",
      vip_status: false,
      credit_standing: "At Risk",
      location: "Plant 3400 — Chicago DC",
      region: "Midwest",
    },
    impact_metrics: {
      revenue_at_risk: 13782.00,
      delta_amount: 17500.00,
      delta_percentage: 14.0,
      sla_priority: "CRITICAL",
      sla_deadline: "2026-04-11T12:00:00Z",
      affected_lines: 4,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "High-value snack bar order. Contributes $8,532 to credit exposure.",
        resolution: "ESCALATE",
        risk: "HIGH",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Protein bar line. Contributes $3,600 to credit exposure.",
        resolution: "ESCALATE",
        risk: "HIGH",
        waterfall: [],
      },
      {
        line_id: "L3",
        diagnosis: "Granola bar line. No price delta but contributes to credit total.",
        resolution: "ESCALATE",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L4",
        diagnosis: "Kids bar line. $600 delta adds $3,600 to exposure.",
        resolution: "ESCALATE",
        risk: "HIGH",
        waterfall: [],
      },
    ],
  },
  /* ── MASS_PRICING_ERROR exception ────────────────────────────────── */
  "exc-004": {
    diagnosis: "UOM conversion factor mismatch on both line items. Pack-size to case conversion not loaded in ERP master data.",
    confidence: 97,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
    root_cause: "UOM conversion factor CS→EA missing from material master. ERP prices in case units, PO in each units.",
    recommendation: "Apply UOM correction factor and update material master to prevent recurrence.",
    entity_profile: {
      customer_name: "ValuePack Stores Inc",
      bp_number: "BP-445520",
      customer_tier: "Platinum",
      vip_status: true,
      credit_standing: "Good",
      location: "Plant 7800 — LA DC",
      region: "West",
    },
    impact_metrics: {
      revenue_at_risk: 14940.00,
      delta_amount: 2520.00,
      delta_percentage: 14.3,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-11T16:00:00Z",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "UOM conversion factor mismatch: 6-pack case factor not loaded.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [
          { type: "BASE", label: "Base Price (PR00)", record: "PR00/55", value: 42.00, running: 42.00, detail: "SAP list price per case (6-pack)" },
          { type: "UOM", label: "UOM Conversion", record: "QUOM/12", value: -6.00, running: 36.00, detail: "Pack-size conversion factor CS→EA" },
          { type: "ERROR", label: "UOM Validation", record: "QUOM/12", value: null, running: null, detail: "Conversion factor not loaded in material master.", error: "UOM conversion factor missing. PO price $36.00 uses EA unit, ERP price $42.00 uses CS unit." },
          { type: "RESULT", label: "ERP Computed Price", record: "—", value: 42.00, running: 42.00, detail: "ERP price without UOM conversion applied" },
        ],
      },
      {
        line_id: "L2",
        diagnosis: "Same UOM conversion issue for 12-pack variant.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [],
      },
    ],
  },
  /* ── CONTRACTUAL_CORRECTION: Resolved ────────────────────────────── */
  "exc-005": {
    diagnosis: "Single line item — ERP base price not loaded for new SKU-0099. PO price matches contracted rate.",
    confidence: 95,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
    root_cause: "New SKU price record (PR00) not yet loaded in SAP condition table. Contract rate is correct.",
    recommendation: "Approve PO price as contract rate and request SAP master data load for SKU-0099.",
    entity_profile: {
      customer_name: "Sunrise Beverages Co",
      bp_number: "BP-118903",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 2100 — Miami DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 6220.80,
      delta_amount: 691.20,
      delta_percentage: 10.0,
      sla_priority: "LOW",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "ERP base price not loaded. PO price $17.28 is the correct contract rate.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [],
      },
    ],
  },
  /* ── DUPLICATE_PO: Escalated ─────────────────────────────────────── */
  "exc-006": {
    diagnosis: "PO flagged as potential duplicate. Similar line items but different quantities — may be a legitimate reorder vs. duplicate transmission.",
    confidence: 72,
    risk: "MEDIUM",
    resolution: "REQUEST_BUYER_CONFIRMATION",
    root_cause: "PO structure matches prior order within 72h window but quantities differ by 15%. Ambiguous duplicate.",
    recommendation: "Request buyer confirmation — quantities differ enough to be a legitimate reorder.",
    entity_profile: {
      customer_name: "PowerDrink Distributors",
      bp_number: "BP-520871",
      customer_tier: "Silver",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 6100 — Denver DC",
      region: "Mountain",
    },
    impact_metrics: {
      revenue_at_risk: 8092.80,
      delta_amount: 456.00,
      delta_percentage: 5.6,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-12T08:00:00Z",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Similar to prior PO-91203/L1 but qty differs (480 vs 410). May be reorder.",
        resolution: "REQUEST_BUYER_CONFIRMATION",
        risk: "MEDIUM",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Similar to prior PO-91203/L2 but qty differs (240 vs 200).",
        resolution: "REQUEST_BUYER_CONFIRMATION",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
  },
  /* ── CREDIT_BLOCK: Pending Review ────────────────────────────────── */
  "exc-007": {
    diagnosis: "Customer approaching credit limit. Current exposure $93,200 against $100,000 limit. This order ($5,040) would bring exposure to $98,240 — within limit but triggering the 90% warning threshold.",
    confidence: 85,
    risk: "MEDIUM",
    resolution: "ALLOW_BOTH",
    root_cause: "Credit exposure at 93.2% of limit. Order is within limit but triggers 90% warning policy (CREDIT-002).",
    recommendation: "Approve order — within credit limit. Flag account for proactive credit review within 7 days.",
    entity_profile: {
      customer_name: "ActiveLife Health Stores",
      bp_number: "BP-660134",
      customer_tier: "Gold",
      vip_status: true,
      credit_standing: "Watch",
      location: "Plant 1500 — NYC DC",
      region: "Northeast",
    },
    impact_metrics: {
      revenue_at_risk: 5040.00,
      delta_amount: 640.00,
      delta_percentage: 12.7,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-11T10:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Sports drink order. $1.60/unit delta. Within credit limit but near threshold.",
        resolution: "ALLOW_BOTH",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
  },
  /* ── CONTRACTUAL_CORRECTION: Closed ──────────────────────────────── */
  "exc-008": {
    diagnosis: "One line with expired seasonal promotion, one line priced correctly. Auto-resolved — promo condition reloaded from Q1 trade plan.",
    confidence: 96,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
    root_cause: "Seasonal promo ZTEA/Q4 expired. Q1 replacement promo ZTEA/Q1 available in trade plan.",
    recommendation: "No action required — auto-resolved. Q1 promo condition applied successfully.",
    entity_profile: {
      customer_name: "GreenLeaf Natural Foods",
      bp_number: "BP-890045",
      customer_tier: "Standard",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 3200 — Portland DC",
      region: "Pacific Northwest",
    },
    impact_metrics: {
      revenue_at_risk: 3375.00,
      delta_amount: 375.00,
      delta_percentage: 11.1,
      sla_priority: "LOW",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Seasonal promo ZTEA/Q4 expired. Q1 replacement promo available.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Correctly priced at base rate. No action needed.",
        resolution: "NONE",
        risk: "LOW",
        waterfall: [],
      },
    ],
  },
};
