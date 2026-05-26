/**
 * Architectural lock — every MANUAL_ORDER_INTAKE mock exception must have an
 * INBOX_SECTION_BUNDLES entry that carries at least an `email_source`, so the
 * Customer Inbox lens doesn't silently regress to "only EML-PO-2026-0042 has
 * evidence". This mirrors the real-API contract locked in
 * `asoe2/tests/test_e2e_manual_order_intake_inbox_sections.py`: the live
 * backend produces `email_source` for every manual-intake record going through
 * /resolve; mock mode must not present a thinner view.
 *
 * If you add a new MANUAL_ORDER_INTAKE mock case, either bundle inbox sections
 * for it or document the exclusion below.
 */
import { describe, it, expect } from "vitest";

import { MOCK_EXCEPTIONS } from "@/lib/mock-data/exceptions";
import { INBOX_SECTION_BUNDLES } from "@/lib/mock-data/inbox-sections";

describe("INBOX_SECTION_BUNDLES coverage", () => {
  const inboxCases = MOCK_EXCEPTIONS.filter(
    (e) => e.intent === "MANUAL_ORDER_INTAKE",
  );

  it("includes every MANUAL_ORDER_INTAKE mock case", () => {
    expect(inboxCases.length).toBeGreaterThan(0);
    const missing = inboxCases
      .filter((e) => !INBOX_SECTION_BUNDLES[e.id])
      .map((e) => `${e.id} (${e.order_id})`);
    expect(missing).toEqual([]);
  });

  it("every bundle carries an email_source (the per-case source-of-truth substrate)", () => {
    const missing = inboxCases
      .filter((e) => !INBOX_SECTION_BUNDLES[e.id]?.email_source)
      .map((e) => `${e.id} (${e.order_id})`);
    expect(missing).toEqual([]);
  });

  it("the canonical EML-PO-2026-0042 case is the fully-furnished reference (every inbox section)", () => {
    const ref = INBOX_SECTION_BUNDLES["exc-026"];
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
