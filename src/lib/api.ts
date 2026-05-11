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
  EscalateRequest,
  CosignRequest,
  RequestOptions,
  DispositionRequest,
  ChallengeRequest,
  ReanalyzeRequest,
  AdminReleaseRequest,
  StatsResponse,
  TraceResponse,
  WorkflowRequest,
  WorkflowResult,
  PolicyOverrideRequest,
  PolicyOverrideResponse,
  PipelineTopology,
} from "@/types/api";
import type { HealthResponse, ExceptionSummary, LifecycleState, LineItem, OrderAnalysis, ReanalysisEntry } from "@/types/exceptions";
import {
  ALLOWED_OVERRIDE_REASON_TAGS,
  ALLOWED_OVERRIDE_REASON_TAGS_BY_INTENT,
} from "./__generated__/curated_reason_tags";
import { ROLE_PERMISSIONS } from "./roles";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MOCK_DELAY = 400;

/**
 * Phase 4 live-backend switch. When `NEXT_PUBLIC_USE_REAL_API === "1"`,
 * the client methods marked below (`authApi.login`, `healthApi.get`, and
 * the Playwright-critical `exceptionsApi.*` methods) hit the FastAPI
 * backend over HTTP instead of returning mock data. The mock path is
 * preserved for local dev + vitest runs; only explicit opt-in flips to
 * real-backend mode.
 *
 * Not every method has been migrated yet — mock remains the default for
 * `lineItems`, `orderAnalysis`, `workflows`, `policy`, etc. The migration
 * is demand-driven: we convert a method when a browser test needs it.
 */
const USE_REAL_API = process.env.NEXT_PUBLIC_USE_REAL_API === "1";

/**
 * Read the NextAuth session's `accessToken` for outgoing authenticated
 * calls. Deliberately NOT cached — on the initial render of the first
 * authenticated page, two near-simultaneous callers can race against a
 * cached-promise pattern (one fires before the promise resolves, one
 * after). `getSession()` is cheap (cookie read + route handler fetch
 * to /api/auth/session) and is memoized by next-auth/react internally
 * under the hood, so per-call invocation stays fast.
 */
async function getAuthToken(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  try {
    const { getSession } = await import("next-auth/react");
    const s = await getSession();
    return (s as unknown as { accessToken?: string } | null)?.accessToken;
  } catch {
    return undefined;
  }
}

/**
 * Read the *currently logged-in* user's email for mock-mode attribution
 * on writes (reanalyze, disposition, escalate, etc.).
 *
 * Why this is needed: `_currentMockUser` is module-level state set in
 * `authApi.login()` — but `authApi.login()` runs server-side via
 * NextAuth's credentials provider. The browser bundle has its own
 * module instance where `_currentMockUser` was never mutated, so it
 * still points at the hardcoded default (marcus.webb). Falling back
 * to that default gave every UI-triggered write the wrong attribution.
 *
 * Fix: read from the NextAuth session client-side. Server-side / test
 * contexts (no `window`) fall back to the module-level state, which is
 * correctly set there.
 */
async function getCurrentMockUserEmail(): Promise<string | undefined> {
  if (typeof window === "undefined") {
    return _currentMockUser?.email;
  }
  try {
    const { getSession } = await import("next-auth/react");
    const s = await getSession();
    return s?.user?.email ?? _currentMockUser?.email;
  } catch {
    return _currentMockUser?.email;
  }
}

/**
 * Test-only escape hatch — Playwright fixtures set a pre-minted token
 * via `window.__asoeTestAccessToken` before driving the page, so the
 * api client can make authenticated calls without going through the
 * full NextAuth credentials flow.
 */
function getTestAccessToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __asoeTestAccessToken?: string }).__asoeTestAccessToken;
}

interface HttpOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  authToken?: string;
  query?: Record<string, string | number | undefined>;
}

/**
 * Thin fetch wrapper enforcing the asoe2 error envelope
 * `{ error: { code, message } }` and translating it into a thrown
 * Error whose `message` is `"<CODE>: <human message>"`. Idempotency-Key
 * is propagated when provided.
 */
async function http<T>(path: string, options: HttpOptions = {}): Promise<T> {
  const qs = options.query
    ? "?" + new URLSearchParams(
        Object.entries(options.query)
          .filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";
  const url = `${API_URL}${path}${qs}`;
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = options.authToken ?? getTestAccessToken() ?? (await getAuthToken());
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { error: { code: `HTTP_${res.status}`, message: text || res.statusText } };
  }
  if (!res.ok) {
    const envelope = parsed as { error?: { code?: string; message?: string } };
    const code = envelope?.error?.code ?? `HTTP_${res.status}`;
    const message = envelope?.error?.message ?? res.statusText;
    throw new Error(`${code}: ${message}`);
  }
  return parsed as T;
}

/**
 * Mirrors asoe2/contracts/policy.py::HIGH_VALUE_OVERRIDE_THRESHOLD_USD.
 * Backend is authoritative; this constant is only used by the mock api so
 * mock-mode and real-backend behavior stay aligned. Kept next to the mock
 * implementation, not exported — the UI renders state it's given, it does
 * not compute the threshold itself.
 */
const HIGH_VALUE_OVERRIDE_THRESHOLD_USD = 10_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ── Idempotency-Key handling ──────────────────────────────────────
 *
 * Every mutating call generates a UUID v4 client-side unless the caller
 * supplies one — protects against double-clicks and network retries.
 * Matches the backend contract: same key within 24h returns the cached
 * response; same key + different body → 409.
 *
 * The mock implementation keeps a per-endpoint LRU of (key → response)
 * so tests exercising the mock see the same semantics as the real API.
 */

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Generates a client-side idempotency key (UUID v4). */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** Resolves the effective idempotency key for a mutating call. */
function resolveIdempotencyKey(options?: RequestOptions): string {
  if (options?.idempotencyKey) {
    if (!IDEMPOTENCY_KEY_PATTERN.test(options.idempotencyKey)) {
      throw new Error(
        "Invalid Idempotency-Key: must be 1-128 chars of [A-Za-z0-9_-].",
      );
    }
    return options.idempotencyKey;
  }
  return generateIdempotencyKey();
}

/** Per-endpoint idempotency cache: key → { bodyFingerprint, response } */
interface IdempotencyCacheEntry {
  bodyFingerprint: string;
  response: ExceptionDetailResponse;
}
const MOCK_IDEMPOTENCY: Record<string, Map<string, IdempotencyCacheEntry>> = {};

function idempotencyLookup(
  endpoint: string,
  key: string,
  body: unknown,
): ExceptionDetailResponse | null {
  const bucket = MOCK_IDEMPOTENCY[endpoint];
  if (!bucket) return null;
  const entry = bucket.get(key);
  if (!entry) return null;
  const fingerprint = JSON.stringify(body);
  if (entry.bodyFingerprint !== fingerprint) {
    // Matches the real backend: same key + different body → 409 Conflict.
    throw new Error(
      "Idempotency-Key conflict: same key was used with a different request body.",
    );
  }
  return entry.response;
}

function idempotencyStore(
  endpoint: string,
  key: string,
  body: unknown,
  response: ExceptionDetailResponse,
): void {
  const bucket = MOCK_IDEMPOTENCY[endpoint] ?? new Map();
  bucket.set(key, { bodyFingerprint: JSON.stringify(body), response });
  MOCK_IDEMPOTENCY[endpoint] = bucket;
}

/** Test-only helper — clears the mock idempotency cache. */
export function __resetMockIdempotencyCache(): void {
  for (const key of Object.keys(MOCK_IDEMPOTENCY)) {
    delete MOCK_IDEMPOTENCY[key];
  }
}

/* ── Mock data — 5 seed users matching asoe2/api/users.py ─────────── */

/** Tab visibility computed from permissions — mirrors api/users.py compute_visible_tabs.
 *  Issue #133 — added "home" (anyone who can read exceptions can see
 *  the operational landing surface) and retired "inbox" (the route
 *  is now a server redirect into /cases?source=manual_order). */
function computeVisibleTabs(permissions: string[]): string[] {
  const ps = new Set(permissions);
  const tabs: string[] = [];
  if (ps.has("exceptions:read")) { tabs.push("home", "exceptions", "cases"); }
  if (ps.has("dashboard:read")) { tabs.push("dashboard"); }
  if (ps.has("rules:write") || ps.has("policy:write") || ps.has("users:manage")) { tabs.push("settings"); }
  return tabs;
}

const MOCK_USERS: Record<string, AuthUser> = {
  "jane@acme.com": {
    id: "usr_jane_doe", sub: "usr_jane_doe",
    email: "jane@acme.com", name: "Jane Doe",
    title: "Admin", avatar_initials: "JD",
    roles: ["admin"], org: "acme-corp",
    permissions: ROLE_PERMISSIONS.admin,
    assigned_accounts: [],
    visible_tabs: computeVisibleTabs(ROLE_PERMISSIONS.admin),
  },
  "marcus.webb@acme-corp.com": {
    id: "usr_marcus_webb", sub: "usr_marcus_webb",
    email: "marcus.webb@acme-corp.com", name: "Marcus Webb",
    title: "Admin", avatar_initials: "MW",
    roles: ["admin"], org: "acme-corp",
    permissions: ROLE_PERMISSIONS.admin,
    assigned_accounts: [],
    visible_tabs: computeVisibleTabs(ROLE_PERMISSIONS.admin),
  },
  "sarah.chen@acme-corp.com": {
    id: "usr_sarah_chen_mgr", sub: "usr_sarah_chen_mgr",
    email: "sarah.chen@acme-corp.com", name: "Sarah Chen",
    title: "CS Manager", avatar_initials: "SC",
    roles: ["manager"], org: "acme-corp",
    permissions: ROLE_PERMISSIONS.manager,
    assigned_accounts: [],
    visible_tabs: computeVisibleTabs(ROLE_PERMISSIONS.manager),
  },
  "sarah.chen.sr@acme-corp.com": {
    id: "usr_sarah_chen_sr", sub: "usr_sarah_chen_sr",
    email: "sarah.chen.sr@acme-corp.com", name: "Sarah Chen",
    title: "Sr. CS Analyst", avatar_initials: "SC",
    roles: ["analyst"], org: "acme-corp",
    permissions: ROLE_PERMISSIONS.analyst,
    assigned_accounts: [],
    visible_tabs: computeVisibleTabs(ROLE_PERMISSIONS.analyst),
  },
  "james.ortiz@acme-corp.com": {
    id: "usr_james_ortiz", sub: "usr_james_ortiz",
    email: "james.ortiz@acme-corp.com", name: "James Ortiz",
    title: "CS Analyst", avatar_initials: "JO",
    roles: ["analyst"], org: "acme-corp",
    permissions: ROLE_PERMISSIONS.analyst,
    assigned_accounts: ["acct-walmart", "acct-kroger"],
    visible_tabs: computeVisibleTabs(ROLE_PERMISSIONS.analyst),
  },
  "priya.nair@acme-corp.com": {
    id: "usr_priya_nair", sub: "usr_priya_nair",
    email: "priya.nair@acme-corp.com", name: "Priya Nair",
    title: "Trade Analyst", avatar_initials: "PN",
    roles: ["analyst"], org: "acme-corp",
    permissions: ROLE_PERMISSIONS.analyst,
    assigned_accounts: ["acct-target", "acct-costco"],
    visible_tabs: computeVisibleTabs(ROLE_PERMISSIONS.analyst),
  },
  "tom.bradley@walmart.com": {
    id: "usr_tom_bradley", sub: "usr_tom_bradley",
    email: "tom.bradley@walmart.com", name: "Tom Bradley",
    title: "Walmart Buyer Rep", avatar_initials: "TB",
    roles: ["partner"], org: "acme-corp",
    permissions: ROLE_PERMISSIONS.partner,
    assigned_accounts: ["acct-walmart"],
    visible_tabs: computeVisibleTabs(ROLE_PERMISSIONS.partner),
  },
  "lisa.huang@kroger.com": {
    id: "usr_lisa_huang", sub: "usr_lisa_huang",
    email: "lisa.huang@kroger.com", name: "Lisa Huang",
    title: "Kroger Buyer Rep", avatar_initials: "LH",
    roles: ["partner"], org: "acme-corp",
    permissions: ROLE_PERMISSIONS.partner,
    assigned_accounts: ["acct-kroger"],
    visible_tabs: computeVisibleTabs(ROLE_PERMISSIONS.partner),
  },
};

/** Default user for backward compatibility */
const MOCK_USER = MOCK_USERS["marcus.webb@acme-corp.com"];

/** Tracks the currently logged-in mock user for account scoping. Set on login. */
let _currentMockUser: AuthUser = MOCK_USER;

/**
 * Per-exception reanalysis history, keyed by exception id. Mirrors the
 * backend ExceptionRecord.reanalysis_history column introduced by V002.
 * Module-level so the counter persists across repeated reanalyze calls
 * within a session — previously the mock returned a fresh length-1 array
 * each time, which is why the UI counter never advanced past 0/3.
 */
const MOCK_REANALYSIS_HISTORY: Record<string, ReanalysisEntry[]> = {};

/** Must match REANALYSIS_MAX_ATTEMPTS in asoe2/contracts/policy.py. */
const MOCK_REANALYSIS_MAX_ATTEMPTS = 3;

/**
 * Per-exception explicit financial impact for demo purposes. Mirrors the
 * backend's record.resolution_data.financial_impact_usd lookup. Any value
 * here at/above HIGH_VALUE_OVERRIDE_THRESHOLD_USD triggers the four-eyes
 * cosign flow on /override. Exceptions not listed here are treated as
 * "impact unknown" and the gate does not fire.
 */
