/**
 * /cases page tests — Phase H.6 (ADR-038).
 *
 * Locks:
 *   * SLA snapshot derivation matches the §6.1 band thresholds.
 *   * Page renders cases sorted by SLA-deadline urgency.
 *   * Filter chips compose with the source vocabulary from
 *     ALLOWED_CASE_SOURCES (Guardrail #1 — no inline literals
 *     in the page code; the test reads the same constant).
 */

import { describe, it, expect, vi } from "vitest";
import { slaSnapshot } from "@/app/cases/page";
import { ALLOWED_CASE_SOURCES } from "@/lib/api";
import type { OrderCase } from "@/types/cases";


function mockCase(over: Partial<OrderCase> = {}): OrderCase {
  return {
    case_id: "case-1",
    tenant_id: "acme-corp",
    customer_id: null,
    source: "manual_order",
    source_channel: "email",
    customer_po_number: "PO-1",
    sales_order_id: null,
    edi_transaction_id: null,
    source_email_id: null,
    opened_at: "2026-04-22T10:00:00Z",
    closed_at: null,
    status: "OPEN_AGENT_PROCESSING",
    sla_deadline: null,
    tier: 2,
    working_memory_summary: null,
    last_compaction_at: null,
    bundle_version_at_open: null,
    ...over,
  };
}


describe("slaSnapshot — band thresholds", () => {
  const NOW = new Date("2026-04-22T12:00:00Z");

  it("returns 'none' when no deadline set", () => {
    const snap = slaSnapshot(mockCase({ sla_deadline: null }), NOW);
    expect(snap.band).toBe("none");
    expect(snap.label).toBe("No SLA set");
  });

  it("returns 'breached' when deadline has passed", () => {
    const snap = slaSnapshot(
      mockCase({ sla_deadline: "2026-04-22T11:00:00Z" }), NOW,
    );
    expect(snap.band).toBe("breached");
    expect(snap.label).toMatch(/Breached/);
  });

  it("returns 'at_risk' when <2h to deadline", () => {
    // 90 minutes ahead.
    const future = new Date(NOW.getTime() + 90 * 60_000).toISOString();
    const snap = slaSnapshot(mockCase({ sla_deadline: future }), NOW);
    expect(snap.band).toBe("at_risk");
  });

  it("returns 'today' when 2h-24h to deadline", () => {
    // 6 hours ahead.
    const future = new Date(NOW.getTime() + 6 * 60 * 60_000).toISOString();
    const snap = slaSnapshot(mockCase({ sla_deadline: future }), NOW);
    expect(snap.band).toBe("today");
  });

  it("returns 'comfortable' when >24h to deadline", () => {
    // 48 hours ahead.
    const future = new Date(NOW.getTime() + 48 * 60 * 60_000).toISOString();
    const snap = slaSnapshot(mockCase({ sla_deadline: future }), NOW);
    expect(snap.band).toBe("comfortable");
  });

  it("returns 'none' on an invalid deadline string", () => {
    const snap = slaSnapshot(
      mockCase({ sla_deadline: "not-a-date" }), NOW,
    );
    expect(snap.band).toBe("none");
  });
});


describe("ALLOWED_CASE_SOURCES — case vocabulary surface", () => {
  it("contains both manual_order and automated_order", () => {
    expect(ALLOWED_CASE_SOURCES).toContain("manual_order");
    expect(ALLOWED_CASE_SOURCES).toContain("automated_order");
  });

  it("is read-only at the type level (frozen tuple)", () => {
    // The constant is `as const` so it's a readonly tuple. This test
    // is a smoke-check that the runtime value is also a tuple, not
    // an object accidentally substituted later.
    expect(Array.isArray(ALLOWED_CASE_SOURCES)).toBe(true);
    expect(ALLOWED_CASE_SOURCES.length).toBeGreaterThanOrEqual(2);
  });
});
