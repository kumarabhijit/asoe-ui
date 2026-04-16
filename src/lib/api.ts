/**
 * API client — aligned with asoe2 FastAPI endpoints (Section 6.2)
 *
 * In development: returns mock data with simulated latency.
 * In production: calls FastAPI at NEXT_PUBLIC_API_URL.
 *
 * All enum values (intents, lifecycle states, recipes) are fetched
 * from the health endpoint per Guardrail #2.
 */

import type { AuthUser, LoginCredentials, LoginResponse, MFAVerifyRequest, SSOInitResponse, Persona, PersonaListResponse } from "@/types/auth";
import type {
  ResolveRequest,
  ResolveResponse,
  AsyncResolveResponse,
  ExceptionListResponse,
  ExceptionDetailResponse,
  OverrideRequest,
  ApproveRequest,
  RejectRequest,
  ChallengeRequest,
  AdminReleaseRequest,
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
    customer_name: "Walmart",
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
    customer_name: "Kroger",
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
    customer_name: "Target",
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
    customer_name: "Costco",
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
    customer_name: "Walmart",
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
    customer_name: "Kroger",
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
    customer_name: "Target",
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
    customer_name: "Costco",
  },
  {
    id: "exc-009",
    tenant_id: "acme-corp",
    order_id: "SO-8100",
    event_type: "EDI_850_DUPLICATE_PO",
    intent: "DUPLICATE_PO",
    lifecycle_state: "RESOLVED",
    shadow_verdict: "GREEN",
    selected_recipe: "DuplicatePORecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-11T06:20:00Z",
    updated_at: "2026-04-11T06:22:00Z",
    customer_name: "Walmart",
  },
  {
    id: "exc-010", tenant_id: "acme-corp", order_id: "SO-9200", event_type: "BACK_ORDER_OOS", intent: "BACK_ORDER", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "BackOrderResolutionRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-12T10:15:00Z", updated_at: "2026-04-12T10:22:00Z", customer_name: "Kroger",
  },
  {
    id: "exc-011", tenant_id: "acme-corp", order_id: "SO-9450", event_type: "BACK_ORDER_OOS", intent: "BACK_ORDER", lifecycle_state: "RESOLVED", shadow_verdict: "GREEN", selected_recipe: "BackOrderResolutionRecipe.py", final_status: "COMPLETE", created_at: "2026-04-12T08:00:00Z", updated_at: "2026-04-12T08:05:00Z", customer_name: "Target",
  },
  {
    id: "exc-012", tenant_id: "acme-corp", order_id: "SO-10100", event_type: "OVER_MAX_QTY", intent: "OVER_MAX", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "OverMaxTrimRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-13T09:30:00Z", updated_at: "2026-04-13T09:38:00Z", customer_name: "Costco",
  },
  {
    id: "exc-013", tenant_id: "acme-corp", order_id: "SO-11200", event_type: "MIN_ORDER_QTY", intent: "MIN_ORDER_QTY", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "MOQRoundUpRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-14T07:45:00Z", updated_at: "2026-04-14T07:52:00Z", customer_name: "Walmart",
  },
  {
    id: "exc-014", tenant_id: "acme-corp", order_id: "SO-12300", event_type: "PALLET_CONFIG_VIOLATION", intent: "PALLET_CONFIG", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "PalletAlignmentRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-14T11:20:00Z", updated_at: "2026-04-14T11:28:00Z", customer_name: "Kroger",
  },
];

