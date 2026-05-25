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
  LEGACY_GLOBAL_REASON_TAGS,
} from "./__generated__/curated_reason_tags";
import { ROLE_PERMISSIONS } from "./roles";
// ADR-041 P5 — bulky mock fixtures moved out so api.ts stays
// readable. Same identifier; only the location changed. The
// `USE_REAL_API` branch on `exceptionsApi.orderAnalysis` doesn't
// touch this — it hits `/api/v1/exceptions/{id}/analysis`
// directly.
import { MOCK_ORDER_ANALYSES } from "./mock-data/order-analyses";
import {
  MOCK_EXCEPTIONS,
  persistMockExceptionMutation,
} from "./mock-data/exceptions";
import { deriveMockCases } from "./mock-data/cases";
import { MOCK_LINE_ITEMS } from "./mock-data/line-items";
import { mockAttachmentBlob } from "./mock-data/attachment-bytes";
import type { OrderCase } from "@/types/cases";

// Mirrors asoe2/constraints/specs.py::is_valid_reason_tag_for_write.
// Curated intents narrow the vocab to their per-intent UPPERCASE
// set; non-curated / unknown intents fall through to the LEGACY
// global lowercase pool only (matches asoe2's `_GLOBAL_REASON_TAGS`
// fallback — not the union of every curated tag). Never silently
// upper-cases.
export function isValidReasonTagForWrite(
  intent: string | undefined | null,
  tag: string,
): boolean {
  if (intent && intent in ALLOWED_OVERRIDE_REASON_TAGS_BY_INTENT) {
    const curated = ALLOWED_OVERRIDE_REASON_TAGS_BY_INTENT[intent];
    return curated.includes(tag);
  }
  return (LEGACY_GLOBAL_REASON_TAGS as readonly string[]).includes(tag);
}

// Read-side grandfathering: historical audit-log rows may carry
// any tag the wire envelope (AllowedOverrideReasonTag) ever included.
// Used by trace / events renderers, never by write paths.
export function isValidReasonTagForRead(tag: string): boolean {
  return (ALLOWED_OVERRIDE_REASON_TAGS as readonly string[]).includes(tag);
}

// Terminal lifecycle states reject every HITL disposition (mirrors
// asoe2/api/routes/exceptions.py::PATCH /disposition gating). The
// backend returns 409 (`LIFECYCLE_LOCKED`); the mock throws an
// Error with the same code prefix so the UI's toast renderer
// doesn't fork on mode.
export const TERMINAL_LIFECYCLE_STATES: readonly string[] = [
  "FAILED",
  "RESOLVED",
  "BLOCKED",
  "REJECTED",
  "CLOSED",
];

export function isTerminalLifecycle(state: string | undefined | null): boolean {
  return !!state && TERMINAL_LIFECYCLE_STATES.includes(state);
}

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

// S10: in-process event log for mock state changes. Disposition,
// escalate, cosign, and reanalyze each append a `case_*` event
// here on success. The log is the testable surface for the
// "mock matches live event emission" contract — pages don't yet
// consume it through useWebSocket (that's a future ticket), but
// tests can drain the log and assert the right type / case_id /
// payload landed for each mock state change.
interface MockEmittedEvent {
  type: "case_open" | "case_update" | "case_close";
  case_id: string;
  exception_id: string;
  tenant_id: string;
  timestamp: string;
  trigger: "disposition" | "escalate" | "cosign" | "reanalyze";
}

const _mockEmittedEvents: MockEmittedEvent[] = [];

function emitMockCaseEvent(event: MockEmittedEvent): void {
  _mockEmittedEvents.push(event);
}

export function drainMockCaseEvents(): MockEmittedEvent[] {
  return _mockEmittedEvents.splice(0, _mockEmittedEvents.length);
}

export function peekMockCaseEvents(): readonly MockEmittedEvent[] {
  return [..._mockEmittedEvents];
}

export type { MockEmittedEvent };