const MOCK_FINANCIAL_IMPACT_USD: Record<string, number> = {
  // Demo seeds — pick a couple of price-correction exceptions for the
  // cosign flow demo; real records would carry this on resolution_data.
  "exc-001": 25_000,
  "exc-010": 42_500,
};

/**
 * Pending override staging area for the mock four-eyes flow. In production
 * this lives on the exception record's resolution_data.pending_override.
 * Here it's a module-level dict so cosign() can read what override() wrote
 * on the preceding call — MOCK_EXCEPTIONS itself isn't mutated.
 */
interface MockPendingOverride {
  action: string;
  notes: string;
  reason_tag: string;
  initiator: string;
  initiated_at: string;
  financial_impact_usd: number;
  from_lifecycle_state: LifecycleState;
}
const MOCK_PENDING_OVERRIDES: Record<string, MockPendingOverride> = {};

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
    created_at: "2026-04-24T08:12:00Z",
    updated_at: "2026-04-24T08:20:00Z",
    account_id: "acct-walmart", account_name: "Walmart",
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
    created_at: "2026-04-25T09:05:00Z",
    updated_at: "2026-04-25T09:13:00Z",
    account_id: "acct-kroger", account_name: "Kroger",
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
    created_at: "2026-04-19T10:30:00Z",
    updated_at: "2026-04-19T10:31:00Z",
    account_id: "acct-target", account_name: "Target",
  },
  {
    id: "exc-004",
    tenant_id: "acme-corp",
    order_id: "SO-3100",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: "MASS_PRICING_ERROR",
    // Was "EXECUTING" before asoe2 Phase 19 retired that state.
    // The disposition flow now resolves straight to RESOLVED on
    // successful apply_effects, so mock records land here.
    lifecycle_state: "RESOLVED",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe.py",
    final_status: "COMPLETE",
    created_at: "2026-04-11T11:00:00Z",
    updated_at: "2026-04-11T11:02:00Z",
    account_id: "acct-costco", account_name: "Costco",
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
    created_at: "2026-04-21T14:22:00Z",
    updated_at: "2026-04-21T14:30:00Z",
    account_id: "acct-walmart", account_name: "Walmart",
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
    created_at: "2026-04-06T16:45:00Z",
    updated_at: "2026-04-08T08:45:00Z",
    account_id: "acct-kroger", account_name: "Kroger",
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
    created_at: "2026-04-22T07:15:00Z",
    updated_at: "2026-04-22T07:22:00Z",
    account_id: "acct-target", account_name: "Target",
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
    created_at: "2026-04-09T11:00:00Z",
    updated_at: "2026-04-09T12:30:00Z",
    account_id: "acct-costco", account_name: "Costco",
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
    created_at: "2026-04-14T06:20:00Z",
    updated_at: "2026-04-14T06:22:00Z",
    account_id: "acct-walmart", account_name: "Walmart",
  },
  {
    id: "exc-010", tenant_id: "acme-corp", order_id: "SO-9200", event_type: "BACK_ORDER_OOS", intent: "BACK_ORDER", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "BackOrderResolutionRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-10T10:15:00Z", updated_at: "2026-04-10T10:22:00Z", account_id: "acct-kroger", account_name: "Kroger",
  },
  {
    id: "exc-011", tenant_id: "acme-corp", order_id: "SO-9450", event_type: "BACK_ORDER_OOS", intent: "BACK_ORDER", lifecycle_state: "RESOLVED", shadow_verdict: "GREEN", selected_recipe: "BackOrderResolutionRecipe.py", final_status: "COMPLETE", created_at: "2026-04-17T08:00:00Z", updated_at: "2026-04-17T08:05:00Z", account_id: "acct-target", account_name: "Target",
  },
  {
    id: "exc-012", tenant_id: "acme-corp", order_id: "SO-10100", event_type: "OVER_MAX_QTY", intent: "OVER_MAX", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "OverMaxTrimRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-07T09:30:00Z", updated_at: "2026-04-07T09:38:00Z", account_id: "acct-costco", account_name: "Costco",
  },
  {
    id: "exc-013", tenant_id: "acme-corp", order_id: "SO-11200", event_type: "MIN_ORDER_QTY", intent: "MIN_ORDER_QTY", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "MOQRoundUpRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-15T07:45:00Z", updated_at: "2026-04-15T07:52:00Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  {
    id: "exc-014", tenant_id: "acme-corp", order_id: "SO-12300", event_type: "PALLET_CONFIG_VIOLATION", intent: "PALLET_CONFIG", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "PalletAlignmentRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-12T11:20:00Z", updated_at: "2026-04-12T11:28:00Z", account_id: "acct-kroger", account_name: "Kroger",
  },
  // FAILED — pipeline crashed during recipe execution. Demonstrates the
  // execution-error surface distinct from compliance-blocked (RED verdict).
  {
    id: "exc-015", tenant_id: "acme-corp", order_id: "SO-13400", event_type: "ORDER_RECEIVED", intent: "CONTRACTUAL_CORRECTION", lifecycle_state: "FAILED", shadow_verdict: "GREEN", selected_recipe: "PriceAdjustmentRecipe.py", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-13T14:05:00Z", updated_at: "2026-04-13T14:05:42Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  // DELIVERY_DELAY — SD-DELAY-002 band (5+ days late). Dedicated section
  // renders from delivery_delay_analysis via data-presence pattern.
  {
    id: "exc-016", tenant_id: "acme-corp", order_id: "SO-14200", event_type: "DELIVERY_DELAY", intent: "DELIVERY_DELAY", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "DeliveryDelayResolutionRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-18T09:30:00Z", updated_at: "2026-04-18T09:35:00Z", account_id: "acct-target", account_name: "Target",
  },
  // PRICE_HOLD_RELEASE — auto-release branch (variance within tolerance).
  // Renders PriceHoldSection via OrderAnalysis.price_hold_analysis.
  {
    id: "exc-017", tenant_id: "acme-corp", order_id: "PO-PHR-001", event_type: "EDI_850_PRICE_HOLD", intent: "PRICE_HOLD_RELEASE", lifecycle_state: "RESOLVED", shadow_verdict: "GREEN", selected_recipe: "PriceHoldReleaseRecipe.py", final_status: "COMPLETE", created_at: "2026-04-06T08:00:00Z", updated_at: "2026-04-06T08:01:00Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  // PRICE_HOLD_RELEASE — escalate band (> tolerance, ≤ hard-block).
  {
    id: "exc-018", tenant_id: "acme-corp", order_id: "PO-PHR-002", event_type: "EDI_850_PRICE_HOLD", intent: "PRICE_HOLD_RELEASE", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "PriceHoldReleaseRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-28T08:05:00Z", updated_at: "2026-04-28T08:06:00Z", account_id: "acct-kroger", account_name: "Kroger",
  },
  // EDI_MISMATCH — SKU sub_type, hard reject.
  {
    id: "exc-019", tenant_id: "acme-corp", order_id: "PO-EDM-SKU-001", event_type: "EDI_850_LINE_MISMATCH", intent: "EDI_MISMATCH", lifecycle_state: "BLOCKED", shadow_verdict: "RED", selected_recipe: "EdiMismatchRecipe.py", final_status: "BLOCKED", created_at: "2026-04-26T09:00:00Z", updated_at: "2026-04-26T09:01:00Z", account_id: "acct-target", account_name: "Target",
  },
  // EDI_MISMATCH — QTY sub_type, review required.
  {
    id: "exc-020", tenant_id: "acme-corp", order_id: "PO-EDM-QTY-001", event_type: "EDI_850_LINE_MISMATCH", intent: "EDI_MISMATCH", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "EdiMismatchRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-05T09:05:00Z", updated_at: "2026-04-05T09:06:00Z", account_id: "acct-costco", account_name: "Costco",
  },
  // PRICE_MISMATCH routing fork: EDI_850_LINE_MISMATCH event whose
  // metadata.mismatch_sub_type=PRICE_MISMATCH lands as
  // CONTRACTUAL_CORRECTION at backend classifier time. Renders the
  // existing PriceAnalysisSection (via price_analysis), NOT a new EDI
  // mismatch panel — proves the single-source-of-truth invariant for
  // pricing (CLAUDE.md §1).
  {
    id: "exc-021", tenant_id: "acme-corp", order_id: "PO-PM-ROUTING-001", event_type: "EDI_850_LINE_MISMATCH", intent: "CONTRACTUAL_CORRECTION", lifecycle_state: "RESOLVED", shadow_verdict: "GREEN", selected_recipe: "PriceAdjustmentRecipe.py", final_status: "COMPLETE", created_at: "2026-04-27T10:00:00Z", updated_at: "2026-04-27T10:01:00Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  // ADR-027 Phase A.0 verdict-coverage demos (FAILED-state records
  // exercising every conditional gate's terminal verdict). These
  // are intentionally short halts — recipe never executes, shadow
  // may or may not run depending on where the gate halted. The UI
  // EventsTimeline + PipelineDAG render the halt point and reason
  // honestly rather than the linear stepper's misleading
  // "blocked at apply_effects" mapping.
  {
    id: "exc-022", tenant_id: "acme-corp", order_id: "SO-CB-001", event_type: "MASS_PRICING_RECALC", intent: "MASS_PRICING_ERROR", lifecycle_state: "FAILED", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-29T07:00:00Z", updated_at: "2026-04-29T07:00:01Z", account_id: "acct-walmart", account_name: "Walmart",
  },
  {
    id: "exc-023", tenant_id: "acme-corp", order_id: "SO-NR-001", event_type: "MASS_PRICING_RECALC", intent: "MASS_PRICING_ERROR", lifecycle_state: "FAILED", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-23T07:30:00Z", updated_at: "2026-04-23T07:30:00Z", account_id: "acct-kroger", account_name: "Kroger",
  },
  {
    id: "exc-024", tenant_id: "acme-corp", order_id: "SO-GW-001", event_type: "DUPLICATE_PO_RECEIVED", intent: "DUPLICATE_PO", lifecycle_state: "FAILED", selected_recipe: "DuplicatePORecipe.py", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-20T08:00:00Z", updated_at: "2026-04-20T08:00:02Z", account_id: "acct-target", account_name: "Target",
  },
  {
    id: "exc-025", tenant_id: "acme-corp", order_id: "PO-PHR-BAD", event_type: "EDI_850_PRICE_HOLD", intent: "PRICE_HOLD_RELEASE", lifecycle_state: "FAILED", selected_recipe: "PriceHoldReleaseRecipe.py", final_status: "FAIL_TO_HUMAN", created_at: "2026-04-16T08:30:00Z", updated_at: "2026-04-16T08:30:00Z", account_id: "acct-costco", account_name: "Costco",
  },
  // MANUAL_ORDER_INTAKE (ADR-034 Phase C) — STANDARD_REVIEW band record. The
  // upstream email-intelligence-agent extracted a non-EDI PO from a regional
  // distributor; composite_confidence 0.88 lands in the standard-review band
  // (≥ 0.85, < 0.95). All four non-disable-able floor checks pass; one
  // ambiguous ship-to triggers REQUEST_CLARIFICATION. Renders the
  // EmailOrderEntrySection via OrderAnalysis.email_order_entry_analysis
  // (data-presence dispatch — no per-intent page logic).
  {
    id: "exc-026", tenant_id: "acme-corp", order_id: "EML-PO-2026-0042", event_type: "EMAIL_ORDER_ENTRY_REQUEST", intent: "MANUAL_ORDER_INTAKE", lifecycle_state: "PENDING_REVIEW", shadow_verdict: "YELLOW", selected_recipe: "EmailOrderEntryRecipe.py", final_status: "MANUAL_REVIEW_REQUIRED", created_at: "2026-04-30T10:12:00Z", updated_at: "2026-04-30T10:13:30Z", account_id: "acct-southeast-distrib", account_name: "Southeast Beverage Distributors",
  },
];

/** Per-exception trace enrichment — optional Layer 2 fields demonstrated
 *  on a couple of representative exceptions. In production these will be
 *  populated by the recipe layer via TraceRecord extensions. */
/* ── ADR-027 Phase B — mock executed_nodes lists for the four canonical
   traces (Phase D acceptance fixtures): GREEN autonomous-resolved,
   YELLOW HITL, RED BLOCKED, FAILED at classify (cross-check
   disagreement). On the live (USE_REAL_API=1) path these come from
   `state.execution_trace` via the asoe2 trace endpoint; on the mock
   path the Vercel preview deploys without a live backend, so this is
   the seed that makes EventsTimeline + PipelineDAG render a realistic
   path instead of the "evidence not available" banner.

   All timestamps relative to a base anchor so the order is monotonic
   and durations are deterministic across builds (no Math.random — see
   Verdict 2026-04-22 / Guardrail #6). */

const MOCK_TRACE_BASE_TIME = "2026-05-01T12:00:00.000Z";

function _ts(offsetMs: number): string {
  return new Date(
    new Date(MOCK_TRACE_BASE_TIME).getTime() + offsetMs,
  ).toISOString();
}

function _node(
  node: string,
  startMs: number,
  durationMs: number,
  opts: {
    status?: "completed" | "halted" | "errored";
    decision?: Record<string, unknown>;
    exit_verdict?: string | null;
    policy_hits?: string[];
    sub_spans?: Array<{
      gateway: string;
      started_at: string;
      finished_at?: string;
      duration_ms?: number;
      status: "ok" | "error" | "timeout";
    }>;
  } = {},
): import("@/types/api").ExecutedNode {
  return {
    node,
    entered_at: _ts(startMs),
    completed_at: _ts(startMs + durationMs),
    duration_ms: durationMs,
    timestamp: _ts(startMs),
    status: opts.status ?? "completed",
    decision: opts.decision ?? {},
    exit_verdict: opts.exit_verdict ?? null,
    policy_hits: opts.policy_hits ?? [],
    sub_spans: opts.sub_spans ?? [],
  };
}

function _greenAutoResolvedTrace(
  recipeName: string,
): import("@/types/api").ExecutedNode[] {
  return [
    _node("ingest", 0, 4, { decision: { order_id: "SO-1042" } }),
    _node("classify", 4, 38, {
      decision: { intent: "CONTRACTUAL_CORRECTION", confidence: 0.91 },
      exit_verdict: "ok",
    }),
    _node("load_skill", 42, 6, {
      decision: { skill_name: "pricing-discrepancy" },
    }),
    _node("validate_circuit_breaker", 48, 2, {
      decision: { update_count: 1, batch_total_variance: 110 },
      exit_verdict: "ok",
    }),
    _node("select_recipe", 50, 14, {
      decision: { recipe_name: recipeName },
      exit_verdict: "ok",
    }),
    _node("resolve_dependencies", 64, 86, {
      decision: { recipe: recipeName, gateway_count: 2 },
      exit_verdict: "ok",
      sub_spans: [
        {
          gateway: "sap_doc/get_sales_order",
          started_at: _ts(64),
          finished_at: _ts(118),
          duration_ms: 54,
          status: "ok",
        },
        {
          gateway: "sap_contract/get_pricing",
          started_at: _ts(64),
          finished_at: _ts(150),
          duration_ms: 86,
          status: "ok",
        },
      ],
    }),
    _node("validate_types", 150, 3, {
      decision: { recipe: recipeName, param_keys: ["line_item", "order_id", "requested_price"] },
      exit_verdict: "ok",
    }),
    _node("shadow_audit", 153, 11, {
      decision: { shadow_status: "GREEN", trace_id: "trace-mock-green" },
      exit_verdict: "green",
      policy_hits: [],
    }),
    _node("execute_recipe", 164, 22, {
      decision: { recipe: recipeName, recipe_status: "OK", final_status: "COMPLETE" },
    }),
    _node("apply_effects", 186, 31, {
      decision: { recipe: recipeName, effect_count: 1, effects_ok: 1 },
    }),
    _node("build_analysis", 217, 4, {
      decision: { final_status: "COMPLETE", audit_coverage: "complete" },
    }),
  ];
}

function _yellowHitlTrace(
  recipeName: string,
): import("@/types/api").ExecutedNode[] {
  return [
    _node("ingest", 0, 4, { decision: { order_id: "SO-1042" } }),
    _node("classify", 4, 36, {
      decision: { intent: "CONTRACTUAL_CORRECTION", confidence: 0.86 },
      exit_verdict: "ok",
    }),
    _node("load_skill", 40, 6, {
      decision: { skill_name: "pricing-discrepancy" },
    }),
    _node("validate_circuit_breaker", 46, 2, {
      decision: { update_count: 1, batch_total_variance: 1100 },
      exit_verdict: "ok",
    }),
    _node("select_recipe", 48, 14, {
      decision: { recipe_name: recipeName },
      exit_verdict: "ok",
    }),
    _node("resolve_dependencies", 62, 78, {
      decision: { recipe: recipeName, gateway_count: 1 },
      exit_verdict: "ok",
      sub_spans: [
        {
          gateway: "sap_contract/get_pricing",
          started_at: _ts(62),
          finished_at: _ts(140),
          duration_ms: 78,
          status: "ok",
        },
      ],
    }),
    _node("validate_types", 140, 3, {
      decision: { recipe: recipeName, param_keys: ["line_item", "order_id"] },
      exit_verdict: "ok",
    }),
    _node("shadow_audit", 143, 12, {
      status: "halted",
      decision: { shadow_status: "YELLOW", trace_id: "trace-mock-yellow" },
      exit_verdict: "yellow",
      policy_hits: ["price.over_at_risk_threshold"],
    }),
    _node("build_analysis", 155, 4, {
      status: "halted",
      decision: { final_status: "MANUAL_REVIEW_REQUIRED", audit_coverage: "complete" },
    }),
  ];
}

function _redBlockedTrace(
  recipeName: string,
): import("@/types/api").ExecutedNode[] {
  return [
    _node("ingest", 0, 4, { decision: { order_id: "PO-EDM-SKU-001" } }),
    _node("classify", 4, 31, {
      decision: { intent: "EDI_MISMATCH", confidence: 0.94 },
      exit_verdict: "ok",
    }),
    _node("load_skill", 35, 5, {
      decision: { skill_name: "edi-mismatch" },
    }),
    _node("validate_circuit_breaker", 40, 2, {
      decision: { update_count: 1, batch_total_variance: 0 },
      exit_verdict: "ok",
    }),
    _node("select_recipe", 42, 12, {
      decision: { recipe_name: recipeName },
      exit_verdict: "ok",
    }),
    _node("resolve_dependencies", 54, 64, {
      decision: { recipe: recipeName, gateway_count: 1 },
      exit_verdict: "ok",
      sub_spans: [
        {
          gateway: "sap_doc/get_sales_order",
          started_at: _ts(54),
          finished_at: _ts(118),
          duration_ms: 64,
          status: "ok",
        },
      ],
    }),
    _node("validate_types", 118, 3, {
      decision: { recipe: recipeName, param_keys: ["expected_value", "order_id", "received_value", "sub_type"] },
      exit_verdict: "ok",
    }),
    _node("shadow_audit", 121, 9, {
      status: "halted",
      decision: { shadow_status: "RED", trace_id: "trace-mock-red" },
      exit_verdict: "red",
      policy_hits: [
        "edi.line_mismatch_blocks_autoresolve",
        "compliance.fraud_signal_strong",
      ],
    }),
    _node("build_analysis", 130, 4, {
      status: "halted",
      decision: { final_status: "BLOCKED", audit_coverage: "complete" },
    }),
  ];
}

function _failedClassifyTrace(): import("@/types/api").ExecutedNode[] {
  return [
    _node("ingest", 0, 4, { decision: { order_id: "SO-13400" } }),
    _node("classify", 4, 412, {
      status: "halted",
      decision: {
        intent: "CONTRACTUAL_CORRECTION",
        confidence: 0.62,
        llm_intent: "CREDIT_BLOCK",
        deterministic_intent: "CONTRACTUAL_CORRECTION",
        cross_check_reason: "LLM intent CREDIT_BLOCK does not match deterministic CONTRACTUAL_CORRECTION",
      },
      exit_verdict: "cross_check_disagreement",
    }),
    _node("build_analysis", 416, 3, {
      status: "halted",
      decision: { final_status: "FAIL_TO_HUMAN", guard: "fail_to_human_skip" },
    }),
  ];
}

/* ── Phase A.0 verdict-coverage: halt-at-circuit-breaker.
   Mass-update / variance breach trips validate_circuit_breaker; the
   gate's only conditional terminal verdict is `breach`. Halts before
   recipe selection, so trace_data carries no recipe and shadow never
   runs. */
function _circuitBreakerBreachTrace(): import("@/types/api").ExecutedNode[] {
  return [
    _node("ingest", 0, 4, { decision: { order_id: "SO-CB-001", request_trace_id: "tr-cb-001" } }),
    _node("classify", 4, 21, {
      decision: { intent: "MASS_PRICING_ERROR", confidence: 0.88 },
      exit_verdict: "ok",
    }),
    _node("load_skill", 25, 5, { decision: { skill_name: "mass-pricing-error" } }),
    _node("validate_circuit_breaker", 30, 3, {
      status: "halted",
      decision: {
        update_count: 152,
        batch_total_variance: 18420,
        reasons: [
          "update_count 152 exceeds threshold 50",
          "batch_total_variance $18420 exceeds threshold $5000",
        ],
      },
      exit_verdict: "breach",
    }),
    _node("build_analysis", 33, 3, {
      status: "halted",
      decision: { final_status: "FAIL_TO_HUMAN", guard: "fail_to_human_skip" },
    }),
  ];
}

/* ── Phase A.0 verdict-coverage: halt-at-select-recipe.
   Some intents (notably MASS_PRICING_ERROR) intentionally have no
   recipe — shadow is the terminal voice for them. select_recipe
   emits the `no_recipe` verdict; the run continues to shadow_audit
   only if shadow has been wired ahead of select_recipe — which it
   isn't. So this halts at select_recipe directly. */
function _noRecipeTrace(): import("@/types/api").ExecutedNode[] {
  return [
    _node("ingest", 0, 4, { decision: { order_id: "SO-NR-001", request_trace_id: "tr-nr-001" } }),
    _node("classify", 4, 18, {
      decision: { intent: "MASS_PRICING_ERROR", confidence: 0.93 },
      exit_verdict: "ok",
    }),
    _node("load_skill", 22, 5, { decision: { skill_name: "mass-pricing-error" } }),
    _node("validate_circuit_breaker", 27, 2, {
      decision: { update_count: 1, batch_total_variance: 240 },
      exit_verdict: "ok",
    }),
    _node("select_recipe", 29, 8, {
      status: "halted",
      decision: { recipe_name: null },
      exit_verdict: "no_recipe",
    }),
    _node("build_analysis", 37, 3, {
      status: "halted",
      decision: { final_status: "FAIL_TO_HUMAN", guard: "fail_to_human_skip" },
    }),
  ];
}

/* ── Phase A.0 verdict-coverage: halt-at-resolve-dependencies.
   A recipe declares a `required_for_audit=True` gateway that times
   out. resolve_dependencies emits `required_gw_fail` and halts —
   shadow never runs because the audit-bearing evidence couldn't be
   captured. The single sub_span carries the failed gateway's
   timing + status. */
function _requiredGwFailTrace(): import("@/types/api").ExecutedNode[] {
  return [
    _node("ingest", 0, 4, { decision: { order_id: "SO-GW-001", request_trace_id: "tr-gw-001" } }),
    _node("classify", 4, 28, {
      decision: { intent: "DUPLICATE_PO", confidence: 0.89 },
      exit_verdict: "ok",
    }),
    _node("load_skill", 32, 6, { decision: { skill_name: "duplicate-po" } }),
    _node("validate_circuit_breaker", 38, 2, {
      decision: { update_count: 1, batch_total_variance: 0 },
      exit_verdict: "ok",
    }),
    _node("select_recipe", 40, 13, {
      decision: { recipe_name: "DuplicatePORecipe.py" },
      exit_verdict: "ok",
    }),
    _node("resolve_dependencies", 53, 2014, {
      status: "halted",
      decision: {
        recipe: "DuplicatePORecipe.py",
        gateway_count: 2,
        failed_gateway: "sap_doc/get_matched_po_details",
      },
      exit_verdict: "required_gw_fail",
      sub_spans: [
        {
          gateway: "oms/get_fulfillment_status",
          started_at: _ts(53),
          finished_at: _ts(102),
          duration_ms: 49,
          status: "ok",
        },
        {
          gateway: "sap_doc/get_matched_po_details",
          started_at: _ts(53),
          finished_at: _ts(2053),
          duration_ms: 2000,
          status: "timeout",
        },
      ],
    }),
    _node("build_analysis", 2067, 4, {
      status: "halted",
      decision: { final_status: "FAIL_TO_HUMAN", guard: "fail_to_human_skip" },
    }),
  ];
}

/* ── Phase A.0 verdict-coverage: halt-at-validate-types.
   PriceHoldReleaseRecipe's defensive guard: sap_base_price <= 0 is
   a routing bug, not a business exception. validate_types short-
   circuits with `invocation_fail` rather than letting the recipe
   throw at execution time. */
function _invocationFailTrace(): import("@/types/api").ExecutedNode[] {
  return [
    _node("ingest", 0, 4, { decision: { order_id: "PO-PHR-BAD", request_trace_id: "tr-vt-001" } }),
    _node("classify", 4, 26, {
      decision: { intent: "PRICE_HOLD_RELEASE", confidence: 0.84 },
      exit_verdict: "ok",
    }),
    _node("load_skill", 30, 5, { decision: { skill_name: "price-hold-release" } }),
    _node("validate_circuit_breaker", 35, 2, {
      decision: { update_count: 1, batch_total_variance: 0 },
      exit_verdict: "ok",
    }),
    _node("select_recipe", 37, 11, {
      decision: { recipe_name: "PriceHoldReleaseRecipe.py" },
      exit_verdict: "ok",
    }),
    _node("resolve_dependencies", 48, 42, {
      decision: { recipe: "PriceHoldReleaseRecipe.py", gateway_count: 1 },
      exit_verdict: "ok",
      sub_spans: [
        {
          gateway: "oms/get_price_hold_status",
          started_at: _ts(48),
          finished_at: _ts(90),
          duration_ms: 42,
          status: "ok",
        },
      ],
    }),
    _node("validate_types", 90, 2, {
      status: "halted",
      decision: {
        recipe: "PriceHoldReleaseRecipe.py",
        guard: "sap_base_price_non_positive",
        sap_base_price: 0,
      },
      exit_verdict: "invocation_fail",
    }),
    _node("build_analysis", 92, 3, {
      status: "halted",
      decision: { final_status: "FAIL_TO_HUMAN", guard: "fail_to_human_skip" },
    }),
  ];
}

/* ── Default trace dispatcher.
   Picks the appropriate executed_nodes shape from an exception
   summary's lifecycle / shadow_verdict / final_status fields when no
   hand-crafted MOCK_TRACE_ENRICHMENT entry exists. Keeps every detail
   page on the Vercel preview rendering a real path rather than the
   pre-Phase-B empty-state banner. */
function _defaultExecutedNodes(
  exc: ExceptionSummary,
): import("@/types/api").ExecutedNode[] {
  const recipe = exc.selected_recipe ?? "GenericRecipe.py";

  // FAILED records: the lifecycle reflects the canonical halt cases
  // already covered by the explicit Phase A.0 traces. Default to the
  // cross-check disagreement shape (the most common "failed at
  // classify" cause) so unknown FAILED records still show a real
  // halt path rather than empty.
  if (exc.lifecycle_state === "FAILED") {
    return _failedClassifyTrace();
  }

  // RED-shadowed records halt at shadow_audit with the RED verdict.
  if (exc.shadow_verdict === "RED" || exc.final_status === "BLOCKED") {
    return _redBlockedTrace(recipe);
  }

  // YELLOW-shadowed records halt at shadow_audit with the YELLOW
  // verdict; covers MANUAL_REVIEW_REQUIRED, ESCALATED, and the
  // cosign / admin review paths.
  if (
    exc.shadow_verdict === "YELLOW"
    || exc.final_status === "MANUAL_REVIEW_REQUIRED"
    || exc.final_status === "REJECTED"
  ) {
    return _yellowHitlTrace(recipe);
  }

  // GREEN auto-resolved (COMPLETE, RESOLVED, CLOSED).
  if (
    exc.shadow_verdict === "GREEN"
    || exc.final_status === "COMPLETE"
    || exc.lifecycle_state === "RESOLVED"
    || exc.lifecycle_state === "CLOSED"
  ) {
    return _greenAutoResolvedTrace(recipe);
  }

  // INGESTED / CLASSIFYING / AUDITING — the run hasn't reached a
  // terminal state yet. Show only the prefix that's actually run.
  // INGESTED: ingest only. CLASSIFYING: ingest + classify started.
  // AUDITING: through validate_types, shadow_audit started.
  if (exc.lifecycle_state === "INGESTED") {
    return [
      _node("ingest", 0, 4, {
        decision: { order_id: exc.order_id },
      }),
    ];
  }
  if (exc.lifecycle_state === "CLASSIFYING") {
    return [
      _node("ingest", 0, 4, { decision: { order_id: exc.order_id } }),
      _node("classify", 4, 12, {
        status: "completed",
        decision: { intent: exc.intent ?? "UNKNOWN" },
      }),
    ];
  }
  if (exc.lifecycle_state === "AUDITING") {
    return [
      _node("ingest", 0, 4, { decision: { order_id: exc.order_id } }),
      _node("classify", 4, 32, {
        decision: { intent: exc.intent ?? "UNKNOWN", confidence: 0.85 },
        exit_verdict: "ok",
      }),
      _node("load_skill", 36, 5, {
        decision: { skill_name: exc.intent?.toLowerCase() ?? "unknown" },
      }),
      _node("validate_circuit_breaker", 41, 2, {
        decision: { update_count: 1 },
        exit_verdict: "ok",
      }),
      _node("select_recipe", 43, 11, {
        decision: { recipe_name: recipe },
        exit_verdict: "ok",
      }),
      _node("resolve_dependencies", 54, 70, {
        decision: { recipe, gateway_count: 1 },
        exit_verdict: "ok",
      }),
      _node("validate_types", 124, 3, {
        decision: { recipe },
        exit_verdict: "ok",
      }),
      // shadow_audit started but no terminal yet
    ];
  }

  // Fallback: return the green path. Better to show *something* than
  // a banner; the banner is reserved for backends that legitimately
  // didn't write executed_nodes (live-mode pre-Phase-B records).
  return _greenAutoResolvedTrace(recipe);
}

const MOCK_TRACE_ENRICHMENT: Record<string, Partial<TraceResponse>> = {
  "exc-002": {
    narrative:
      "Two line items referenced a promotional price under ZPROM condition Q4-WMT-021, which expired on 2025-12-31. The PO was submitted on 2026-01-08, after promo expiry. The deterministic fallback recognised the pricing mismatch as CONTRACTUAL_CORRECTION (not a data-entry error) because the contracted customer-group rate (PR00) sits 11% below the PO price, within the auto-tolerance band.\n\nCompliance Shadow returned YELLOW — auto-resolution is blocked above the $1K single-line at-risk threshold until a reviewer confirms the promo should not be reloaded.",
    resolution_steps: [
      "Confirm the expired promo should not be extended for this PO.",
      "Approve the price correction against the contract base rate (PR00).",
      "Notify buyer via drafted email (see below) — courtesy communication.",
    ],
    sap_actions: [
      { transaction: "VK13", table: "KONP", field: "KBETR", description: "Verify contract base rate (PR00) currently on file for customer-material group." },
      { transaction: "VA02", table: "VBAP", field: "KBETR", description: "Apply the corrected line-item price from the contract rate." },
      { transaction: "V.23", table: "VBAK", field: "LIFSK", description: "Release pricing block once correction is saved." },
    ],
    customer_email_draft:
      "Hi [Buyer name],\n\nThank you for PO 4500020017. We noticed that two line items were priced against our Q4 promotional rate (Q4-WMT-021), which expired 12/31. We've adjusted those lines to your current contract rate (PR00) — an 11% difference from the PO price.\n\nNo action is needed on your side; this correction is within your contract's published auto-adjust band. Confirmation will follow shortly.\n\nBest,\n[CSR name]",
    executed_nodes: _yellowHitlTrace("PriceAdjustmentRecipe.py"),
  },
  "exc-013": {
    narrative:
      "The PO qty (40 CS) falls below the contracted MOQ of 50 CS for SKU-7800. SAP raised block V4082 on the sales order. The deterministic fallback mapped this to MIN_ORDER_QTY → MOQRoundUpRecipe. The autonomy-level policy requires operator sign-off for MOQ round-ups above a 10% uplift; this case is 25%, so automatic execution is blocked.",
    resolution_steps: [
      "Approve the round-up to 50 CS (matches contracted MOQ).",
      "Apply the resulting volume discount tier (condition KA00).",
      "Release the V4082 block on the sales order.",
    ],
    sap_actions: [
      { transaction: "VA02", table: "VBAP", field: "KWMENG", description: "Update the ordered quantity on SKU-7800 from 40 CS to 50 CS." },
      { transaction: "VK11", table: "KONV", field: "KBETR", description: "Apply volume-tier pricing condition KA00 at the new qty." },
      { transaction: "V.23", table: "VBAK", field: "LIFSK", description: "Release V4082 delivery block after quantity adjustment." },
    ],
    customer_email_draft:
      "Hi [Buyer name],\n\nWe received PO [PO#] for 40 cases of SKU-7800 (Organic Kombucha 6pk). The contracted minimum is 50 cases, which would also unlock your next volume-tier rate.\n\nWith your approval, we'll round the order up to 50 cases at the better unit price. Total net change: +$285 at a ~4% lower $/case. Alternately, we can hold and wait for a revised PO — please confirm.\n\nBest,\n[CSR name]",
    executed_nodes: _yellowHitlTrace("MOQRoundUpRecipe.py"),
  },
  // GREEN autonomous-resolved sample (Phase D acceptance trace #1)
  "exc-011": {
    executed_nodes: _greenAutoResolvedTrace("BackOrderResolutionRecipe.py"),
  },
  // GREEN autonomous-resolved on the price-hold-release path (uses
  // the same trace shape; recipe label differs).
  "exc-017": {
    executed_nodes: _greenAutoResolvedTrace("PriceHoldReleaseRecipe.py"),
  },
  // RED BLOCKED sample (Phase D acceptance trace #3)
  "exc-019": {
    executed_nodes: _redBlockedTrace("EdiMismatchRecipe.py"),
  },
  // FAILED at classify — cross-check disagreement halt (Phase D
  // acceptance trace #4 — the SMK-CB-001 canonical case).
  "exc-015": {
    executed_nodes: _failedClassifyTrace(),
  },
  // ADR-027 Phase A.0 — every conditional-gate terminal verdict
  // gets at least one mock so the timeline/DAG views can be
  // exercised end-to-end across every branch. Each row's halt
  // node and exit_verdict appears on the corresponding
  // _VERDICT_LABELS registry entry in asoe2/orchestration/graph.py.
  // halt at validate_circuit_breaker (verdict: breach)
  "exc-022": {
    executed_nodes: _circuitBreakerBreachTrace(),
  },
  // halt at select_recipe (verdict: no_recipe)
  "exc-023": {
    executed_nodes: _noRecipeTrace(),
  },
  // halt at resolve_dependencies (verdict: required_gw_fail)
  "exc-024": {
    executed_nodes: _requiredGwFailTrace(),
  },
  // halt at validate_types (verdict: invocation_fail)
  "exc-025": {
    executed_nodes: _invocationFailTrace(),
  },
  // MANUAL_ORDER_INTAKE (ADR-034) — STANDARD_REVIEW band, REQUEST_CLARIFICATION
  // action driven by ambiguous ship-to. Reuses the YELLOW-HITL trace shape;
  // the recipe-specific decision detail lives on email_order_entry_analysis.
  "exc-026": {
    narrative:
      "Inbound email from Southeast Beverage Distributors carried a non-EDI PO. The email-intelligence-agent extracted four line items at composite confidence 0.88 (review band). All four non-disable-able floor checks passed — sender authorised, customer resolved, no duplicate PO, credit clear. One ambiguous ship-to address ('Atlanta DC' matches two warehouses) routes the record to REQUEST_CLARIFICATION rather than auto-approve.",
    resolution_steps: [
      "Confirm the intended ship-to with the buyer (Atlanta-North or Atlanta-South DC).",
      "Re-run validation with the resolved ship-to and approve.",
    ],
    executed_nodes: _yellowHitlTrace("EmailOrderEntryRecipe.py"),
  },
};


const MOCK_HEALTH: HealthResponse = {
  status: "ok",
  version: "0.3.2",
  kill_switch: false,
  explain_mode: false,
  allowed_intents: ["CONTRACTUAL_CORRECTION", "CREDIT_BLOCK", "MASS_PRICING_ERROR", "DUPLICATE_PO", "BACK_ORDER", "OVER_MAX", "MIN_ORDER_QTY", "PALLET_CONFIG", "DELIVERY_DELAY", "PRICE_HOLD_RELEASE", "EDI_MISMATCH", "MANUAL_ORDER_INTAKE"],
  lifecycle_states: [
    "INGESTED", "CLASSIFYING", "AUDITING", "PENDING_REVIEW",
    "ESCALATED", "PENDING_ADMIN_REVIEW", "PENDING_COSIGN", "RESOLVED",
    "FAILED", "BLOCKED", "REJECTED", "CLOSED",
  ],
  allowed_recipes: ["PriceAdjustmentRecipe.py", "CreditHoldReleaseRecipe.py", "DuplicatePORecipe.py", "BackOrderResolutionRecipe.py", "OverMaxTrimRecipe.py", "MOQRoundUpRecipe.py", "PalletAlignmentRecipe.py", "DeliveryDelayResolutionRecipe.py", "PriceHoldReleaseRecipe.py", "EdiMismatchRecipe.py", "EmailOrderEntryRecipe.py"],
  // Mirrors asoe2/constraints/specs.py AllowedResolutionAction. Backend is
  // authoritative at runtime (/api/v1/health); this mock list exists only for
  // local development.
  allowed_resolution_actions: ["BLOCK_AND_NOTIFY", "MERGE", "SUPERSEDE", "ALLOW_BOTH", "ESCALATE", "REQUEST_BUYER_CONFIRMATION", "ONE_CLICK_APPROVE", "STANDARD_REVIEW", "LOW_CONFIDENCE_FLAG", "AUTO_CORRECT", "REQUEST_CLARIFICATION", "REJECT"],
  // Sourced from asoe2/constraints/specs.py via the snapshot at
  // tests/contract/snapshots/curated_reason_tags.json (regen with
  // `npm run sync:reason-tags`). The 2026-05-10 panel curated every
  // intent with UPPERCASE per-intent vocabularies; the legacy
  // lowercase globals stay on `allowed_override_reason_tags` for
  // grandfathered read-side audit-log rows.
  allowed_override_reason_tags: [
    ...ALLOWED_OVERRIDE_REASON_TAGS,
  ],
  allowed_override_reason_tags_by_intent: Object.fromEntries(
    Object.entries(ALLOWED_OVERRIDE_REASON_TAGS_BY_INTENT).map(
      ([intent, tags]) => [intent, [...tags]],
    ),
  ),
};

/* ── Auth API (/api/auth/*) ─────��──────────────────────────────────── */

export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    if (USE_REAL_API) {
      // /api/auth/login (note the non-v1 prefix — see asoe2/api/app.py).
      return http<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: credentials,
      });
    }
    await delay(MOCK_DELAY);
    const user = MOCK_USERS[credentials.email];
    if (user && credentials.password) {
      _currentMockUser = user;
      return {
        access_token: `mock-access-token-${user.id}`,
        refresh_token: `mock-refresh-token-${user.id}`,
        token_type: "bearer",
        user,
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
    if (USE_REAL_API) return http<HealthResponse>("/api/v1/health");
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
    if (USE_REAL_API) {
      // Server reads the query param as `status` (api/routes/exceptions.py).
      // The internal mock store keyed off `lifecycle_state` is unrelated;
      // do not rename this back without coordinating a server change.
      return http<ExceptionListResponse>("/api/v1/exceptions", {
        query: {
          status: params?.status,
          intent: params?.intent,
          cursor: params?.cursor,
          limit: params?.limit,
        },
      });
    }
    await delay(MOCK_DELAY);
    let filtered = [...MOCK_EXCEPTIONS];
    // Account scoping: mirror server-side assigned_accounts filter
    if (_currentMockUser.assigned_accounts.length > 0) {
      const allowed = new Set(_currentMockUser.assigned_accounts);
      filtered = filtered.filter((e) => e.account_id && allowed.has(e.account_id));
    }
    if (params?.status) {
      filtered = filtered.filter((e) => e.lifecycle_state === params.status);
    }
    if (params?.intent) {
      filtered = filtered.filter((e) => e.intent === params.intent);
    }
    return { data: filtered, has_more: false };
  },

  async get(id: string): Promise<ExceptionDetailResponse> {
    if (USE_REAL_API) {
      return http<ExceptionDetailResponse>(`/api/v1/exceptions/${id}`);
    }
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    // Four-eyes: if a pending override was staged in a prior override()
    // call, surface it here so a page reload or peer-user navigation
    // shows the PENDING_COSIGN banner.
    const pending = MOCK_PENDING_OVERRIDES[id];
    if (pending) {
      return {
        ...exc,
        lifecycle_state: "PENDING_COSIGN",
        resolution_data: {
          financial_impact_usd: pending.financial_impact_usd,
          pending_override: pending,
        },
        resolved_by: undefined,
        resolved_action: undefined,
        resolution_notes: undefined,
        reanalysis_history: MOCK_REANALYSIS_HISTORY[id] ?? [],
      };
    }
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
      // Surface persisted reanalysis history so the counter is stable
      // across refreshes — previously every get() reset it to undefined.
      reanalysis_history: MOCK_REANALYSIS_HISTORY[id] ?? [],
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

  async cosign(
    id: string,
    request: CosignRequest,
    options?: RequestOptions,
  ): Promise<ExceptionDetailResponse> {
    // Phase 2 #5 — second-reviewer on a pending high-value override.
    const idempotencyKey = resolveIdempotencyKey(options);
    if (USE_REAL_API) {
      return http<ExceptionDetailResponse>(`/api/v1/exceptions/${id}/override/cosign`, {
        method: "POST",
        body: request,
        idempotencyKey,
      });
    }
    const cached = idempotencyLookup(`cosign:${id}`, idempotencyKey, request);
    if (cached) return cached;

    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    const pending = MOCK_PENDING_OVERRIDES[id];
    if (!pending) {
      throw new Error(
        "Cosign not permitted: no pending override on this exception.",
      );
    }
    // Bug fix: read the actual logged-in user from the NextAuth
    // session (was: `_currentMockUser?.email` — server-only state
    // that defaults to marcus.webb in the browser bundle).
    const caller = (await getCurrentMockUserEmail()) ?? "mock-user";
    if (pending.initiator === caller) {
      throw new Error(
        "SOD_VIOLATION: the initiator of the override cannot cosign their own action.",
      );
    }
    if (!request.notes || !request.notes.trim()) {
      throw new Error("NOTES_REQUIRED: cosign notes are mandatory (SOX).");
    }

    // Bug fix: bump updated_at on the underlying entry so a followup
    // refreshDetail() refetch sees the new ts.
    const ts = new Date().toISOString();
    exc.updated_at = ts;

    let response: ExceptionDetailResponse;
    if (request.approve) {
      response = {
        ...exc,
        lifecycle_state: "RESOLVED",
        final_status: "COMPLETE",
        resolved_by: pending.initiator,
        resolved_action: pending.action,
        resolution_notes: pending.notes,
        resolution_data: {
          financial_impact_usd: pending.financial_impact_usd,
          cosign: {
            cosigned_by: caller,
            cosigned_at: ts,
            cosign_notes: request.notes,
            initiator: pending.initiator,
            initiated_at: pending.initiated_at,
          },
        },
        updated_at: ts,
      };
    } else {
      response = {
        ...exc,
        lifecycle_state: pending.from_lifecycle_state,
        resolution_data: {
          financial_impact_usd: pending.financial_impact_usd,
          cosign_rejection: {
            rejected_by: caller,
            rejected_at: ts,
            rejection_notes: request.notes,
            initiator: pending.initiator,
          },
        },
        updated_at: ts,
      };
    }
    delete MOCK_PENDING_OVERRIDES[id];
    idempotencyStore(`cosign:${id}`, idempotencyKey, request, response);
    return response;
  },

  /**
   * v2 consolidation — unified Approve/Reject/Override disposition. The
   * backend derives sub_type from (chosen_action, recommended_action):
   *   chosen == NO_ACTION        → REJECT (exceptions:approve)
   *   chosen == recommended      → APPROVE (exceptions:approve)
   *   chosen != recommended      → OVERRIDE (exceptions:override,
   *                                           four-eyes gates may fire)
   *
   * Additive for now — existing override/approve/reject methods stay.
   * Phase 3 will migrate call sites and deprecate them.
   */
  async disposition(
    id: string,
    request: DispositionRequest,
    options?: RequestOptions,
  ): Promise<ExceptionDetailResponse> {
    const idempotencyKey = resolveIdempotencyKey(options);
    if (USE_REAL_API) {
      return http<ExceptionDetailResponse>(`/api/v1/exceptions/${id}/disposition`, {
        method: "PATCH",
        body: request,
        idempotencyKey,
      });
    }
    const cached = idempotencyLookup(`disposition:${id}`, idempotencyKey, request);
    if (cached) return cached;

    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    if (!request.notes || !request.notes.trim()) {
      throw new Error("NOTES_REQUIRED: notes are required (SOX audit trail).");
    }
    // Mock does not persist recommended_action on the summary; treat the
    // chosen action as APPROVE when it matches a minimal known default,
    // REJECT on NO_ACTION, OVERRIDE otherwise — close enough for demo.
    let newLifecycle: LifecycleState;
    if (request.action === "NO_ACTION") newLifecycle = "REJECTED";
    else newLifecycle = "RESOLVED";
    // Bug fix: read the actual logged-in user from the NextAuth session
    // (was: `_currentMockUser?.email` — module-level state set
    // server-side only, defaulting to marcus.webb in the browser).
    const resolvedBy = (await getCurrentMockUserEmail()) ?? "mock-user";
    const ts = new Date().toISOString();
    const response: ExceptionDetailResponse = {
      ...exc,
      lifecycle_state: newLifecycle,
      final_status: newLifecycle === "RESOLVED" ? "COMPLETE" : "REJECTED",
      resolved_by: resolvedBy,
      resolved_action: request.action,
      resolution_notes: request.notes,
      resolution_data: {},
      updated_at: ts,
    };
    // Bug fix: bump updated_at on the underlying MOCK_EXCEPTIONS
    // entry so the followup detail re-fetch sees the new ts. We
    // intentionally DON'T mutate lifecycle_state / final_status
    // here: those mutations would leak across tests in the shared
    // MOCK_EXCEPTIONS array (a disposition() in one test would
    // change exc-002's lifecycle and break a later escalate() test
    // on the same id). The response still carries the new
    // lifecycle for the immediate UI render; the re-fetch then
    // reverts — matches pre-fix behaviour for everything except
    // the timestamp.
    exc.updated_at = ts;
    idempotencyStore(`disposition:${id}`, idempotencyKey, request, response);
    return response;
  },

  async escalate(
    id: string,
    request: EscalateRequest,
    options?: RequestOptions,
  ): Promise<ExceptionDetailResponse> {
    const idempotencyKey = resolveIdempotencyKey(options);
    if (USE_REAL_API) {
      return http<ExceptionDetailResponse>(`/api/v1/exceptions/${id}/escalate`, {
        method: "POST",
        body: request,
        idempotencyKey,
      });
    }
    const cached = idempotencyLookup(`escalate:${id}`, idempotencyKey, request);
    if (cached) return cached;

    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    // Mirror backend lifecycle gate — escalate permitted from
    // PENDING_REVIEW, FAILED, or BLOCKED.
    const eligible = ["PENDING_REVIEW", "FAILED", "BLOCKED"].includes(
      exc.lifecycle_state,
    );
    if (!eligible) {
      throw new Error(
        "Escalate not permitted in this state (requires PENDING_REVIEW, FAILED, or BLOCKED).",
      );
    }
    // Bug fix: bump updated_at on the underlying entry so a followup
    // refreshDetail() refetch sees the new ts (matches reanalyze /
    // disposition fix).
    const ts = new Date().toISOString();
    exc.updated_at = ts;
    const response: ExceptionDetailResponse = {
      ...exc,
      lifecycle_state: "ESCALATED",
      resolution_data: {},
      resolution_notes: `ESCALATED: ${request.reason}`,
      updated_at: ts,
    };
    idempotencyStore(`escalate:${id}`, idempotencyKey, request, response);
    return response;
  },

  async reanalyze(
    id: string,
    request: ReanalyzeRequest,
    /**
     * Optional — caller-provided email of the user triggering the
     * reanalysis. The component layer reads this from `useAuth()`'s
     * session-backed user object and passes it in synchronously.
     * Preferred path for mock mode: avoids the
     * `getSession()`-via-dynamic-import lookup which can return null
     * during hydration races and silently fall back to the module-level
     * default user (yielding wrong attribution like the literal
     * "mock-user" or the marcus.webb default). When a value is
     * provided here, attribution is deterministic.
     *
     * Falls through to `getCurrentMockUserEmail()` when omitted (e.g.
     * test contexts that haven't set up a session). Production /
     * real-API mode reads identity from the JWT, ignoring this arg.
     */
    triggeredBy?: string,
  ): Promise<ExceptionDetailResponse> {
    if (USE_REAL_API) {
      // Live path was missing entirely — UI was reaching the mock body
      // below against the real backend, MOCK_EXCEPTIONS.find returned
      // undefined, and the call threw "Exception not found" with no
      // network roundtrip. Mirrors the asoe2 route POST
      // /api/v1/exceptions/{id}/reanalyze (manager+ gated). The backend
      // attributes the trigger from the JWT `sub` / `email` claims, so
      // the triggeredBy arg is mock-only.
      return http<ExceptionDetailResponse>(
        `/api/v1/exceptions/${id}/reanalyze`,
        {
          method: "POST",
          body: request,
        },
      );
    }
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    // Mirror backend eligibility gates — the real API returns 409 for
    // GREEN/RESOLVED/CLOSED. Match that contract here so UI logic written
    // against the mock behaves identically against the real backend.
    const eligibleVerdict = exc.shadow_verdict === "YELLOW" || exc.shadow_verdict === "RED";
    const eligibleLifecycle = [
      "PENDING_REVIEW", "ESCALATED", "PENDING_ADMIN_REVIEW", "BLOCKED", "FAILED",
    ].includes(exc.lifecycle_state);
    if (!(eligibleVerdict || eligibleLifecycle)) {
      throw new Error(
        "Reanalysis not permitted in this state (requires YELLOW/RED verdict or FAILED/BLOCKED/ESCALATED/PENDING lifecycle).",
      );
    }

    // Persist history per-exception so repeated re-runs increment the
    // counter. Matches asoe2/api/routes/exceptions.py append_reanalysis.
    const history = MOCK_REANALYSIS_HISTORY[id] ?? [];
    if (history.length >= MOCK_REANALYSIS_MAX_ATTEMPTS) {
      throw new Error(
        `Reanalysis limit reached (${MOCK_REANALYSIS_MAX_ATTEMPTS} attempts). Escalate to admin for manual resolution.`,
      );
    }

    const ts = new Date().toISOString();
    // Prior trace is whatever the last run produced — chain attempts together.
    const priorTraceId = history.length === 0
      ? exc.id + "-trace"
      : history[history.length - 1].new_trace_id ?? exc.id + "-trace";
    const newTraceId = exc.id + "-trace-" + Math.random().toString(36).slice(2, 8);
    // Identity resolution: prefer the caller-provided email (read
    // synchronously from useAuth() in the component tree); fall back
    // to the async getSession() lookup; final fallback is the
    // module-level default. The two-tier order means the React
    // session is the source of truth on every UI-driven write.
    const resolvedTriggeredBy = triggeredBy ?? (await getCurrentMockUserEmail()) ?? "mock-user";
    const entry: ReanalysisEntry = {
      attempt: history.length + 1,
      triggered_at: ts,
      triggered_by: resolvedTriggeredBy,
      reason: request.reason,
      prior_trace_id: priorTraceId,
      prior_shadow_verdict: exc.shadow_verdict,
      prior_final_status: exc.final_status,
      prior_lifecycle_state: exc.lifecycle_state,
      new_trace_id: newTraceId,
      new_shadow_verdict: exc.shadow_verdict,
      new_final_status: exc.final_status,
      new_lifecycle_state: exc.lifecycle_state,
      // ADR-027 Phase B (rev. 3) — preserve the prior attempt's
      // executed-path evidence on the history entry. On the live
      // backend this is the executed_nodes list captured before the
      // current trace overwrites trace_data; on the mock path we
      // pull whatever's seeded for the record so the attempt
      // selector renders a real path instead of the empty banner.
      executed_nodes:
        MOCK_TRACE_ENRICHMENT[id]?.executed_nodes ?? [],
    };
    MOCK_REANALYSIS_HISTORY[id] = [...history, entry];

    // Bug fix: mutate the underlying MOCK_EXCEPTIONS entry so the
    // followup `refreshDetail()` re-fetch (see useExceptionActions.ts
    // ::handleReanalyze) sees the new updated_at instead of reverting
    // to the stale value. Without this the response's fresh ts is
    // overwritten by the next list/detail read. (trace_id is on
    // ExceptionDetail, not the summary, so we don't mutate it here —
    // the mock detail() doesn't return it for summary-derived records
    // anyway.)
    exc.updated_at = ts;

    return {
      ...exc,
      trace_id: newTraceId,
      resolution_data: {},
      reanalysis_history: MOCK_REANALYSIS_HISTORY[id],
      updated_at: ts,
    };
  },

  async challenge(id: string, request: ChallengeRequest): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    // Bug fix: bump updated_at on the underlying entry so a followup
    // refreshDetail() refetch sees the new ts.
    const ts = new Date().toISOString();
    exc.updated_at = ts;
    return {
      ...exc,
      lifecycle_state: "ESCALATED",
      resolution_data: {},
      resolved_by: undefined,
      resolved_action: undefined,
      resolution_notes: `CHALLENGED: ${request.challenge_reason}`,
      updated_at: ts,
    };
  },

  async adminRelease(id: string, request: AdminReleaseRequest): Promise<ExceptionDetailResponse> {
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    // Bug fix: bump updated_at on the underlying entry so a followup
    // refreshDetail() refetch sees the new ts.
    const ts = new Date().toISOString();
    exc.updated_at = ts;
    return {
      ...exc,
      lifecycle_state: "PENDING_ADMIN_REVIEW",
      resolution_data: {},
      resolved_by: undefined,
      resolved_action: undefined,
      resolution_notes: `ADMIN_RELEASE: ${request.release_reason}`,
      updated_at: ts,
    };
  },

  async trace(id: string): Promise<TraceResponse> {
    if (USE_REAL_API) {
      return http<TraceResponse>(`/api/v1/exceptions/${id}/trace`);
    }
    await delay(MOCK_DELAY);
    const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
    if (!exc) throw new Error("Exception not found");
    const isFailed = exc.lifecycle_state === "FAILED";
    // Verdict Pillar 2.3: when the build_analysis node flagged the
    // record AUDIT_CONTEXT_MISSING, the trace carries the structured
    // gap surface. Mock-mode records don't ship in that state today,
    // so both fields are empty/undefined; the live backend
    // populates them when coverage fails.
    const isAuditGap = exc.final_status === "AUDIT_CONTEXT_MISSING";
    const enrichment = MOCK_TRACE_ENRICHMENT[exc.id] ?? {};
    // ADR-027 Phase B — default executed_nodes derivation. When an
    // exception doesn't have a hand-crafted trace seed in
    // MOCK_TRACE_ENRICHMENT, fall back to a generated trace whose
    // shape is keyed off the summary fields. This guarantees every
    // detail page shows a real path on the Vercel preview rather
    // than the "evidence not available" empty-state banner.
    // Hand-crafted seeds still take precedence (they carry richer
    // narrative + sub_spans + policy hits tuned to the canonical
    // Phase D acceptance scenarios).
    const executedNodes =
      enrichment.executed_nodes ?? _defaultExecutedNodes(exc);
    return {
      trace_id: exc.id + "-trace",
      event_id: exc.order_id,
      skill_name: exc.intent ? `${exc.intent}.md` : undefined,
      intent_selected: exc.intent,
      shadow_verdict: exc.shadow_verdict,
      shadow_policy_hits: exc.shadow_verdict === "RED" ? ["PENALTY_MATRIX_VIOLATION"] : [],
      recipe_name: exc.selected_recipe,
      constrained_output_schemas: { intent: "IntentDecision", shadow: "ShadowDecisionSchema" },
      // Mock-mode gateway list reflects the post-2026-04-22 graph
      // (gateway READS run BEFORE shadow per ADR-025), so even a
      // shadow-gated record carries the read-side gateway calls
      // (e.g. oms/get_inventory_snapshot) — only the write-side
      // effects (erp:update_condition_record) are gated on
      // shadow GREEN + recipe success.
      gateway_calls: exc.final_status === "COMPLETE"
        ? ["oms:get_inventory_snapshot", "erp:update_condition_record"]
        : exc.shadow_verdict
          ? ["oms:get_inventory_snapshot"]
          : [],
      backend_fallback: "deterministic_fallback",
      is_fallback_generated: true,
      final_status: exc.final_status,
      explanation: isFailed
        ? "Gateway 'erp:update_condition_record' returned TIMEOUT after 30000ms. Recipe aborted before applying changes; no SAP side effects occurred."
        : isAuditGap
          ? "Audit-bearing fields missing from analysis projection. Record cannot be presented to an operator without authoritative values for these fields — see compliance/audit_bearing_registry.yaml."
          : "Deterministic execution completed successfully.",
      audit_context_missing_class: isAuditGap ? "PriceAnalysisData" : undefined,
      audit_context_missing_fields: isAuditGap ? ["doc_number", "rule_id"] : [],
      ...enrichment,
      // Always emit executed_nodes — derived above so the spread
      // above can't drop it when enrichment doesn't carry one.
      executed_nodes: executedNodes,
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
        // Counts rebalanced after asoe2 retired EXECUTING —
        // the previously-EXECUTING exception now lands RESOLVED.
        RESOLVED: 4,
        PENDING_REVIEW: 2,
        BLOCKED: 1,
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
    if (USE_REAL_API) {
      // Real backend: GET /api/v1/exceptions/{id}/line-items returns
      // `{data: LineItem[]}` per `api/schemas.py::LineItemsResponse`.
      // Empty array is a legitimate response (the recipe emitted no
      // per-line breakdown); the UI's EvidenceGrid handles that.
      const resp = await http<{ data: LineItem[] }>(
        `/api/v1/exceptions/${encodeURIComponent(id)}/line-items`,
      );
      return resp.data ?? [];
    }
    await delay(MOCK_DELAY);
    return MOCK_LINE_ITEMS[id] ?? [];
  },

  /**
   * Enrichment sources (review L2 / H5):
   *   * Backend-backed (real asoe2 populates these via
   *     `api.analysis_adapters`):
   *       - price_hold_analysis (adapt_price_hold)
   *       - edi_mismatch_analysis (adapt_edi_mismatch)
   *   * Mock-only until their adapter lands:
   *       - duplicate_detection, order_comparison, price_analysis,
   *         backorder_analysis, overmax_analysis, moq_analysis,
   *         pallet_analysis, delivery_delay_analysis
   *
   * The mock below populates every enrichment field for demo
   * fidelity. When the UI points at real asoe2, the backend-backed
   * fields flow through AnalysisResponse; the mock-only fields
   * silently collapse because `analysis?.foo` is undefined. Each new
   * adapter unlocks one more section — see asoe2
   * `api/analysis_adapters.py::ANALYSIS_ADAPTERS` for the registry.
   *
   * Tracked in the `NEXT_PUBLIC_SHOW_PREVIEW_INTENTS` backlog
   * (tasks.md) and drift register D18 (ui_architecture.md §9).
   */
  async orderAnalysis(id: string): Promise<OrderAnalysis | null> {
    if (USE_REAL_API) {
      // Real backend returns AnalysisResponse, which is a superset of
      // OrderAnalysis (extra diagnosis/confidence/risk/lines metadata
      // that the section components ignore — they project from the
      // *_analysis enrichment fields). 404 → exception ID not found;
      // surface as null so the caller can render an empty state.
      //
      // The `http()` helper throws a plain Error with message format
      // "<CODE>: <human message>" (see http() body); the backend
      // 404 envelope uses code "NOT_FOUND", and a fallback
      // unstructured response surfaces as "HTTP_404". Match either.
      try {
        return await http<OrderAnalysis>(
          `/api/v1/exceptions/${encodeURIComponent(id)}/analysis`,
        );
      } catch (err) {
        if (
          err instanceof Error &&
          /^(NOT_FOUND|HTTP_404):/.test(err.message)
        ) {
          return null;
        }
        throw err;
      }
    }
    await delay(MOCK_DELAY);
    return MOCK_ORDER_ANALYSES[id] ?? null;
  },
};

/* ── Pipeline topology API (/api/v1/pipeline/topology) ───────────────
   ADR-027 Phase A — backend introspection of the compiled LangGraph.
   Cached client-side by topology_hash; the response is the SHAPE of
   the graph (nodes + edges + verdict labels), not per-record data,
   so it's safe to cache aggressively across users / records. */

const MOCK_PIPELINE_TOPOLOGY: PipelineTopology = {
  topology_hash: "mock-topology-v1",
  nodes: [
    { id: "ingest", label: "ingest", kind: "node" },
    { id: "classify", label: "classify", kind: "node" },
    { id: "load_skill", label: "load_skill", kind: "node" },
    { id: "validate_circuit_breaker", label: "validate_circuit_breaker", kind: "node" },
    { id: "select_recipe", label: "select_recipe", kind: "node" },
    { id: "resolve_dependencies", label: "resolve_dependencies", kind: "node" },
    { id: "validate_types", label: "validate_types", kind: "node" },
    { id: "shadow_audit", label: "shadow_audit", kind: "node" },
    { id: "execute_recipe", label: "execute_recipe", kind: "node" },
    { id: "apply_effects", label: "apply_effects", kind: "node" },
    { id: "build_analysis", label: "build_analysis", kind: "terminal" },
  ],
  edges: [
    { from_node: "ingest", to_node: "classify", conditional: false, verdict_label: null },
    { from_node: "classify", to_node: "load_skill", conditional: false, verdict_label: null },
    { from_node: "classify", to_node: "build_analysis", conditional: true, verdict_label: "cross_check_disagreement" },
    { from_node: "load_skill", to_node: "validate_circuit_breaker", conditional: false, verdict_label: null },
    { from_node: "validate_circuit_breaker", to_node: "build_analysis", conditional: true, verdict_label: "breach" },
    { from_node: "validate_circuit_breaker", to_node: "select_recipe", conditional: true, verdict_label: "ok" },
    { from_node: "select_recipe", to_node: "build_analysis", conditional: true, verdict_label: "no_recipe" },
    { from_node: "select_recipe", to_node: "resolve_dependencies", conditional: true, verdict_label: "ok" },
    { from_node: "resolve_dependencies", to_node: "build_analysis", conditional: true, verdict_label: "required_gw_fail" },
    { from_node: "resolve_dependencies", to_node: "validate_types", conditional: true, verdict_label: "ok" },
    { from_node: "validate_types", to_node: "build_analysis", conditional: true, verdict_label: "invocation_fail" },
    { from_node: "validate_types", to_node: "shadow_audit", conditional: true, verdict_label: "ok" },
    { from_node: "shadow_audit", to_node: "build_analysis", conditional: true, verdict_label: "red" },
    { from_node: "shadow_audit", to_node: "build_analysis", conditional: true, verdict_label: "yellow" },
    { from_node: "shadow_audit", to_node: "execute_recipe", conditional: true, verdict_label: "green" },
    { from_node: "execute_recipe", to_node: "apply_effects", conditional: false, verdict_label: null },
    { from_node: "apply_effects", to_node: "build_analysis", conditional: false, verdict_label: null },
  ],
};

export const pipelineApi = {
  async topology(): Promise<PipelineTopology> {
    if (USE_REAL_API) {
      return http<PipelineTopology>("/api/v1/pipeline/topology");
    }
    await delay(50);
    return MOCK_PIPELINE_TOPOLOGY;
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
  "exc-016": [
    { line_id: "L1", sku: "SKU-9100", description: "Sparkling Water 16oz 12pk", uom: "CS", quantity: 5000, erp_price: 11.50, po_price: 11.50 },
    { line_id: "L2", sku: "SKU-9110", description: "Sparkling Water 20oz 12pk", uom: "CS", quantity: 3200, erp_price: 13.80, po_price: 13.80 },
    { line_id: "L3", sku: "SKU-9120", description: "Electrolyte Blend 12oz 24pk", uom: "CS", quantity: 2400, erp_price: 18.40, po_price: 18.40 },
    { line_id: "L4", sku: "SKU-9130", description: "Flavored Soda 12oz 24pk", uom: "CS", quantity: 1400, erp_price: 15.20, po_price: 15.20 },
  ],
  "exc-017": [
    { line_id: "L1", sku: "SKU-101", description: "12oz Craft Soda Variety 24pk", uom: "CS", quantity: 10, erp_price: 100.00, po_price: 101.00 },
  ],
  "exc-018": [
    { line_id: "L1", sku: "SKU-102", description: "16oz Energy Drink 12pk", uom: "CS", quantity: 50, erp_price: 100.00, po_price: 105.00 },
  ],
  "exc-019": [
    // Unknown-SKU line retains the buyer's intended qty + PO price so
    // the grid shows the nominal blast radius. The SKU does not exist
    // in the material master — hence the "UNKNOWN" marker in the SKU
    // and description fields.
    { line_id: "L1", sku: "SKU-999-UNKNOWN", description: "SKU not in material master — buyer-cited variant of SKU-001", uom: "CS", quantity: 80, erp_price: 63.00, po_price: 63.00 },
  ],
  "exc-020": [
    { line_id: "L1", sku: "SKU-202", description: "32oz Sports Drink 6pk", uom: "CS", quantity: 144, erp_price: 50.00, po_price: 50.00 },
  ],
  "exc-021": [
    { line_id: "L1", sku: "SKU-PRICE-MM", description: "18oz Premium Juice 8pk (Q2 concession)", uom: "CS", quantity: 100, erp_price: 100.00, po_price: 95.00 },
  ],
  "exc-026": [
    { line_id: "L1", sku: "SKU-1101", description: "12oz Cola 24pk", uom: "CS", quantity: 80, erp_price: 22.50, po_price: 22.50 },
    { line_id: "L2", sku: "SKU-1102", description: "12oz Diet Cola 24pk", uom: "CS", quantity: 80, erp_price: 22.50, po_price: 22.50 },
    { line_id: "L3", sku: "SKU-1108", description: "16oz Sparkling Water 12pk", uom: "CS", quantity: 60, erp_price: 18.40, po_price: 18.40 },
    { line_id: "L4", sku: "SKU-1112", description: "20oz Sports Drink 12pk", uom: "CS", quantity: 100, erp_price: 26.00, po_price: 26.00 },
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
  /* ── DELIVERY_DELAY: Pending Review (YELLOW) ──────────────────────────── */
  "exc-016": {
    diagnosis: "Shipment is 6 days behind the contracted delivery window. Root cause is a carrier hub closure in the Southwest corridor. SLA breach is imminent; three alternate routing options available.",
    confidence: 88,
    risk: "HIGH",
    resolution: "ALTERNATE_ROUTING",
    root_cause: "Carrier DHL regional hub closure (weather-driven) — affected all southbound lanes for 48h.",
    recommendation: "Re-route via FedEx Express through Memphis hub; restores ETA to within 1 day of planned, +$620 freight.",
    entity_profile: {
      customer_name: "Target Supply Co",
      bp_number: "BP-TGT-002",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "DC-042 — Dallas",
      region: "Southwest",
    },
    impact_metrics: {
      revenue_at_risk: 48600.00,
      delta_amount: 2430.00,
      delta_percentage: 5.0,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-22T18:00:00Z",
      affected_lines: 4,
    },
    lines: [
      { line_id: "L1", diagnosis: "12,000 CS of grocery SKUs held at DHL Phoenix hub.", resolution: "RE-ROUTE", risk: "MEDIUM", waterfall: [] },
    ],
    delivery_delay_analysis: {
      planned_date: "2026-04-18T00:00:00Z",
      projected_eta: "2026-04-24T00:00:00Z",
      days_late: 6,
      rule_id: "SD-DELAY-002",
      delay_category: "CARRIER_DELAY",
      delay_reason: "DHL Phoenix regional hub was closed Apr 16–18 due to severe weather. 12,000 CS of strategic-tier inventory waiting on outbound line-haul. Ripple effect on 3 downstream POs.",
      affected_lines: 4,
      at_risk: 48600.00,
      carrier: "DHL Ground",
      route: "LGB → PHX → DAL",
      sla_deadline: "2026-04-22T18:00:00Z",
      alternate_options: [
        {
          id: "opt-1",
          type: "EXPEDITE",
          title: "Re-route via FedEx Memphis hub",
          description: "Swap to FedEx Express line-haul through MEM; bypasses affected PHX corridor. ETA Apr 19.",
          new_eta: "2026-04-19T00:00:00Z",
          extra_cost: 620,
          recommended: true,
        },
        {
          id: "opt-2",
          type: "SPLIT_SHIP",
          title: "Partial pickup + priority balance",
          description: "Release 70% from PHX as soon as hub reopens (Apr 20), expedite remaining 30% via UPS 2-Day.",
          new_eta: "2026-04-22T00:00:00Z",
          extra_cost: 280,
          recommended: false,
        },
        {
          id: "opt-3",
          type: "RESCHEDULE",
          title: "Full re-slot to Apr 24 window",
          description: "Customer confirmed flexibility on 2 of 4 SKUs; negotiate revised PO with 6-day push, no premium.",
          new_eta: "2026-04-24T00:00:00Z",
          extra_cost: 0,
          recommended: false,
        },
      ],
    },
  },
  /* ── PRICE_HOLD_RELEASE: Auto-release (GREEN) ────────────────────────
   * Inbound EDI 850 held on pricing-block check. Variance within
   * tolerance — pricing-block released automatically.
   */
  "exc-017": {
    diagnosis: "Inbound PO PO-PHR-001 landed with a pricing block because line 1's PO price ($101.00) deviates +1.0% from the SAP base ($100.00) at Plant 4100. Variance is within the 2.0% auto-release tolerance; pricing block released automatically and order proceeds to delivery.",
    confidence: 96,
    risk: "LOW",
    resolution: "AUTO_RELEASE",
    root_cause: "EDI transmission rounding within contractual tolerance. Pricing block cleared per release policy (2% tolerance, 10% hard-block).",
    recommendation: "No human action required. Block released; outbound delivery scheduled.",
    entity_profile: {
      customer_name: "Walmart Inc",
      bp_number: "BP-WMT-001",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 4100 — Bentonville DC",
      region: "South Central",
    },
    impact_metrics: {
      revenue_at_risk: 1010.00,
      delta_amount: 10.00,
      delta_percentage: 1.0,
      sla_priority: "LOW",
      sla_deadline: "2026-04-18T12:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "PO $101.00 vs SAP base $100.00 (+1.0%). Within ±2.0% release tolerance — rounding-class variance.",
        resolution: "AUTO_RELEASE",
        risk: "LOW",
        waterfall: [
          { type: "BASE",     label: "Base Price (PR00)",       record: "PR00/10",    value: 100.00, running: 100.00, detail: "SAP list price, material group 101, effective 01/01/2026" },
          { type: "CONTRACT", label: "Contract Price (ZA01)",   record: "ZA01/620",   value: 0,      running: 100.00, detail: "Walmart strategic-tier contract #4600019910 — no additional discount at this qty" },
          { type: "RESULT",   label: "PO Price (incoming)",     record: "EDI 850/L1", value: 101.00, running: 101.00, detail: "Variance +$1.00 (+1.0%) vs ERP. Within tolerance; pricing block released." },
        ],
      },
    ],
    price_hold_analysis: {
      hold_status: "RELEASED",
      po_price: 101.00,
      sap_base_price: 100.00,
      variance_pct: 0.01,
      tolerance_pct: 0.02,
      hard_block_pct: 0.10,
      action: "AUTO_RELEASE",
      reason: "Variance +1.0% within tolerance (+2.0%); block released per PriceHoldReleaseRecipe.",
    },
  },
  /* ── PRICE_HOLD_RELEASE: Escalate (YELLOW) ──────────────────────────
   * Variance > tolerance, within hard-block. Manager review required.
   */
  "exc-018": {
    diagnosis: "Inbound PO PO-PHR-002 from Kroger is held on pricing-block check: line 1's PO price ($105.00) deviates +5.0% from the SAP base ($100.00). Above the 2.0% auto-release tolerance, below the 10.0% hard-block ceiling — PriceHoldReleaseRecipe escalated to a manager for review.",
    confidence: 90,
    risk: "MEDIUM",
    resolution: "ESCALATE",
    root_cause: "PO price exceeds auto-release tolerance. Possible customer-side upload error, contract amendment not yet applied, or unauthorized price concession.",
    recommendation: "Manager reviews the variance against Kroger's current contract. Approve to release block or override to reject with buyer notification.",
    entity_profile: {
      customer_name: "Kroger Co",
      bp_number: "BP-KRG-003",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Good",
      location: "Plant 5100 — Cincinnati DC",
      region: "Midwest",
    },
    impact_metrics: {
      revenue_at_risk: 5250.00,
      delta_amount: 250.00,
      delta_percentage: 5.0,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-18T18:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "PO $105.00 vs SAP base $100.00 (+5.0%). Above ±2.0% release tolerance. Current Kroger contract #4600022150 does not carry a price-up clause at this SKU.",
        resolution: "ESCALATE",
        risk: "MEDIUM",
        waterfall: [
          { type: "BASE",     label: "Base Price (PR00)",       record: "PR00/10",    value: 100.00, running: 100.00, detail: "SAP list price, material group 102, effective 01/01/2026" },
          { type: "CONTRACT", label: "Contract Price (ZA01)",   record: "ZA01/620",   value: 0,      running: 100.00, detail: "Kroger strategic-tier contract #4600022150 — base aligned, no +5% clause" },
          { type: "RESULT",   label: "PO Price (incoming)",     record: "EDI 850/L1", value: 105.00, running: 105.00, detail: "Variance +$5.00 (+5.0%). Above tolerance; block held for review." },
          { type: "ERROR",    label: "Pricing Block Check",     record: "VBKD-FAKSK", value: null,   running: null,   detail: "Release tolerance: ±2.0%. Hard-block: ±10.0%.", error: "Escalate to manager — variance above auto-release threshold." },
        ],
      },
    ],
    price_hold_analysis: {
      hold_status: "HELD",
      po_price: 105.00,
      sap_base_price: 100.00,
      variance_pct: 0.05,
      tolerance_pct: 0.02,
      hard_block_pct: 0.10,
      action: "ESCALATE",
      reason: "Variance +5.0% above tolerance (+2.0%); under hard-block (+10.0%). Manager review required.",
    },
  },
  /* ── EDI_MISMATCH: SKU hard reject (RED) ────────────────────────────
   * Inbound PO references a material not in the master. Hard-reject.
   */
  "exc-019": {
    diagnosis: "Target PO PO-EDM-SKU-001 references material SKU-999-UNKNOWN on line 1 — not present in the SAP material master (MARA). Inbound-order validation hard-rejected the line; buyer notification dispatched automatically.",
    confidence: 99,
    risk: "HIGH",
    resolution: "BLOCK_AND_NOTIFY",
    root_cause: "Received SKU does not match any active record in SAP material master. Order cannot be fulfilled as received — either buyer picked a stale SKU or a catalog entry was purged without buyer-side update.",
    recommendation: "Buyer has been notified with the unknown-SKU block. Await corrected PO with the active successor SKU before resuming fulfilment.",
    entity_profile: {
      customer_name: "Target Supply Co",
      bp_number: "BP-TGT-002",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 3200 — Minneapolis DC",
      region: "North Central",
    },
    impact_metrics: {
      // PO nominally references ~80 CS at ~$63/CS per the surrounding
      // line — capturing the nominal revenue so operators see the blast
      // radius even for an unknown SKU.
      revenue_at_risk: 5040.00,
      delta_amount: 5040.00,
      delta_percentage: 100.0,
      sla_priority: "HIGH",
      sla_deadline: "2026-04-18T12:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Expected SKU-001 (active in MARA, material group 201); received SKU-999-UNKNOWN (no MARA record). Qty 80 CS, nominal value $5,040.00.",
        resolution: "BLOCK_AND_NOTIFY",
        risk: "HIGH",
        waterfall: [],
      },
    ],
    edi_mismatch_analysis: {
      sub_type: "SKU_MISMATCH",
      classification: "HARD_REJECT",
      recommended_action: "BLOCK_AND_NOTIFY",
      autonomy_level: "L3",
      expected_value: "SKU-001",
      received_value: "SKU-999-UNKNOWN",
      notification_template: "edi_line_mismatch_blocked",
    },
  },
  /* ── EDI_MISMATCH: QTY review required (YELLOW) ─────────────────────
   * Quantity variance exceeds pallet tolerance. Confirm with buyer.
   */
  "exc-020": {
    diagnosis: "Costco PO PO-EDM-QTY-001 received quantity 144 CS on line 1 instead of the contract-aligned 120 CS (+20%). Variance exceeds pallet-break tolerance; EdiMismatchRecipe flagged for buyer confirmation before release.",
    confidence: 87,
    risk: "MEDIUM",
    resolution: "REQUEST_BUYER_CONFIRMATION",
    root_cause: "Quantity received is 1 pallet layer above the contract forecast. Likely buyer-side PO upsize (seasonal / promo-driven) or an EDI translation error at the 3PL integration.",
    recommendation: "Confirm upsize with Costco's buyer. Approve to fulfil at 144 CS, or override to the contract quantity (120 CS) and flag an exception to the buyer.",
    entity_profile: {
      customer_name: "Costco Wholesale",
      bp_number: "BP-CSC-004",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 7100 — Issaquah DC",
      region: "Pacific NW",
    },
    impact_metrics: {
      revenue_at_risk: 7200.00,
      delta_amount: 1200.00,
      delta_percentage: 20.0,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-18T18:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "Expected qty 120 CS (contract forecast); received 144 CS (+24 CS, +20%). Aligns to 1 pallet-layer over-pull at current pack config.",
        resolution: "REQUEST_BUYER_CONFIRMATION",
        risk: "MEDIUM",
        waterfall: [],
      },
    ],
    edi_mismatch_analysis: {
      sub_type: "QTY_MISMATCH",
      classification: "REVIEW",
      recommended_action: "REQUEST_BUYER_CONFIRMATION",
      autonomy_level: "L2",
      expected_value: 120,
      received_value: 144,
      notification_template: "edi_line_mismatch_inquiry",
    },
  },
  /* ── PRICE_MISMATCH routing fork: lands as CONTRACTUAL_CORRECTION ───
   * Backend classifier routed this EDI_850_LINE_MISMATCH (sub_type
   * PRICE_MISMATCH) to CONTRACTUAL_CORRECTION + PriceAdjustmentRecipe —
   * preserving the single source of truth for pricing (CLAUDE.md §1
   * in asoe2). The UI renders PriceAnalysisSection (not
   * EdiMismatchSection) because only `price_analysis` is populated;
   * edi_mismatch_analysis is absent.
   */
  "exc-021": {
    diagnosis: "Inbound EDI 850 line 1 arrived with a price mismatch: received $95.00 against contract base $100.00 (−5.0%). The asoe2 classifier routed the event to CONTRACTUAL_CORRECTION so PriceAdjustmentRecipe owns the resolution. Variance is within the 15% discount ceiling — GREEN shadow verdict, auto-override applied via YK07 customer-match condition.",
    confidence: 94,
    risk: "LOW",
    resolution: "AUTO_OVERRIDE",
    root_cause: "PO references a Q2 customer-match price concession (ZCUST/404) outside the base pricing condition. Variance within the contractual discount ceiling; auto-override permitted.",
    recommendation: "No human action required. SAP adjusted via YK07 customer-match condition; delivery proceeds at $95.00.",
    entity_profile: {
      customer_name: "Walmart Inc",
      bp_number: "BP-WMT-001",
      customer_tier: "Strategic",
      vip_status: true,
      credit_standing: "Excellent",
      location: "Plant 4100 — Bentonville DC",
      region: "South Central",
    },
    impact_metrics: {
      revenue_at_risk: 9500.00,
      delta_amount: 500.00,
      delta_percentage: 5.0,
      sla_priority: "LOW",
      sla_deadline: "2026-04-18T18:00:00Z",
      affected_lines: 1,
    },
    lines: [
      {
        line_id: "L1",
        diagnosis: "PO $95.00 vs contract base $100.00 (−5.0%). Matches active Q2 customer concession ZCUST/404. Within 15% discount ceiling — auto-override via YK07.",
        resolution: "AUTO_OVERRIDE",
        risk: "LOW",
        waterfall: [
          { type: "BASE",     label: "Base Price (PR00)",        record: "PR00/10",    value: 100.00, running: 100.00, detail: "SAP list price, material group 205, effective 01/01/2026" },
          { type: "CONTRACT", label: "Contract Price (ZA01)",    record: "ZA01/620",   value: 0,      running: 100.00, detail: "Walmart strategic-tier contract #4600019910 — base unchanged" },
          { type: "TPR",      label: "Customer Concession",      record: "ZCUST/404",  value: -5.00,  running: 95.00,  detail: "Q2 customer-match concession. Valid 04/01–06/30/2026." },
          { type: "RESULT",   label: "Override Applied (YK07)",  record: "YK07/55",    value: 0,      running: 95.00,  detail: "Auto-override via customer-match condition. Delta within 15% ceiling." },
        ],
      },
    ],
    price_analysis: {
      erp_unit_price: 100.00,
      po_unit_price: 95.00,
      variance_amount: 5.00,
      variance_pct: 5.0,
      total_at_risk: 9500.00,
      total_quantity: 100,
      uom: "CS",
      doc_type: "Sales Order",
      doc_number: "SO-PM-ROUTING-001",
      sku: "SKU-PRICE-MM",
      material_desc: "Routed from EDI 850 sub_type PRICE_MISMATCH",
      order_date: "2026-04-17T10:00:00Z",
      rule_id: "SO-PRICE-002",
      root_cause_category: "CUSTOMER_CONCESSION",
      contract_ref: "4600019910",
      promotion_ref: "ZCUST/404 (Q2 2026 concession)",
    },
  },
  // MANUAL_ORDER_INTAKE (ADR-034 Phase C) — STANDARD_REVIEW band record.
  // Renders EmailOrderEntrySection via OrderAnalysis.email_order_entry_analysis.
  // The four floor checks all pass; one ambiguous ship-to triggers
  // REQUEST_CLARIFICATION.
  "exc-026": {
    diagnosis: "Non-EDI PO from Southeast Beverage Distributors. Extracted four lines at composite confidence 0.88. All non-disable-able floor checks passed; ambiguous ship-to ('Atlanta DC' resolves to two warehouses) blocks one-click approve. Recipe recommends REQUEST_CLARIFICATION.",
    confidence: 88,
    risk: "LOW",
    resolution: "REQUEST_CLARIFICATION",
    root_cause: "Buyer's PDF cover letter listed ship-to as 'Atlanta DC' which matches two physical warehouses (Atlanta-North, Atlanta-South). Confidence on that single field dropped to 0.62, pulling composite below the 0.95 auto-approve threshold.",
    recommendation: "Send the templated clarification email asking the buyer to confirm Atlanta-North vs Atlanta-South. Auto-approve once a single match is selected.",
    entity_profile: {
      customer_name: "Southeast Beverage Distributors",
      bp_number: "BP-SBD-0042",
      customer_tier: "Mid-Market",
      vip_status: false,
      credit_standing: "Good",
      location: "Plant 2200 — Atlanta DC",
      region: "Southeast",
    },
    impact_metrics: {
      revenue_at_risk: 18_400.00,
      delta_amount: 0,
      delta_percentage: 0,
      sla_priority: "MEDIUM",
      sla_deadline: "2026-04-30T18:00:00Z",
      affected_lines: 4,
    },
    lines: [
      { line_id: "L1", diagnosis: "SKU-1101 — extracted at 0.97, customer SKU mapping confirmed.", resolution: "AUTO_APPROVE", risk: "LOW", waterfall: [] },
      { line_id: "L2", diagnosis: "SKU-1102 — extracted at 0.96, customer SKU mapping confirmed.", resolution: "AUTO_APPROVE", risk: "LOW", waterfall: [] },
      { line_id: "L3", diagnosis: "SKU-1108 — extracted at 0.91, fuzzy SKU match against customer master.", resolution: "AUTO_APPROVE", risk: "LOW", waterfall: [] },
      { line_id: "L4", diagnosis: "Ship-to 'Atlanta DC' — confidence 0.62; matches two warehouses.", resolution: "REQUEST_CLARIFICATION", risk: "MEDIUM", waterfall: [] },
    ],
    email_order_entry_analysis: {
      composite_confidence: 0.88,
      classification: "STANDARD_REVIEW",
      recommended_action: "REQUEST_CLARIFICATION",
      autonomy_level: "L2",
      validation_failures: ["ambiguous_ship_to"],
      floor_breaches: [],
      reject_reason_code: null,
      floor_status: {
        sender_authorized: true,
        customer_resolved: true,
        duplicate_po_clear: true,
        credit_clear: true,
      },
      notification_template: "email_order_clarification_request",
    },
    // ADR-034 Phase G — email source-of-truth substrate (PO-driven IA
    // correction). Renders ABOVE the EmailOrderEntrySection on the
    // detail page so the CSA sees both the source email AND the
    // agent's recommendation on a single surface.
    email_source: {
      from_address: "buyer@southeast-distrib.example",
      received_at: "2026-04-30T10:12:00Z",
      subject: "PO 8842 — May allocation, ship to Atlanta DC",
      body_hash:
        "a7f5e3d1b9c0648f2a1e7c9b4d5e6f3c2a1b0d9e8f7c6b5a4938271605040301",
      attachment_manifest: [
        {
          name: "PO_8842.pdf",
          mime_type: "application/pdf",
          bytes: 184_320,
        },
        {
          name: "ship_to_addresses.csv",
          mime_type: "text/csv",
          bytes: 4_096,
        },
      ],
      body_excerpt:
        "Hi team,\n\nPlease process the attached PO 8842 for our May " +
        "allocation. Ship to the Atlanta DC — full address in the " +
        "CSV. Confirm by EOD Friday.\n\nThanks,\nMarcus Reed",
      source_email_id: "4",
    },
  },
};

