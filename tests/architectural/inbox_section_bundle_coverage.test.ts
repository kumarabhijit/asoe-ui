/**
 * Architectural lock — every MANUAL_ORDER_INTAKE mock exception must have an
 * analysis (`MOCK_ORDER_ANALYSES`) that carries at least an `email_source`, so
 * the Customer Inbox lens doesn't silently regress to "only EML-PO-2026-0042
 * has evidence". This mirrors the real-API contract locked in
 * `asoe2/tests/test_e2e_manual_order_intake_inbox_sections.py`: the live
 * backend produces `email_source` for every manual-intake record going through
 * /resolve; mock mode must not present a thinner view.
 *
 * The inbox section bundles are now sourced from the catalog-generated
 * `SCENARIO_ANALYSES` (asoe2 `fixtures/scenarios/analyses.yaml`) — `order-
 * analyses.ts` spreads them into `MOCK_ORDER_ANALYSES`, so this lock asserts
 * against the served analysis, not a hand-authored override. If you add a new
 * MANUAL_ORDER_INTAKE mock case, furnish its analysis sections upstream or
 * document the exclusion below.
 */
import { describe, it, expect } from "vitest";

import { MOCK_EXCEPTIONS } from "@/lib/mock-data/exceptions";
import { MOCK_ORDER_ANALYSES } from "@/lib/mock-data/order-analyses";
import { MOCK_LINE_ITEMS } from "@/lib/mock-data/line-items";

// Inbox cases that legitimately carry no line items (an uncategorised email
// isn't an order). Anything else must be in MOCK_LINE_ITEMS so the
// "Evidence Detail" pane (EvidenceGrid.tsx) renders for it.
const NON_ORDER_INBOX_CASES = new Set<string>(["exc-047"]);

describe("inbox section coverage", () => {
  const inboxCases = MOCK_EXCEPTIONS.filter(
    (e) => e.intent === "MANUAL_ORDER_INTAKE",
  );

  it("includes every MANUAL_ORDER_INTAKE mock case", () => {
    expect(inboxCases.length).toBeGreaterThan(0);
    const missing = inboxCases
      .filter((e) => !MOCK_ORDER_ANALYSES[e.id])
      .map((e) => `${e.id} (${e.order_id})`);
    expect(missing).toEqual([]);
  });

  it("every analysis carries an email_source (the per-case source-of-truth substrate)", () => {
    const missing = inboxCases
      .filter((e) => !MOCK_ORDER_ANALYSES[e.id]?.email_source)
      .map((e) => `${e.id} (${e.order_id})`);
    expect(missing).toEqual([]);
  });

  it("every order-bearing inbox case has MOCK_LINE_ITEMS so the Evidence Detail pane populates", () => {
    // The "Evidence Detail" pane (EvidenceGrid.tsx) reads from
    // `/exceptions/{id}/line-items` (MOCK_LINE_ITEMS in mock mode). Without an
    // entry it shows "—" and the operator can't see the line table the bundle
    // already implies. Mirrors the real-API behaviour where
    // _project_line_items populates resolution_data.line_items from the event.
    const missing = inboxCases
      .filter((e) => !NON_ORDER_INBOX_CASES.has(e.id))
      .filter((e) => {
        const lines = MOCK_LINE_ITEMS[e.id];
        return !Array.isArray(lines) || lines.length === 0;
      })
      .map((e) => `${e.id} (${e.order_id})`);
    expect(missing).toEqual([]);
  });

  it("the canonical EML-PO-2026-0042 case is the fully-furnished reference (every inbox section)", () => {
    const ref = MOCK_ORDER_ANALYSES["exc-026"];
    expect(ref).toBeDefined();
    const required = [
      "email_source",
      "order_entry_extraction",
      "edi_850_audit",
      "entities_analysis",
      "sap_data_analysis",
      "knowledge_graph",
      "draft_reply",
    ] as const;
    for (const key of required) {
      expect(ref[key], `exc-026.${key}`).toBeTruthy();
    }
  });
});