const MOCK_HEALTH: HealthResponse = {
  status: "ok",
  version: "0.3.2",
  kill_switch: false,
  explain_mode: false,
  allowed_intents: ["CONTRACTUAL_CORRECTION", "CREDIT_BLOCK", "MASS_PRICING_ERROR", "DUPLICATE_PO", "BACK_ORDER", "OVER_MAX", "MIN_ORDER_QTY", "PALLET_CONFIG"],
  lifecycle_states: [
    "INGESTED", "CLASSIFYING", "AUDITING", "PENDING_REVIEW",
    "ESCALATED", "PENDING_ADMIN_REVIEW", "EXECUTING", "RESOLVED",
    "FAILED", "BLOCKED", "REJECTED", "CLOSED",
  ],
  allowed_recipes: ["PriceAdjustmentRecipe.py", "CreditHoldReleaseRecipe.py", "DuplicatePORecipe.py", "BackOrderResolutionRecipe.py", "OverMaxTrimRecipe.py", "MOQRoundUpRecipe.py", "PalletAlignmentRecipe.py"],
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

  async challenge(id: string, request: ChallengeRequest): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    return {
      ...exc,
      lifecycle_state: "ESCALATED",
      resolution_data: {},
      resolved_by: undefined,
      resolved_action: undefined,
      resolution_notes: `CHALLENGED: ${request.challenge_reason}`,
    };
  },

  async adminRelease(id: string, request: AdminReleaseRequest): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    return {
      ...exc,
      lifecycle_state: "PENDING_ADMIN_REVIEW",
      resolution_data: {},
      resolved_by: undefined,
      resolved_action: undefined,
      resolution_notes: `ADMIN_RELEASE: ${request.release_reason}`,
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
        DUPLICATE_PO: 3,
        CREDIT_BLOCK: 2,
        MASS_PRICING_ERROR: 1,
      },
      by_lifecycle_state: {
        RESOLVED: 3,
        PENDING_REVIEW: 2,
        BLOCKED: 1,
        EXECUTING: 1,
        ESCALATED: 1,
        CLOSED: 1,
      },
      by_shadow_verdict: {
        GREEN: 5,
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

/* ── Personas API ─────────────────────────────────────────────────── */

const MOCK_PERSONAS: Persona[] = [
  {
    id: "marcus-webb",
    name: "Marcus Webb",
    title: "Admin",
    email: "marcus.webb@acme-corp.com",
    role: "admin",
    avatar_initials: "MW",
    permissions: {
      can_run_agents: true, can_run_all: true, can_edit_rules: true, can_edit_autonomy: true,
      can_view_billing: true, can_configure_personas: true, can_upload_data: true, can_export_audit: true,
    },
    tabs: ["inbox", "exceptions", "quota", "dashboard", "performance", "settings"],
    customer_scope: "all",
    assigned_customers: [],
  },
  {
    id: "sarah-chen-manager",
    name: "Sarah Chen",
    title: "CS Manager",
    email: "sarah.chen@acme-corp.com",
    role: "manager",
    avatar_initials: "SC",
    permissions: {
      can_run_agents: true, can_run_all: true, can_edit_rules: true, can_edit_autonomy: true,
      can_view_billing: false, can_configure_personas: false, can_upload_data: false, can_export_audit: true,
    },
    tabs: ["inbox", "exceptions", "quota", "dashboard", "performance", "settings"],
    customer_scope: "all",
    assigned_customers: [],
  },
  {
    id: "sarah-chen-analyst",
    name: "Sarah Chen",
    title: "Sr. CS Analyst",
    email: "sarah.chen.sr@acme-corp.com",
    role: "analyst",
    avatar_initials: "SC",
    permissions: {
      can_run_agents: true, can_run_all: true, can_edit_rules: false, can_edit_autonomy: false,
      can_view_billing: false, can_configure_personas: false, can_upload_data: false, can_export_audit: true,
    },
    tabs: ["inbox", "exceptions", "quota", "dashboard"],
    customer_scope: "all",
    assigned_customers: [],
  },
  {
    id: "james-ortiz",
    name: "James Ortiz",
    title: "CS Analyst",
    email: "james.ortiz@acme-corp.com",
    role: "analyst",
    avatar_initials: "JO",
    permissions: {
      can_run_agents: true, can_run_all: false, can_edit_rules: false, can_edit_autonomy: false,
      can_view_billing: false, can_configure_personas: false, can_upload_data: false, can_export_audit: false,
    },
    tabs: ["inbox", "exceptions"],
    customer_scope: "assigned",
    assigned_customers: ["Walmart", "Kroger"],
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    title: "Trade Analyst",
    email: "priya.nair@acme-corp.com",
    role: "analyst",
    avatar_initials: "PN",
    permissions: {
      can_run_agents: true, can_run_all: false, can_edit_rules: false, can_edit_autonomy: false,
      can_view_billing: false, can_configure_personas: false, can_upload_data: false, can_export_audit: true,
    },
    tabs: ["exceptions", "quota", "dashboard"],
    customer_scope: "assigned",
    assigned_customers: ["Target", "Costco"],
  },
];

export const personasApi = {
  async list(): Promise<PersonaListResponse> {
    await delay(MOCK_DELAY);
    return { data: MOCK_PERSONAS };
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
  "exc-009": [
    { line_id: "L1", sku: "SKU-4410", description: "Sports Water 24pk", uom: "CS", quantity: 60, erp_price: 8.40, po_price: 8.40 },
  ],
  "exc-010": [
    { line_id: "L1", sku: "SKU-6100", description: "Premium Lager 12pk", uom: "CS", quantity: 800, erp_price: 18.50, po_price: 18.50 },
    { line_id: "L2", sku: "SKU-6105", description: "Light Lager 12pk", uom: "CS", quantity: 400, erp_price: 16.20, po_price: 16.20 },
  ],
  "exc-011": [
    { line_id: "L1", sku: "SKU-6200", description: "Craft IPA 6pk", uom: "CS", quantity: 200, erp_price: 22.00, po_price: 22.00 },
  ],
  "exc-012": [
    { line_id: "L1", sku: "SKU-9010", description: "Sparkling Mineral 12pk", uom: "CS", quantity: 1200, erp_price: 11.50, po_price: 11.50 },
    { line_id: "L2", sku: "SKU-9015", description: "Still Mineral 12pk", uom: "CS", quantity: 800, erp_price: 9.80, po_price: 9.80 },
    { line_id: "L3", sku: "SKU-9020", description: "Flavored Water 24pk", uom: "CS", quantity: 600, erp_price: 14.20, po_price: 14.20 },
  ],
  "exc-013": [
    { line_id: "L1", sku: "SKU-7800", description: "Organic Kombucha 6pk", uom: "CS", quantity: 40, erp_price: 28.50, po_price: 28.50 },
    { line_id: "L2", sku: "SKU-7810", description: "Ginger Kombucha 6pk", uom: "CS", quantity: 25, erp_price: 26.00, po_price: 26.00 },
  ],
  "exc-014": [
    { line_id: "L1", sku: "SKU-3500", description: "Premium Coffee 12oz 24pk", uom: "CS", quantity: 170, erp_price: 36.00, po_price: 36.00 },
    { line_id: "L2", sku: "SKU-3510", description: "Decaf Coffee 12oz 24pk", uom: "CS", quantity: 85, erp_price: 34.50, po_price: 34.50 },
    { line_id: "L3", sku: "SKU-3520", description: "Cold Brew 10oz 12pk", uom: "CS", quantity: 50, erp_price: 42.00, po_price: 42.00 },
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
    price_analysis: {
      erp_unit_price: 14.88,
      po_unit_price: 13.20,
      variance_amount: 1.68,
      variance_pct: 11.3,
      total_at_risk: 1218.24,
      total_quantity: 456,
      uom: "CS",
      doc_type: "Sales Order",
      doc_number: "SO-1001",
      sku: "SKU-0042",
      material_desc: "12-pk Cola",
      order_date: "2026-04-11T08:12:00Z",
      rule_id: "SO-PRICE-002",
      root_cause_category: "PROMO_EXPIRED",
      contract_ref: "4600012840",
      promotion_ref: "ZPROM/155 (expired 12/31/2025)",
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
  /* ── DUPLICATE_PO exception (YELLOW — needs approval) ────────────── */
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
    duplicate_detection: {
      original_order: {
        so_number: "SO-1040",
        po_number: "PO-88419",
        created_date: "2026-04-09T21:00:00Z",
        total_value: 6720.00,
        line_count: 2,
        status: "In Fulfillment",
      },
      duplicate_order: {
        so_number: "SO-1042",
        po_number: "PO-88421",
        created_date: "2026-04-11T09:00:00Z",
        total_value: 6720.00,
        line_count: 2,
        status: "Pending",
      },
      detection_method: "Same customer + identical SKUs + identical quantities within 48-hour window",
      days_between: 1.5,
      confidence: 88,
      recommended_action: "Block duplicate SO-1042 and notify buyer QuickMart for confirmation",
      cancellation_target: "SO-1042",
      autonomy_applied: "L2 — Review required, value $6,720 exceeds auto-block threshold ($1,000)",
    },
    order_comparison: {
      orders: [
        {
          so_number: "SO-1040",
          po_number: "PO-88419",
          created_date: "2026-04-09T21:00:00Z",
          customer: "QuickMart Distribution",
          lines: [
            { sku: "SKU-1180", description: "24-pk Water", qty: 500, unit_price: 9.60 },
            { sku: "SKU-1181", description: "12-pk Sparkling", qty: 200, unit_price: 11.40 },
          ],
          total_value: 7080.00,
          status: "In Fulfillment",
        },
        {
          so_number: "SO-1042",
          po_number: "PO-88421",
          created_date: "2026-04-11T09:00:00Z",
          customer: "QuickMart Distribution",
          lines: [
            { sku: "SKU-1180", description: "24-pk Water", qty: 500, unit_price: 9.62 },
            { sku: "SKU-1181", description: "12-pk Sparkling", qty: 200, unit_price: 10.00 },
          ],
          total_value: 6810.00,
          status: "Pending",
        },
      ],
      matching_fields: ["customer_id", "ship_to_address", "sku_list", "quantities"],
      differing_fields: ["po_number", "unit_prices"],
    },
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
    price_analysis: {
      erp_unit_price: 42.00,
      po_unit_price: 36.00,
      variance_amount: 6.00,
      variance_pct: 14.3,
      total_at_risk: 14940.00,
      total_quantity: 270,
      uom: "CS",
      doc_type: "Sales Order",
      doc_number: "SO-3100",
      sku: "SKU-5521",
      material_desc: "Family Pack x6",
      order_date: "2026-04-11T11:00:00Z",
      rule_id: "SO-PRICE-002",
      root_cause_category: "UOM_ERROR",
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
  /* ── DUPLICATE_PO: Escalated (ambiguous duplicate) ────────────────── */
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
    duplicate_detection: {
      original_order: {
        so_number: "SO-5008",
        po_number: "PO-91203",
        created_date: "2026-04-07T14:30:00Z",
        total_value: 7876.80,
        line_count: 2,
        status: "Shipped",
      },
      duplicate_order: {
        so_number: "SO-5010",
        po_number: "PO-91210",
        created_date: "2026-04-09T16:45:00Z",
        total_value: 8092.80,
        line_count: 2,
        status: "Pending Review",
      },
      detection_method: "Same customer + overlapping SKUs within 72-hour window. Quantities differ by 15%.",
      days_between: 2.1,
      confidence: 72,
      recommended_action: "Request buyer confirmation — quantities differ, may be legitimate reorder",
      cancellation_target: "SO-5010",
      autonomy_applied: "L3 — Buyer confirmation required, ambiguous duplicate with 72% confidence",
    },
    order_comparison: {
      orders: [
        {
          so_number: "SO-5008",
          po_number: "PO-91203",
          created_date: "2026-04-07T14:30:00Z",
          customer: "PowerDrink Distributors",
          lines: [
            { sku: "SKU-7701", description: "Energy Drink 4pk", qty: 410, unit_price: 8.96 },
            { sku: "SKU-7705", description: "Energy Drink 8pk", qty: 200, unit_price: 17.50 },
          ],
          total_value: 7173.60,
          status: "Shipped",
        },
        {
          so_number: "SO-5010",
          po_number: "PO-91210",
          created_date: "2026-04-09T16:45:00Z",
          customer: "PowerDrink Distributors",
          lines: [
            { sku: "SKU-7701", description: "Energy Drink 4pk", qty: 480, unit_price: 8.50 },
            { sku: "SKU-7705", description: "Energy Drink 8pk", qty: 240, unit_price: 16.00 },
          ],
          total_value: 7920.00,
          status: "Pending Review",
        },
      ],
      matching_fields: ["customer_id", "sku_list", "ship_to_address"],
      differing_fields: ["quantities", "unit_prices", "po_number", "total_value"],
    },
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
  /* ── DUPLICATE_PO: Auto-resolved (GREEN) ────────────────────────── */
  "exc-009": {
    diagnosis: "PO #PO-55102 is an exact retransmission of PO #PO-55100 received 4 hours prior. Identical customer, SKU, quantity, and ship-to. Low-value order ($504) auto-blocked per L1 autonomy policy.",
    confidence: 98,
    risk: "LOW",
    resolution: "BLOCK_AND_NOTIFY",
    root_cause: "EDI retransmission — identical PO received within 4 hours. Single line item, exact match on all fields.",
    recommendation: "No action required — auto-resolved. Duplicate blocked and buyer notification sent.",
    entity_profile: {
      customer_name: "CornerShop Express",
      bp_number: "BP-330210",
      customer_tier: "Standard",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 2500 — Houston DC",
      region: "South",
    },
    impact_metrics: {
      revenue_at_risk: 504.00,
      delta_amount: 0,
      delta_percentage: 0,
      sla_priority: "LOW",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Exact duplicate of PO-55100/L1. Same SKU, qty, price, ship-to.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "LOW",
        waterfall: [],
      },
    ],
    duplicate_detection: {
      original_order: {
        so_number: "SO-8098",
        po_number: "PO-55100",
        created_date: "2026-04-11T02:15:00Z",
        total_value: 504.00,
        line_count: 1,
        status: "In Fulfillment",
      },
      duplicate_order: {
        so_number: "SO-8100",
        po_number: "PO-55102",
        created_date: "2026-04-11T06:20:00Z",
        total_value: 504.00,
        line_count: 1,
        status: "Blocked",
      },
      detection_method: "Exact match — same customer, SKU, quantity, price, and ship-to within 24-hour window",
      days_between: 0.17,
      confidence: 98,
      recommended_action: "Auto-blocked duplicate SO-8100. Buyer notification sent.",
      cancellation_target: "SO-8100",
      autonomy_applied: "L1 — Auto-block, value $504 below auto-block threshold ($1,000)",
    },
    order_comparison: {
      orders: [
        {
          so_number: "SO-8098",
          po_number: "PO-55100",
          created_date: "2026-04-11T02:15:00Z",
          customer: "CornerShop Express",
          lines: [
            { sku: "SKU-4410", description: "Sports Water 24pk", qty: 60, unit_price: 8.40 },
          ],
          total_value: 504.00,
          status: "In Fulfillment",
        },
        {
          so_number: "SO-8100",
          po_number: "PO-55102",
          created_date: "2026-04-11T06:20:00Z",
          customer: "CornerShop Express",
          lines: [
            { sku: "SKU-4410", description: "Sports Water 24pk", qty: 60, unit_price: 8.40 },
          ],
          total_value: 504.00,
          status: "Blocked",
        },
      ],
      matching_fields: ["customer_id", "sku_list", "quantities", "unit_prices", "ship_to_address"],
      differing_fields: ["po_number"],
    },
  },
  /* ── BACK_ORDER: Pending Review (YELLOW) ───────────────────────────── */
  "exc-010": {
    diagnosis: "Customer ordered 800 CS of Premium Lager but only 480 CS available at primary DC. Gap of 320 CS (40%). Alternate DC in Denver has 200 CS with 3-day transit. Production order for 500 CS due in 8 days.",
    confidence: 84,
    risk: "HIGH",
    resolution: "SPLIT_SHIPMENT",
    root_cause: "Seasonal demand spike exceeded ATP forecast. Primary DC depleted below safety stock.",
    recommendation: "Split shipment: ship 480 CS from Atlanta DC now, source 200 CS from Denver DC (3-day transit, +$0.45/CS freight), backorder remaining 120 CS against production order.",
    entity_profile: {
      customer_name: "BevWorld Distributors",
      bp_number: "BP-750320",
      customer_tier: "Platinum",
      vip_status: true,
      credit_standing: "Good",
      location: "Plant 4100 — Atlanta DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 21280.00,
      delta_amount: 5920.00,
      delta_percentage: 27.8,
      fulfillment_gap_pct: 40.0,
      sla_priority: "CRITICAL",
      sla_deadline: "2026-04-13T18:00:00Z",
      affected_lines: 2,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Premium Lager: 800 CS ordered, 480 CS available. 40% gap. Split shipment recommended.",
        resolution: "SPLIT_SHIPMENT",
        risk: "HIGH",
        waterfall: [],
      },
      {
        line_id: "L2",
        diagnosis: "Light Lager: 400 CS ordered, 400 CS available. Fully available — no gap.",
        resolution: "FULFILL",
        risk: "LOW",
        waterfall: [],
      },
    ],
    backorder_analysis: {
      ordered_qty: 800,
      available_qty: 480,
      gap_qty: 320,
      gap_pct: 40.0,
      unit_price: 18.50,
      uom: "CS",
      at_risk: 5920.00,
      atp_date: "2026-04-20T00:00:00Z",
      primary_dc: {
        plant: "4100",
        name: "Atlanta Regional DC",
        region: "Southeast",
        qty: 480,
      },
      alternate_warehouses: [
        { plant: "6500", name: "Denver National DC", region: "Mountain", qty: 200, eta_days: 3, freight_delta_per_unit: 0.45, freight_delta_total: 90.00 },
        { plant: "7800", name: "LA Distribution Hub", region: "West", qty: 150, eta_days: 5, freight_delta_per_unit: 0.82, freight_delta_total: 123.00 },
        { plant: "1500", name: "NYC Metro DC", region: "Northeast", qty: 80, eta_days: 4, freight_delta_per_unit: 0.65, freight_delta_total: 52.00 },
      ],
      substitutes: [
        { sku: "SKU-6110", description: "Premium Lager 24pk", available_qty: 300, price_delta_pct: 8.5, acceptance_rate: 0.72, source: "Same brewery", priority: 1 },
        { sku: "SKU-6120", description: "Craft Lager 12pk", available_qty: 600, price_delta_pct: -5.2, acceptance_rate: 0.45, source: "Alternate brand", priority: 2 },
      ],
      production: { qty: 500, date: "2026-04-20T00:00:00Z" },
      inbound_po: { qty: 300, eta: "2026-04-18T00:00:00Z", po_num: "PO-99210" },
      resolution_options: [
        {
          id: "opt-1",
          type: "SPLIT_SHIPMENT",
          title: "Split Shipment (Atlanta + Denver)",
          description: "Ship 480 CS from Atlanta DC immediately. Source 200 CS from Denver DC (3-day transit, +$0.45/CS). Backorder 120 CS against production due Apr 20.",
          composite_score: 0.87,
          scores: { service: 0.82, revenue: 0.90, logistics: 0.85, preference: 0.91 },
          sap_steps: ["VA02 (split delivery)", "VL01N (create 2nd delivery)", "ME21N (interplant transfer)"],
          recommended: true,
        },
        {
          id: "opt-2",
          type: "FUTURE_DELIVERY",
          title: "Full Order — Future Delivery",
          description: "Hold entire order for production completion (Apr 20). Ship full 800 CS from Atlanta. Customer SLA risk: 8-day delay.",
          composite_score: 0.68,
          scores: { service: 0.45, revenue: 0.95, logistics: 0.92, preference: 0.40 },
          sap_steps: ["VA02 (change delivery date)", "ZPROD (reserve production)"],
          recommended: false,
        },
        {
          id: "opt-3",
          type: "SUBSTITUTE_SKU",
          title: "Substitute with Premium Lager 24pk",
          description: "Offer SKU-6110 (24pk) as substitute for 300 CS. 72% historical acceptance rate. 8.5% price premium requires approval.",
          composite_score: 0.61,
          scores: { service: 0.70, revenue: 0.55, logistics: 0.90, preference: 0.30 },
          sap_steps: ["VA02 (line substitution)", "VK11 (price adjustment)", "ZPROM (promo check)"],
          recommended: false,
        },
        {
          id: "opt-4",
          type: "ALT_DC",
          title: "Fulfill from LA Hub",
          description: "Source full 800 CS from LA Distribution Hub. All stock available but 5-day transit and +$0.82/CS freight increases cost by $656.",
          composite_score: 0.52,
          scores: { service: 0.60, revenue: 0.40, logistics: 0.35, preference: 0.72 },
          sap_steps: ["VL01N (delivery from 7800)", "ME21N (interplant)", "VA02 (reassign)"],
          recommended: false,
        },
      ],
    },
  },
  /* ── BACK_ORDER: Auto-resolved (GREEN) ─────────────────────────────── */
  "exc-011": {
    diagnosis: "Customer ordered 200 CS of Craft IPA. Only 140 CS available at primary DC. Alternate DC in Chicago has 120 CS with 2-day transit. Auto-resolved via split shipment.",
    confidence: 94,
    risk: "LOW",
    resolution: "SPLIT_SHIPMENT",
    root_cause: "Routine stock depletion — replenishment order in transit covers gap.",
    recommendation: "No action required — auto-resolved. Split shipment executed: 140 CS from Portland, 60 CS from Chicago.",
    entity_profile: {
      customer_name: "Hop City Brewing Supply",
      bp_number: "BP-220145",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 3200 — Portland DC",
      region: "Pacific Northwest",
    },
    impact_metrics: {
      revenue_at_risk: 4400.00,
      delta_amount: 1320.00,
      delta_percentage: 30.0,
      fulfillment_gap_pct: 30.0,
      sla_priority: "MEDIUM",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Craft IPA: 200 CS ordered, 140 CS at primary DC. Split shipment auto-executed.",
        resolution: "SPLIT_SHIPMENT",
        risk: "LOW",
        waterfall: [],
      },
    ],
    backorder_analysis: {
      ordered_qty: 200,
      available_qty: 140,
      gap_qty: 60,
      gap_pct: 30.0,
      unit_price: 22.00,
      uom: "CS",
      at_risk: 1320.00,
      atp_date: "2026-04-15T00:00:00Z",
      primary_dc: {
        plant: "3200",
        name: "Portland DC",
        region: "Pacific Northwest",
        qty: 140,
      },
      alternate_warehouses: [
        { plant: "3400", name: "Chicago Central DC", region: "Midwest", qty: 120, eta_days: 2, freight_delta_per_unit: 0.35, freight_delta_total: 21.00 },
      ],
      substitutes: [],
      production: { qty: 400, date: "2026-04-17T00:00:00Z" },
      inbound_po: null,
      resolution_options: [
        {
          id: "opt-1",
          type: "SPLIT_SHIPMENT",
          title: "Split Shipment (Portland + Chicago)",
          description: "Ship 140 CS from Portland DC, 60 CS from Chicago DC (2-day transit, +$0.35/CS).",
          composite_score: 0.92,
          scores: { service: 0.90, revenue: 0.88, logistics: 0.95, preference: 0.95 },
          sap_steps: ["VA02 (split delivery)", "VL01N (create 2nd delivery)"],
          recommended: true,
        },
      ],
    },
  },
  /* ── OVER_MAX: Pending Review (YELLOW) ─────────────────────────────── */
  "exc-012": {
    diagnosis: "Total order quantity (2,600 CS) exceeds contract maximum (2,000 CS) by 600 CS (30%). Three line items, two exceeding per-line maximums. SAP block V4080 applied.",
    confidence: 91,
    risk: "MEDIUM",
    resolution: "TRIM",
    root_cause: "Customer placed order 30% above contract max. SKU-9010 and SKU-9020 individually exceed line-level maximums.",
    recommendation: "Apply AI trim plan to reduce order to contract maximum. Two lines need trimming; one is within limit.",
    entity_profile: {
      customer_name: "AquaPure Distribution",
      bp_number: "BP-880460",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 4100 — Atlanta DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 30020.00,
      delta_amount: 8660.00,
      delta_percentage: 28.8,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-14T12:00:00Z",
      affected_lines: 3,
    },
    lines: [
      { line_id: "L1", diagnosis: "1,200 CS ordered, max 900 CS. Excess 300 CS. Trim recommended.", resolution: "TRIM", risk: "MEDIUM", waterfall: [] },
      { line_id: "L2", diagnosis: "800 CS ordered, within max 800 CS. No action needed.", resolution: "OK", risk: "LOW", waterfall: [] },
      { line_id: "L3", diagnosis: "600 CS ordered, max 300 CS. Excess 300 CS. Even-layer item — trim to 288 CS (full layers).", resolution: "TRIM", risk: "MEDIUM", waterfall: [] },
    ],
    overmax_analysis: {
      total_ordered: 2600,
      max_qty: 2000,
      excess_qty: 600,
      exceedance_pct: 30.0,
      uom: "CS",
      at_risk: 8660.00,
      contract_ref: "CTR-4600018820",
      block_status: "V4080",
      block_reason: "Order quantity exceeds contract maximum — automatic block per SD-OM-001",
      order_lines: [
        { sku: "SKU-9010", description: "Sparkling Mineral 12pk", qty: 1200, max_line_qty: 900, excess: 300, is_even_layer_item: false },
        { sku: "SKU-9015", description: "Still Mineral 12pk", qty: 800, max_line_qty: 800, excess: 0, is_even_layer_item: false },
        { sku: "SKU-9020", description: "Flavored Water 24pk", qty: 600, max_line_qty: 300, excess: 300, is_even_layer_item: true },
      ],
      trim_plan: [
        { sku: "SKU-9010", description: "Sparkling Mineral 12pk", ordered: 1200, trimmed_to: 900, delta: 300, action: "TRIM" },
        { sku: "SKU-9015", description: "Still Mineral 12pk", ordered: 800, trimmed_to: 800, delta: 0, action: "OK" },
        { sku: "SKU-9020", description: "Flavored Water 24pk", ordered: 600, trimmed_to: 288, delta: 312, action: "TRIM" },
      ],
    },
  },
  /* ── MIN_ORDER_QTY: Pending Review (YELLOW) ────────────────────────── */
  "exc-013": {
    diagnosis: "Order for 65 CS total (2 SKUs) is below the minimum order quantity of 100 CS for this distribution channel. SAP V4082 block applied. Two lines: one can be rounded up to MOQ, one needs escalation due to KNMT waiver requirement.",
    confidence: 89,
    risk: "MEDIUM",
    resolution: "ROUND_UP",
    root_cause: "Order quantity 35% below channel MOQ. MOQ set via KNMT-MINBM for Direct Store Delivery channel.",
    recommendation: "Round up SKU-7800 from 40 to 72 CS (full pallet layer). Escalate SKU-7810 for KNMT waiver — below individual MOQ of 48 CS.",
    entity_profile: {
      customer_name: "Fermented Foods Co",
      bp_number: "BP-990215",
      customer_tier: "Silver",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 2100 — Miami DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 1790.00,
      delta_amount: 625.00,
      delta_percentage: 34.9,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-15T12:00:00Z",
      affected_lines: 2,
    },
    lines: [
      { line_id: "L1", diagnosis: "40 CS ordered, MOQ 48 CS. Shortfall 8 CS. Round up to 72 CS (full layer = 24 CS/layer × 3).", resolution: "ROUND_UP", risk: "LOW", waterfall: [] },
      { line_id: "L2", diagnosis: "25 CS ordered, MOQ 48 CS. Shortfall 23 CS. Below 50% of MOQ — requires KNMT waiver.", resolution: "ESCALATE", risk: "MEDIUM", waterfall: [] },
    ],
    moq_analysis: {
      ordered_qty: 65,
      moq_qty: 100,
      shortfall_qty: 35,
      shortfall_pct: 35.0,
      sku: "SKU-7800",
      description: "Organic Kombucha 6pk",
      unit_cost: 28.50,
      uom: "CS",
      at_risk: 1790.00,
      moq_source: "KNMT-MINBM",
      channel: "Direct Store Delivery",
      block_message: "Order quantity 65 CS is below minimum order quantity 100 CS for DSD channel. Block V4082 applied per SD-MOQ-001.",
      contract_ref: "CTR-4600022150",
      block_status: "V4082",
      round_up_plan: [
        { sku: "SKU-7800", description: "Organic Kombucha 6pk", ordered: 40, round_up_to: 72, delta: 32, action: "ROUND_UP" },
        { sku: "SKU-7810", description: "Ginger Kombucha 6pk", ordered: 25, round_up_to: 25, delta: 0, action: "ESCALATE" },
      ],
      sap_steps: [
        { step: 1, transaction: "VA02", table: "VBAP", field: "KWMENG", description: "Update order quantity for SKU-7800 from 40 to 72 CS" },
        { step: 2, transaction: "VK11", table: "KONV", field: "KBETR", description: "Apply MOQ round-up pricing adjustment (volume discount tier)" },
        { step: 3, transaction: "V.23", table: "VBAK", field: "LIFSK", description: "Release V4082 delivery block after quantity adjustment" },
        { step: 4, transaction: "VA02", table: "VBAP", field: "ABGRU", description: "Set rejection reason on SKU-7810 pending KNMT waiver approval" },
      ],
    },
  },
  /* ── PALLET_CONFIG: Pending Review (YELLOW) ────────────────────────── */
  "exc-014": {
    diagnosis: "Order has 3 SKUs with pallet alignment violations. 2 broken layers and 1 partial pallet. Total 37 loose cases requiring manual handling — estimated 1.5 extra labor hours and 8.2% freight waste.",
    confidence: 93,
    risk: "MEDIUM",
    resolution: "PALLET_ALIGN",
    root_cause: "Ordered quantities do not align to full pallet layers. Broken layers on SKU-3500 and SKU-3520; partial pallet on SKU-3510.",
    recommendation: "Apply AI suggested plan: round SKU-3500 from 170 to 168 (7 full layers), round SKU-3510 from 85 to 84 (6 full layers), round SKU-3520 from 50 to 48 (4 full layers).",
    entity_profile: {
      customer_name: "CafeBrew Supply Co",
      bp_number: "BP-410830",
      customer_tier: "Gold",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 3400 — Chicago DC",
      region: "Midwest",
    },
    impact_metrics: {
      revenue_at_risk: 11162.50,
      delta_amount: 267.00,
      delta_percentage: 2.4,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-15T16:00:00Z",
      affected_lines: 3,
    },
    lines: [
      { line_id: "L1", diagnosis: "170 CS ordered, layer qty 24. 7 full layers = 168, 2 loose. Broken layer.", resolution: "ROUND_DOWN", risk: "LOW", waterfall: [] },
      { line_id: "L2", diagnosis: "85 CS ordered, layer qty 14. 6 full layers = 84, 1 loose. Broken layer.", resolution: "ROUND_DOWN", risk: "LOW", waterfall: [] },
      { line_id: "L3", diagnosis: "50 CS ordered, layer qty 12. 4 full layers = 48, 2 loose. Partial pallet.", resolution: "ROUND_DOWN", risk: "LOW", waterfall: [] },
    ],
    pallet_analysis: {
      total_ordered_cases: 305,
      loose_cases_total: 37,
      at_risk_total: 1301.50,
      extra_labor_est_hrs: 1.5,
      freight_waste_pct: 8.2,
      order_line_count: 3,
      lines: [
        {
          sku: "SKU-3500", description: "Premium Coffee 12oz 24pk", uom: "CS",
          layer_qty: 24, pallet_qty: 168, ordered_qty: 170, complete_layers: 7,
          loose_qty: 2, full_pallets: 1, pallet_fill_pct: 101.2, violation_type: "Broken Layer",
        },
        {
          sku: "SKU-3510", description: "Decaf Coffee 12oz 24pk", uom: "CS",
          layer_qty: 14, pallet_qty: 84, ordered_qty: 85, complete_layers: 6,
          loose_qty: 1, full_pallets: 1, pallet_fill_pct: 101.2, violation_type: "Broken Layer",
        },
        {
          sku: "SKU-3520", description: "Cold Brew 10oz 12pk", uom: "CS",
          layer_qty: 12, pallet_qty: 48, ordered_qty: 50, complete_layers: 4,
          loose_qty: 2, full_pallets: 1, pallet_fill_pct: 104.2, violation_type: "Partial Pallet",
        },
      ],
      suggested_plan: [
        { sku: "SKU-3500", description: "Premium Coffee 24pk", current: 170, suggested: 168, delta: -2, layers: 7, full_pallets: 1, reason: "Round down to full layers (24 CS/layer × 7)" },
        { sku: "SKU-3510", description: "Decaf Coffee 24pk", current: 85, suggested: 84, delta: -1, layers: 6, full_pallets: 1, reason: "Round down to full layers (14 CS/layer × 6)" },
        { sku: "SKU-3520", description: "Cold Brew 12pk", current: 50, suggested: 48, delta: -2, layers: 4, full_pallets: 1, reason: "Round down to full layers (12 CS/layer × 4)" },
      ],
    },
  },
};