/* ============================================================
 * ADR-038 Phase H.6 — case-centric API + mock data
 * ============================================================ */

import type { OrderCase } from "@/types/cases";

/**
 * Mock cases — stand-in until asoe2's V009 / case-store ships in the
 * real backend. Each case parents one or more existing MOCK_EXCEPTIONS
 * via `parent_case_id`. The case list view consumes these directly;
 * detail view loads the case + its child exceptions.
 *
 * The IDs are stable across runs so tests can assert against them.
 */
const MOCK_CASES: OrderCase[] = [
  {
    case_id: "case-001",
    tenant_id: "acme-corp",
    customer_id: "acct-walmart",
    source: "automated_order",
    source_channel: "edi_x12_850",
    customer_po_number: "PO-DUP-001",
    sales_order_id: "SO-DUP-001",
    edi_transaction_id: null,
    source_email_id: null,
    opened_at: "2026-04-21T08:00:00Z",
    closed_at: null,
    status: "OPEN_AWAITING_HUMAN",
    sla_deadline: "2026-04-23T08:00:00Z",
    tier: 2,
    working_memory_summary: null,
    last_compaction_at: null,
    bundle_version_at_open: "duplicate-po@1.0.0",
  },
  {
    case_id: "case-002",
    tenant_id: "acme-corp",
    customer_id: "acct-kroger",
    source: "automated_order",
    source_channel: "edi_x12_850",
    customer_po_number: "PO-PRH-001",
    sales_order_id: "SO-PRH-001",
    edi_transaction_id: null,
    source_email_id: null,
    opened_at: "2026-04-22T10:15:00Z",
    closed_at: null,
    status: "OPEN_AWAITING_HUMAN",
    sla_deadline: "2026-04-22T18:00:00Z",
    tier: 2,
    working_memory_summary: null,
    last_compaction_at: null,
    bundle_version_at_open: "price-hold-release@1.0.0",
  },
  {
    case_id: "case-003",
    tenant_id: "acme-corp",
    customer_id: "acct-target",
    source: "manual_order",
    source_channel: "email",
    customer_po_number: "EML-PO-2026-0042",
    sales_order_id: null,
    edi_transaction_id: null,
    source_email_id: "msg-southeast-001",
    opened_at: "2026-04-23T07:30:00Z",
    closed_at: null,
    status: "OPEN_AWAITING_BUYER",
    sla_deadline: "2026-04-25T07:30:00Z",
    tier: 2,
    working_memory_summary: null,
    last_compaction_at: null,
    bundle_version_at_open: "email-order-entry@1.0.0",
  },
];

