/**
 * Case-level shared constants and helpers (Phase 28.5.x §D1).
 *
 * Consolidates four duplicate `STATUS_LABEL` maps that the V5.1
 * reshape left scattered across `/cases/page.tsx`,
 * `/cases/CaseDetailPanel.tsx`, `/exceptions/page.tsx`, and
 * `/inbox/page.tsx`. The map is the visual mapping function per
 * CLAUDE.md Guardrail #1 — vocabulary itself comes from
 * `useHealth().allowed_case_statuses`.
 *
 * Adding a new `CaseStatus` literal in the backend requires:
 *   1. Update `contracts/models.py::CaseStatus`.
 *   2. The next `npm run generate-types` round-trips `allowed_case_statuses`.
 *   3. Add a label entry below for the new value.
 * No `.tsx` file should ever switch on a status literal.
 */
import type { CaseStatus } from "@/types/cases";
import type { AutonomyLevelInfo, HealthResponse } from "@/types/exceptions";

/**
 * The seven case statuses grouped into three operator-meaningful
 * clusters (Phase 28.5.x §D1). Domain-SME-validated grouping:
 *
 *   * Live      — the agent is actively working OR an operator
 *                  action is needed right now.
 *   * Waiting   — the case is blocked by an external party
 *                  (buyer / ERP) and the operator can't push it
 *                  forward without that party's response.
 *   * Terminal  — the case has closed.
 *
 * The cluster keys are stable; the per-cluster status arrays can
 * grow when the backend adds new statuses (a new value falls into
 * the "Terminal" cluster by default and the workshop minutes
 * cover any reclassification).
 */
export const CASE_STATUS_CLUSTERS: Readonly<
  Record<"Live" | "Waiting" | "Terminal", readonly CaseStatus[]>
> = {
  Live: ["OPEN_AGENT_PROCESSING", "OPEN_AWAITING_HUMAN"],
  Waiting: ["OPEN_AWAITING_BUYER", "OPEN_AWAITING_ERP"],
  Terminal: ["RESOLVED", "FAILED", "BLOCKED"],
} as const;

/**
 * Human-readable label per `CaseStatus`. Falls back to the literal
 * itself when a backend addition lands ahead of a UI label entry —
 * the chip stays functional (no crash) while the warning surfaces
 * in code review.
 */
export const STATUS_LABEL: Readonly<Record<string, string>> = {
  OPEN_AGENT_PROCESSING: "Agent processing",
  OPEN_AWAITING_HUMAN: "Awaiting review",
  OPEN_AWAITING_BUYER: "Awaiting buyer",
  OPEN_AWAITING_ERP: "Awaiting ERP",
  RESOLVED: "Resolved",
  FAILED: "Failed",
  BLOCKED: "Blocked",
};

/**
 * Phase 28.5.x §D1 — replaces the two hardcoded
 * `c.status === "OPEN_AWAITING_HUMAN"` comparisons that the
 * lens audit found in `/exceptions/page.tsx` and `/inbox/page.tsx`.
 * Guardrail #1 forbids embedding the literal in page code; this
 * helper is the single place that knows about the value.
 */
export function isAwaitingHuman(status: string | null | undefined): boolean {
  return status === "OPEN_AWAITING_HUMAN";
}

/**
 * Predicate for the Terminal cluster — used by the V5.1.1 filter
 * chip bar's default ("Open cases only" view hides Terminal until
 * the operator clicks the cluster chip).
 */
export function isTerminalStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (CASE_STATUS_CLUSTERS.Terminal as readonly string[]).includes(status);
}

/**
 * Pretty-print a free-form `source_channel` string from the backend
 * (issue #133, PO points #10 / #12). The backend emits raw machine
 * identifiers like `edi_x12_850`, `email`, `non_edi`, `phone`,
 * `fax`; renderers used to forward those verbatim through an
 * `uppercase` Tailwind class, producing strings like "NON_EDI" that
 * the PO flagged as both ugly and semantically opaque.
 *
 * Guardrail #1 — this is a visual mapping function with a
 * default-fallback. Adding a new channel in the backend keeps
 * working (falls into the default branch: underscores → spaces,
 * sentence case) while well-known channels render with the right
 * casing on technical acronyms.
 */
const KNOWN_CHANNEL_LABELS: Readonly<Record<string, string>> = {
  email: "Email",
  fax: "Fax",
  phone: "Phone",
  edi: "EDI",
  edi_x12_850: "EDI 850",
  edi_x12_855: "EDI 855",
  edi_x12_856: "EDI 856",
  edi_x12_810: "EDI 810",
  non_edi: "Non-EDI email",
  manual: "Manual entry",
  api: "API",
};