// `case_close` is the right type when the disposition or cosign
// transitions to a terminal state; `case_update` is the right type
// for non-terminal mutations (escalate, reanalyze, in-flight
// changes). Mirrors asoe2 case-events emission rules at
// asoe2/api/case_events.py.
function caseEventTypeForLifecycle(
  state: string | undefined,
): "case_close" | "case_update" {
  return state && TERMINAL_LIFECYCLE_STATES.includes(state)
    ? "case_close"
    : "case_update";
}


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

/* ── Per-record overrides for the verdict-template trace helpers.
   The shared helpers below hardcode example values for fields the
   trace surface should reflect from the actual record (order_id,
   intent, skill_name, classifier confidence). Without these
   overrides, every YELLOW record's pipeline timeline reports
   confidence=0.86 regardless of what the AgentReasoningCard renders
   from `OrderAnalysis.confidence` — a Verdict 2026-04-22 partial-
   truth violation. `_defaultExecutedNodes` derives these from the
   ExceptionSummary + MOCK_ORDER_ANALYSES; the hand-crafted
   MOCK_TRACE_ENRICHMENT call sites pass them via `_overridesFromId`. */
interface _TraceOverrides {
  orderId?: string;
  intent?: string;
  skillName?: string;
  /** 0-1 fraction. Maps to OrderAnalysis.confidence / 100. */
  confidence?: number;
}

