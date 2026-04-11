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
  StatsResponse,
  TraceResponse,
  APIError,
} from "@/types/api";
import type { HealthResponse, ExceptionSummary } from "@/types/exceptions";
import { ROLE_PERMISSIONS } from "./roles";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MOCK_DELAY = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── Mock data ─────────────────────────────────────────────────────── */

const MOCK_USER: AuthUser = {
  id: "usr_001",
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

  async approve(id: string): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    return {
      ...exc,
      lifecycle_state: "EXECUTING",
      resolution_data: {},
    };
  },

  async reject(id: string): Promise<ExceptionDetailResponse> {
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
};
