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