export function sourceChannelLabel(channel: string | null | undefined): string {
  if (!channel) return "Unknown channel";
  const known = KNOWN_CHANNEL_LABELS[channel.toLowerCase()];
  if (known) return known;
  return channel
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Autonomy levels (issue #133, PO point #15) are recipe-action-driven
 * enums sourced from `asoe2/contracts/policy.py` (`L1`–`L4`). The PO
 * complained that the bare letter codes leak through to the operator
 * with no plain-language meaning. This map adds a single-sentence
 * caption per level; unknown values fall back to the bare code so
 * the UI never crashes when the backend adds an `L5` ahead of a label.
 *
 * Source of truth for the underlying business meaning:
 *   `asoe2/contracts/policy.py` — DUPLICATE_PO_AUTONOMY_LEVELS,
 *   EMAIL_ORDER_ENTRY_AUTONOMY_LEVELS.
 */
// Transition fallback only (ADR-042 §5 item 2). The authoritative autonomy
// vocabulary — labels AND ordering — now comes from
// `health.allowed_autonomy_levels` (rank-sorted), so the UI never hardcodes
// the ladder (Guardrail #1). This map survives only for the window before a
// caller has a health payload.
const AUTONOMY_LEVEL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  L1: "Block automatically — operator decides",
  L2: "Recommend — operator approves",
  L3: "One-click approve — operator confirms",
  L4: "Fully automated — audit only",
};

type HealthAutonomy = Pick<HealthResponse, "allowed_autonomy_levels"> | null | undefined;

/**
 * The autonomy ladder ordered most-autonomous first, driven by the `rank`
 * the backend serves on `health.allowed_autonomy_levels` (ADR-042 §5/§8 —
 * higher rank == more automation). Returns `[]` in the transition window
 * before the backend ships the field. The UI sorts by this, never by a
 * hardcoded map (Guardrail #1).
 */
export function autonomyLevelsByRank(health: HealthAutonomy): AutonomyLevelInfo[] {
  const levels = health?.allowed_autonomy_levels ?? [];
  return [...levels].sort((a, b) => b.rank - a.rank);
}

/**
 * Plain-language label for an autonomy level. Prefers the backend-served
 * label from `health.allowed_autonomy_levels` (Guardrail #1); falls back to
 * the transition map when no health payload is supplied, and finally to the
 * bare code so the UI never crashes on an unknown level.
 */
export function autonomyLevelLabel(
  level: string | null | undefined,
  health?: HealthAutonomy,
): string {
  if (!level) return "Unknown autonomy";
  const fromHealth = health?.allowed_autonomy_levels?.find(
    (l) => l.level === level,
  )?.label;
  if (fromHealth) return `${level} — ${fromHealth}`;
  const desc = AUTONOMY_LEVEL_DESCRIPTIONS[level];
  return desc ? `${level} — ${desc}` : level;
}

/**
 * Map a recipe `recommended_action` enum value to an operator-meaningful
 * primary-button label and a short caption that explains the consequence
 * of clicking it (issue #133, PO point #11 — "What does Approve mean
 * when the AI action is to draft an email?").
 *
 * Guardrail #1 — visual mapping function with a default-fallback. New
 * actions added in the backend keep working (rendered as "Apply
 * recommendation" with the raw token as the caption).
 */
export interface ActionLabel {
  primary: string;
  /** Optional one-line caption explaining the action's effect. */
  caption?: string;
  /** Optional explicit "discard" label for the secondary button. */
  secondary?: string;
}

const ACTION_LABELS: Readonly<Record<string, ActionLabel>> = {
  ONE_CLICK_APPROVE: {
    primary: "Approve order",
    caption: "Posts the order to the ERP with the agent's extraction.",
    secondary: "Reject",
  },
  REQUEST_CLARIFICATION: {
    primary: "Send draft to buyer",
    caption: "Sends the drafted clarification email to the buyer contact.",
    secondary: "Discard draft",
  },
  REQUEST_BUYER_CONFIRMATION: {
    primary: "Send draft to buyer",
    caption: "Sends the drafted confirmation email to the buyer contact.",
    secondary: "Discard draft",
  },
  BLOCK_AND_NOTIFY: {
    primary: "Block and notify",
    caption: "Blocks the order and emails the buyer with the reason.",
    secondary: "Override block",
  },
  MERGE: {
    primary: "Merge with existing",
    caption: "Links this PO to the existing order; no new case is created.",
    secondary: "Keep separate",
  },
  SUPERSEDE: {
    primary: "Supersede existing",
    caption: "Replaces the existing order with this one and notifies the buyer.",
    secondary: "Keep both",
  },
  ALLOW_BOTH: {
    primary: "Allow both",
    caption: "Treats both POs as distinct orders.",
    secondary: "Reject this one",
  },
  ESCALATE: {
    primary: "Escalate to manager",
    caption: "Routes the case to a manager queue for review.",
    secondary: "Resolve myself",
  },
  STANDARD_REVIEW: {
    primary: "Approve order",
    caption: "Operator verifies extraction before posting to the ERP.",
    secondary: "Reject",
  },
  LOW_CONFIDENCE_FLAG: {
    primary: "Approve order",
    caption: "Extraction confidence is below the auto-approve floor; verify before posting.",
    secondary: "Reject",
  },
  AUTO_CORRECT: {
    primary: "Apply correction",
    caption: "Posts the corrected order to the ERP.",
    secondary: "Reject correction",
  },
  REJECT: {
    primary: "Reject",
    caption: "Rejects the order and notifies the buyer.",
    secondary: "Cancel",
  },
  SUBMIT_TO_ERP: {
    primary: "Submit to ERP",
    caption: "Posts the reviewed order to the ERP. Orders over $10k require a second approver.",
    secondary: "Cancel",
  },
  DRAFT_REPLY: {
    primary: "Draft reply",
    caption: "Composes a reply to the buyer for you to review before sending.",
    secondary: "Cancel",
  },
};

/**
 * Returns the mapped label for a known action, or `null` when the
 * action is unknown / absent. Callers fall back to the generic
 * "Approve" / "Reject" pair in that case so a backend addition
 * doesn't crash or relabel surfaces with a misleading caption.
 */
export function actionLabel(action: string | null | undefined): ActionLabel | null {
  if (!action) return null;
  return ACTION_LABELS[action] ?? null;
}

/**
 * Format a "last activity" relative timestamp for the case-list row
 * and case-detail header (issue #133 PO #17). Operators reading the
 * SLA queue want to see at a glance whether a case is fresh or has
 * been sitting; absolute ISO strings buried at the end of the row
 * don't carry that signal.
 *
 * - <60s    → "just now"
 * - <60m    → "5m ago"
 * - <24h    → "3h ago"
 * - <7d     → "2d ago"
 * - else    → ISO date portion ("2026-05-11") as a fallback that
 *             never lies about staleness
 *
 * Pure function: callers pass the `now` reference (typically from
 * `useSlaTicker`) so the label updates with the rest of the SLA
 * countdown. Returns `null` when the input is absent so the caller
 * can structurally omit the row (Guardrail #6).
 */
export function lastActivityLabel(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const ms = now.getTime() - target;
  if (ms < 60_000) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return iso.slice(0, 10);
}

/**
 * Lookup the cluster a status belongs to. Returns null when the
 * status isn't covered (defensive — backend addition without a UI
 * label entry). The chip bar treats unknown statuses as Terminal
 * by default, which the resolution comment above documents.
 */
export function clusterFor(
  status: string | null | undefined,
): "Live" | "Waiting" | "Terminal" | null {
  if (!status) return null;
  for (const [cluster, statuses] of Object.entries(CASE_STATUS_CLUSTERS)) {
    if ((statuses as readonly string[]).includes(status)) {
      return cluster as "Live" | "Waiting" | "Terminal";
    }
  }
  return null;
}

// Quick-Approve / quick-Reject submit a disposition with a single
// "no specific override reason" sentinel. The May-2026 panel curated
// per-intent vocabularies are UPPERCASE; the legacy global set is
// lowercase. `pickQuickActionReasonTag` reads the value the live
// backend would have served via `useHealth`, so the UI doesn't carry
// a casing assumption (Guardrail #1: no per-intent dispatch in page
// code; Compliance: no silent auto-uppercase that would land a tag
// in the audit log the user never selected).
//
// Returns `null` when health is unavailable. Callers MUST surface an
// error toast and disable the action in that branch — the Architect
// + Compliance + Frontend amendments to the 2026-05-11 rollout plan
// forbid a literal "OTHER" fallback.
export function pickQuickActionReasonTag(
  intent: string | undefined,
  health: HealthResponse | null | undefined,
): string | null {
  if (!health) return null;
  const perIntent = intent
    ? health.allowed_override_reason_tags_by_intent?.[intent]
    : undefined;
  const pool = (perIntent && perIntent.length > 0)
    ? perIntent
    : (health.allowed_override_reason_tags ?? []);
  if (pool.length === 0) return null;
  // Prefer the explicit OTHER sentinel — every curated vocab carries
  // one. Fall back to lowercase "other" for the legacy global set.
  if (pool.includes("OTHER")) return "OTHER";
  if (pool.includes("other")) return "other";
  // Last resort: the first tag in the pool. Surfaces in code review
  // because it implies the backend dropped both sentinels.
  return pool[0] ?? null;
}