function _greenAutoResolvedTrace(
  recipeName: string,
  overrides: _TraceOverrides = {},
): import("@/types/api").ExecutedNode[] {
  const orderId = overrides.orderId ?? "SO-1042";
  const intent = overrides.intent ?? "CONTRACTUAL_CORRECTION";
  const skillName = overrides.skillName ?? "pricing-discrepancy";
  const confidence = overrides.confidence ?? 0.91;
  return [
    _node("ingest", 0, 4, { decision: { order_id: orderId } }),
    _node("classify", 4, 38, {
      decision: { intent, confidence },
      exit_verdict: "ok",
    }),
    _node("load_skill", 42, 6, {
      decision: { skill_name: skillName },
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
  overrides: _TraceOverrides = {},
): import("@/types/api").ExecutedNode[] {
  const orderId = overrides.orderId ?? "SO-1042";
  const intent = overrides.intent ?? "CONTRACTUAL_CORRECTION";
  const skillName = overrides.skillName ?? "pricing-discrepancy";
  const confidence = overrides.confidence ?? 0.86;
  return [
    _node("ingest", 0, 4, { decision: { order_id: orderId } }),
    _node("classify", 4, 36, {
      decision: { intent, confidence },
      exit_verdict: "ok",
    }),
    _node("load_skill", 40, 6, {
      decision: { skill_name: skillName },
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
  overrides: _TraceOverrides = {},
): import("@/types/api").ExecutedNode[] {
  const orderId = overrides.orderId ?? "PO-EDM-SKU-001";
  const intent = overrides.intent ?? "EDI_MISMATCH";
  const skillName = overrides.skillName ?? "edi-mismatch";
  const confidence = overrides.confidence ?? 0.94;
  return [
    _node("ingest", 0, 4, { decision: { order_id: orderId } }),
    _node("classify", 4, 31, {
      decision: { intent, confidence },
      exit_verdict: "ok",
    }),
    _node("load_skill", 35, 5, {
      decision: { skill_name: skillName },
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
  // Per-record overrides for the verdict-template traces. The
  // classifier confidence is sourced from the matching
  // OrderAnalysis fixture (0-100) and normalised to 0-1 so it
  // matches what AgentReasoningCard renders from
  // `analysis.confidence`. Without this, every YELLOW record's
  // pipeline timeline reports confidence=0.86 regardless of the
  // recommendation card — a Verdict 2026-04-22 partial-truth
  // violation.
  const analysis = MOCK_ORDER_ANALYSES[exc.id];
  const overrides: _TraceOverrides = {
    orderId: exc.order_id,
    intent: exc.intent,
    skillName: exc.intent?.toLowerCase().replace(/_/g, "-"),
    confidence:
      typeof analysis?.confidence === "number"
        ? analysis.confidence / 100
        : undefined,
  };

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
    return _redBlockedTrace(recipe, overrides);
  }

  // YELLOW-shadowed records halt at shadow_audit with the YELLOW
  // verdict; covers MANUAL_REVIEW_REQUIRED, ESCALATED, and the
  // cosign / admin review paths.
  if (
    exc.shadow_verdict === "YELLOW"
    || exc.final_status === "MANUAL_REVIEW_REQUIRED"
    || exc.final_status === "REJECTED"
  ) {
    return _yellowHitlTrace(recipe, overrides);
  }

  // GREEN auto-resolved (COMPLETE, RESOLVED, CLOSED).
  if (
    exc.shadow_verdict === "GREEN"
    || exc.final_status === "COMPLETE"
    || exc.lifecycle_state === "RESOLVED"
    || exc.lifecycle_state === "CLOSED"
  ) {
    return _greenAutoResolvedTrace(recipe, overrides);
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
  return _greenAutoResolvedTrace(recipe, overrides);
}

/** Look up `_TraceOverrides` for an exception id from the MOCK_*
 *  fixtures. Used by the hand-crafted MOCK_TRACE_ENRICHMENT entries
 *  below so they inherit the same per-record overrides
 *  `_defaultExecutedNodes` applies — keeping the AgentReasoningCard
 *  (analysis.confidence) and the Pipeline timeline (trace.classify.
 *  decision.confidence) in lock-step for the same decision. */
function _overridesFromId(id: string): _TraceOverrides {
  const exc = MOCK_EXCEPTIONS.find((e) => e.id === id);
  const analysis = MOCK_ORDER_ANALYSES[id];
  return {
    orderId: exc?.order_id,
    intent: exc?.intent,
    skillName: exc?.intent?.toLowerCase().replace(/_/g, "-"),
    confidence:
      typeof analysis?.confidence === "number"
        ? analysis.confidence / 100
        : undefined,
  };
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
    executed_nodes: _yellowHitlTrace("PriceAdjustmentRecipe.py", _overridesFromId("exc-002")),
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
    executed_nodes: _yellowHitlTrace("MOQRoundUpRecipe.py", _overridesFromId("exc-013")),
  },
  // GREEN autonomous-resolved sample (Phase D acceptance trace #1)
  "exc-011": {
    executed_nodes: _greenAutoResolvedTrace("BackOrderResolutionRecipe.py", _overridesFromId("exc-011")),
  },
  // GREEN autonomous-resolved on the price-hold-release path (uses
  // the same trace shape; recipe label differs).
  "exc-017": {
    executed_nodes: _greenAutoResolvedTrace("PriceHoldReleaseRecipe.py", _overridesFromId("exc-017")),
  },
  // RED BLOCKED sample (Phase D acceptance trace #3)
  "exc-019": {
    executed_nodes: _redBlockedTrace("EdiMismatchRecipe.py", _overridesFromId("exc-019")),
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
    executed_nodes: _yellowHitlTrace("EmailOrderEntryRecipe.py", _overridesFromId("exc-026")),
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
  allowed_recipes: ["PriceAdjustmentRecipe.py", "CreditHoldReleaseRecipe.py", "DuplicatePORecipe.py", "BackOrderResolutionRecipe.py", "OverMaxTrimRecipe.py", "MOQRoundUpRecipe.py", "PalletAlignmentRecipe.py", "DeliveryDelayResolutionRecipe.py", "PriceHoldReleaseRecipe.py", "EdiMismatchRecipe.py", "EmailOrderEntryRecipe.py", "ManualOrderIntakeRecipe.py", "SubmitToErpRecipe.py", "ReplyDraftRecipe.py"],
  // Mirrors asoe2/constraints/specs.py AllowedResolutionAction. Backend is
  // authoritative at runtime (/api/v1/health); this mock list exists only for
  // local development.
  allowed_resolution_actions: ["BLOCK_AND_NOTIFY", "MERGE", "SUPERSEDE", "ALLOW_BOTH", "ESCALATE", "REQUEST_BUYER_CONFIRMATION", "ONE_CLICK_APPROVE", "STANDARD_REVIEW", "LOW_CONFIDENCE_FLAG", "AUTO_CORRECT", "REQUEST_CLARIFICATION", "REJECT", "SUBMIT_TO_ERP", "DRAFT_REPLY", "SEND_REPLY"],
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

/* ── Attachments API (/api/v1/cases/{id}/attachments/{id}) ─────────── */

export const attachmentsApi = {
  /**
   * Fetch a stored attachment's raw bytes (ADR-043). The single place the UI
   * reads attachment bytes — the AttachmentPreview component calls this rather
   * than touching `fetch` itself (CLAUDE.md engineering rule + Guardrail #6).
   * Auth is the same bearer-token path as `http`; the byte stream is returned
   * as a Blob (not JSON), so it bypasses the JSON error-envelope wrapper.
   *
   * Mock mode synthesises TYPE-CORRECT bytes (a real PDF for a .pdf, etc.) so a
   * downloaded mock file opens; `NEXT_PUBLIC_USE_REAL_API=1` fetches the real
   * bytes from the RBAC-gated download endpoint. Pass `mimeType`/`fileName` so
   * mock mode can pick the right shape (ignored on the real path).
   */
  async getBlob(
    caseId: string,
    attachmentId: string,
    opts: { authToken?: string; mimeType?: string; fileName?: string; evidenceText?: string[] } = {},
  ): Promise<Blob> {
    if (!USE_REAL_API) {
      return mockAttachmentBlob({
        caseId,
        attachmentId,
        mimeType: opts.mimeType,
        fileName: opts.fileName,
        evidenceText: opts.evidenceText,
      });
    }
    const token = opts.authToken ?? getTestAccessToken() ?? (await getAuthToken());
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const url =
      `${API_URL}/api/v1/cases/${encodeURIComponent(caseId)}` +
      `/attachments/${encodeURIComponent(attachmentId)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`ATTACHMENT_FETCH_FAILED: ${res.status}`);
    }
    return res.blob();
  },
};

/* ── Exceptions API (/api/v1/exceptions/*) ─────────────────────────── */

export const exceptionsApi = {
  /**
   * DoR #11 — automation-bias telemetry. Reports one operator decision's
   * dwell + whether Layer-2 evidence was opened. Best-effort: never throws into
   * the UI, and is a no-op in mock mode. Called once per disposition.
   */
  async reportReviewerActivity(input: {
    dwell_ms: number;
    layer2_opened: boolean;
  }): Promise<void> {
    if (!USE_REAL_API) return;
    try {
      await http<{ ok: boolean }>("/api/v1/metrics/reviewer-activity", {
        method: "POST",
        body: input,
      });
    } catch {
      // best-effort telemetry — never surface to the operator
    }
  },

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
    // The recipe's recommended action lives on `resolution_data`
    // (the live backend's build_analysis writes it there). The mock
    // sources it from the order analysis's top-level `resolution`
    // field — the same enum the operator sees in the Agent
    // Recommendation card. Without it, `useExceptionActions.handleApprove`
    // has nothing to endorse and short-circuits with "No recipe
    // recommendation — use Override", so Approve appears to do nothing
    // on the mock preview.
    const recommended = MOCK_ORDER_ANALYSES[id]?.resolution;
    return {
      ...exc,
      resolution_data: {
        ...(exc.final_status === "COMPLETE" ? {
          credit_amount: 1250.00,
          applied_condition: "YK07",
          new_net_price: 85.00,
        } : {}),
        ...(recommended ? { recommended_action: recommended } : {}),
      },
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

    // Mutate the underlying MOCK_EXCEPTIONS row so a followup
    // refetch reads the cosign outcome. Approve drives to RESOLVED;
    // reject restores the lifecycle the override was staged from.
    // (See the parallel comment on `disposition` for the historical
    // why — same fix.)
    const ts = new Date().toISOString();
    const nextLifecycle = request.approve
      ? "RESOLVED"
      : pending.from_lifecycle_state;
    exc.lifecycle_state = nextLifecycle;
    if (request.approve) exc.final_status = "COMPLETE";
    exc.updated_at = ts;
    persistMockExceptionMutation(id, {
      lifecycle_state: nextLifecycle,
      ...(request.approve ? { final_status: "COMPLETE" as const } : {}),
      updated_at: ts,
    });

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
    emitMockCaseEvent({
      type: caseEventTypeForLifecycle(response.lifecycle_state),
      case_id: `case-for-${exc.id}`,
      exception_id: exc.id,
      tenant_id: exc.tenant_id,
      timestamp: ts,
      trigger: "cosign",
    });
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
    // S9: terminal-state gate. Disposition is not allowed once the
    // record has reached a terminal lifecycle (asoe2 returns 409
    // LIFECYCLE_LOCKED).
    if (isTerminalLifecycle(exc.lifecycle_state)) {
      throw new Error(
        `LIFECYCLE_LOCKED: disposition not allowed on terminal record (lifecycle ${exc.lifecycle_state})`,
      );
    }
    if (!request.notes || !request.notes.trim()) {
      throw new Error("NOTES_REQUIRED: notes are required (SOX audit trail).");
    }
    // S8: mirror asoe2's is_valid_reason_tag_for_write so the mock
    // rejects lowercase legacy tags for curated intents, exactly as
    // the live backend does. Error shape matches the asoe2 422
    // payload so the UI's toast renderer doesn't fork on mode.
    if (!isValidReasonTagForWrite(exc.intent, request.reason_tag)) {
      throw new Error(
        `INVALID_REASON_TAG: reason_tag '${request.reason_tag}' is not allowed for intent ${exc.intent ?? "<unknown>"}`,
      );
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
    // Mutate the underlying MOCK_EXCEPTIONS entry so the followup
    // refetch (handleRecordActionComplete on /cases, the WS-driven
    // refetch on /home + /dashboard) sees the new lifecycle.
    //
    // Historical note: this used to mutate only `updated_at` to
    // avoid cross-test leak in the shared MOCK_EXCEPTIONS array.
    // That trade-off was fine until PR #174 wired post-action
    // refetch on /cases — at which point the refetch read the
    // un-mutated row and "reverted" the queue + case header to
    // PENDING_REVIEW, surfacing as "Approve / Override doesn't
    // work" on the Vercel mock preview. We now mutate fully and
    // restore the seed between tests via `resetMockExceptions()`
    // wired into `tests/setup.ts`.
    exc.lifecycle_state = newLifecycle;
    exc.final_status = response.final_status;
    exc.updated_at = ts;
    // Persist so the disposition survives a page reload (otherwise the
    // queue / case header / /home tiles snap back to the seed lifecycle
    // on the next full load — the cross-reload half of the state-drift).
    persistMockExceptionMutation(id, {
      lifecycle_state: newLifecycle,
      final_status: response.final_status,
      updated_at: ts,
    });
    emitMockCaseEvent({
      type: caseEventTypeForLifecycle(newLifecycle),
      case_id: `case-for-${exc.id}`,
      exception_id: exc.id,
      tenant_id: exc.tenant_id,
      timestamp: ts,
      trigger: "disposition",
    });
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
    // Mutate the underlying MOCK_EXCEPTIONS row so a followup
    // refetch reads the new lifecycle. (See the parallel comment
    // on `disposition` for the historical why — same fix.)
    const ts = new Date().toISOString();
    const response: ExceptionDetailResponse = {
      ...exc,
      lifecycle_state: "ESCALATED",
      resolution_data: {},
      resolution_notes: `ESCALATED: ${request.reason}`,
      updated_at: ts,
    };
    exc.lifecycle_state = "ESCALATED";
    exc.updated_at = ts;
    persistMockExceptionMutation(id, {
      lifecycle_state: "ESCALATED",
      updated_at: ts,
    });
    emitMockCaseEvent({
      type: "case_update",
      case_id: `case-for-${exc.id}`,
      exception_id: exc.id,
      tenant_id: exc.tenant_id,
      timestamp: ts,
      trigger: "escalate",
    });
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
    emitMockCaseEvent({
      type: "case_update",
      case_id: `case-for-${exc.id}`,
      exception_id: exc.id,
      tenant_id: exc.tenant_id,
      timestamp: ts,
      trigger: "reanalyze",
    });

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
    /** Filter by case_type (EMAIL_ENTRY | BLOCK) — the Customer Inbox lens
     *  (ADR-042). Orthogonal to `source` (ADR-041 §1). */
    case_type?: string;
    /** Multi-value via comma-separated string. */
    status?: string;
    /** Multi-value via comma-separated string. */
    intents?: string;
    /** Recency preset: today | 24h | 7d | 30d. */
    since?: string;
    /** Free-text fuzzy match across PO/SO/customer/case_id. */
    q?: string;
    /** Page size. Backend default 200, max 500
     *  (asoe2/api/routes/cases.py::list_cases::limit). */
    limit?: number;
    /** Pagination cursor. Opaque page-anchor token returned in
     *  `cursor` on the previous response when `has_more` is true.
     *  Clients loop `do { fetch } while (cursor)` until exhausted —
     *  see `useCases` for the canonical consumer. ADR-038 §D7
     *  amendment (2026-05-11). */
    cursor?: string;
  }): Promise<{
    items: CaseListItem[];
    total: number;
    cursor: string | null;
    has_more: boolean;
  }> {
    if (USE_REAL_API) {
      return http<{
        items: CaseListItem[];
        total: number;
        cursor: string | null;
        has_more: boolean;
      }>("/api/v1/cases", {
        query: {
          source: params?.source,
          case_type: params?.case_type,
          status: params?.status,
          intents: params?.intents,
          since: params?.since,
          q: params?.q,
          limit: params?.limit,
          cursor: params?.cursor,
        },
      });
    }
    await new Promise((r) => setTimeout(r, MOCK_DELAY));
    let items: CaseListItem[] = deriveMockCases().map((c) => ({
      ...c,
      child_intents: [],  // mock-mode placeholder; live API computes
    }));
    if (params?.source) items = items.filter((c) => c.source === params.source);
    if (params?.case_type) {
      items = items.filter((c) => c.case_type === params.case_type);
    }
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
    // Stable sort to match the backend (opened_at DESC, case_id
    // DESC tiebreak). Cursor determinism requires a total ordering.
    items.sort((a, b) => {
      if (a.opened_at !== b.opened_at) {
        return a.opened_at < b.opened_at ? 1 : -1;
      }
      return a.case_id < b.case_id ? 1 : a.case_id > b.case_id ? -1 : 0;
    });
    const total = items.length;
    // Apply backend-parity limit (default 200, max 500). The mock
    // mirrors the asoe2 contract.
    const requestedLimit = params?.limit ?? 200;
    const limit = Math.max(1, Math.min(500, requestedLimit));
    // Cursor-anchored slicing. Unknown cursors fall through to
    // start-of-list — matches asoe2 grandfathered behaviour for
    // stale tokens (api/routes/cases.py::list_cases).
    let start = 0;
    if (params?.cursor) {
      const cursorIdx = items.findIndex((c) => c.case_id === params.cursor);
      if (cursorIdx >= 0) start = cursorIdx + 1;
    }
    const page = items.slice(start, start + limit);
    const has_more = start + limit < total;
    const nextCursor = has_more && page.length > 0
      ? page[page.length - 1].case_id
      : null;
    return { items: page, total, cursor: nextCursor, has_more };
  },

  async get(case_id: string): Promise<OrderCase | null> {
    if (USE_REAL_API) {
      return http<OrderCase>(`/api/v1/cases/${encodeURIComponent(case_id)}`);
    }
    await new Promise((r) => setTimeout(r, MOCK_DELAY));
    return deriveMockCases().find((c) => c.case_id === case_id) ?? null;
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

