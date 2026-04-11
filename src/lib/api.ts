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
    return {
      ...exc,
      lifecycle_state: "EXECUTING",
      resolution_data: {},
      resolution_notes: request?.notes,
    };
  },

  async reject(id: string, request?: RejectRequest): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    return {
      ...exc,
      lifecycle_state: "REJECTED",
      final_status: "REJECTED",
      resolution_data: {},
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
  "exc-001": {
    diagnosis: "Two line items reference promo pricing from an expired Q4 trade promotion (ZPROM condition valid through 12/31). One line has a $0.02 EDI rounding variance within tolerance. Recommend auto-override for the rounding and promo reload for the expired conditions.",
    confidence: 92,
    risk: "MEDIUM",
    resolution: "AUTO_OVERRIDE",
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
  "exc-004": {
    diagnosis: "UOM conversion factor mismatch on both line items. Pack-size to case conversion not loaded in ERP master data.",
    confidence: 97,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
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
};