/**
 * Cases API (/api/v1/cases/*) — Phase H.6 surface. Backend endpoints
 * landed alongside this surface (asoe2 `api/routes/cases.py`); the
 * `USE_REAL_API=1` branch hits them directly. The mock branch still
 * serves local development and the `/cases` route's preview fixtures.
 * Same `USE_REAL_API` cutover pattern as exceptionsApi.
 */
/**
 * OrderCase + the Phase 28.5.x §D2 derived `child_intents` field.
 * The base OrderCase model is Pydantic `extra="forbid"` so the
 * backend adds child_intents to the response dict, not to the
 * model — the UI's wire type widens here without touching
 * `src/types/cases.ts`. Empty array when the case has no children
 * yet (just-opened Manual Order).
 */
export interface CaseListItem extends OrderCase {
  child_intents: string[];
}

export const casesApi = {
  async list(params?: {
    source?: string;
    /** Multi-value via comma-separated string. */
    status?: string;
    /** Multi-value via comma-separated string. */
    intents?: string;
    /** Recency preset: today | 24h | 7d | 30d. */
    since?: string;
    /** Free-text fuzzy match across PO/SO/customer/case_id. */
    q?: string;
  }): Promise<{ items: CaseListItem[]; total: number }> {
    if (USE_REAL_API) {
      return http<{ items: CaseListItem[]; total: number }>("/api/v1/cases", {
        query: {
          source: params?.source,
          status: params?.status,
          intents: params?.intents,
          since: params?.since,
          q: params?.q,
        },
      });
    }
    await new Promise((r) => setTimeout(r, MOCK_DELAY));
    let items: CaseListItem[] = MOCK_CASES.map((c) => ({
      ...c,
      child_intents: [],  // mock-mode placeholder; live API computes
    }));
    if (params?.source) items = items.filter((c) => c.source === params.source);
    if (params?.status) {
      const statuses = params.status.split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        items = items.filter((c) => statuses.includes(c.status));
      }
    }
    if (params?.intents) {
      // Mock has no children → intent filter selects no cases when used.
      const intents = params.intents.split(",").map((s) => s.trim()).filter(Boolean);
      if (intents.length > 0) items = [];
    }
    if (params?.q) {
      const needle = params.q.toLowerCase();
      items = items.filter((c) =>
        [c.case_id, c.customer_po_number, c.sales_order_id, c.customer_id]
          .some((v) => v && v.toLowerCase().includes(needle)),
      );
    }
    return { items, total: items.length };
  },

  async get(case_id: string): Promise<OrderCase | null> {
    if (USE_REAL_API) {
      return http<OrderCase>(`/api/v1/cases/${encodeURIComponent(case_id)}`);
    }
    await new Promise((r) => setTimeout(r, MOCK_DELAY));
    return MOCK_CASES.find((c) => c.case_id === case_id) ?? null;
  },

  /**
   * GET /api/v1/cases/{id}/records — attached-record loader
   * (Phase 28.5.x §28.5 follow-up).
   *
   * Returns the list of ExceptionDetail-shaped child records
   * (most-recently-updated first) plus a deduped
   * `aggregated_policy_hits` union the CaseDetailPanel feeds into
   * the L1/L2 PolicyHitBadge surface.
   *
   * Mock branch returns the children of the mock case via the
   * pre-existing MOCK_EXCEPTIONS list filtered by parent_case_id;
   * keeps the /cases/[id] preview path working without a live
   * backend.
   */
  async getRecords(case_id: string): Promise<{
    items: ExceptionDetailResponse[];
    total: number;
    aggregated_policy_hits: string[];
  }> {
    if (USE_REAL_API) {
      return http<{
        items: ExceptionDetailResponse[];
        total: number;
        aggregated_policy_hits: string[];
      }>(`/api/v1/cases/${encodeURIComponent(case_id)}/records`);
    }
    await new Promise((r) => setTimeout(r, MOCK_DELAY));
    const items: ExceptionDetailResponse[] = MOCK_EXCEPTIONS
      .filter((e) => e.parent_case_id === case_id)
      .map((summary) => ({
        ...summary,
        resolution_data: {},
        reanalysis_history: [],
      }));
    // Mock doesn't carry persisted traces, so the aggregated set is
    // empty in mock mode. The UI hides the section on empty arrays
    // (Guardrail #6); preview-mode operators see the records stack
    // without the policy-hits panel until they hit the live API.
    return { items, total: items.length, aggregated_policy_hits: [] };
  },
};

/**
 * Visible to architectural-lock tests. The case-source vocabulary is
 * sourced from this constant in the UI; backend `/api/v1/health`
 * gains `allowed_case_sources` in Phase H.7. Until then this is the
 * UI's stable list — but it lives in api.ts (the boundary layer)
 * NOT in page code, preserving Guardrail #1.
 */
export const ALLOWED_CASE_SOURCES = ["manual_order", "automated_order"] as const;

