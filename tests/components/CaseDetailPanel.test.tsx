/**
 * CaseDetailPanel — case-header anatomy + Compliance-hits section
 * (Phase 28.5).
 *
 * Locks:
 *   * The case header renders source / channel / status / case_id.
 *   * When `policyHits` is empty / undefined, the Compliance-hits
 *     section is hidden (CLAUDE.md Guardrail #6 — no synthesised
 *     "no hits" placeholder).
 *   * When hits are present, each renders via `PolicyHitBadge`,
 *     and the L1 vs L2 distinction (LLM_SHADOW: prefix) reaches
 *     the screen.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CaseDetailPanel } from "@/app/cases/CaseDetailPanel";
import type { OrderCase } from "@/types/cases";


function mockCase(over: Partial<OrderCase> = {}): OrderCase {
  return {
    case_id: "case-PHB",
    tenant_id: "acme-corp",
    customer_id: "acct-target",
    source: "manual_order",
    source_channel: "email",
    customer_po_number: "PO-PHB-1",
    sales_order_id: null,
    edi_transaction_id: null,
    source_email_id: null,
    opened_at: "2026-05-10T08:00:00Z",
    closed_at: null,
    status: "OPEN_AWAITING_HUMAN",
    sla_deadline: "2026-05-12T08:00:00Z",
    tier: 2,
    working_memory_summary: null,
    last_compaction_at: null,
    bundle_version_at_open: null,
    ...over,
  };
}


describe("CaseDetailPanel — case header", () => {
  it("renders case_id and source channel", () => {
    render(<CaseDetailPanel orderCase={mockCase()} />);
    expect(screen.getAllByText("case-PHB").length).toBeGreaterThan(0);
    expect(screen.getByText("email")).toBeInTheDocument();
  });
});


describe("CaseDetailPanel — Compliance hits section", () => {
  it("hides the section when no policy hits are passed", () => {
    render(<CaseDetailPanel orderCase={mockCase()} />);
    expect(
      screen.queryByRole("region", { name: /compliance shadow hits/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the section when policy hits is an empty array", () => {
    render(<CaseDetailPanel orderCase={mockCase()} policyHits={[]} />);
    expect(
      screen.queryByRole("region", { name: /compliance shadow hits/i }),
    ).not.toBeInTheDocument();
  });

  it("renders each hit via PolicyHitBadge (L1 plain, L2 with AI pill)", () => {
    render(
      <CaseDetailPanel
        orderCase={mockCase()}
        policyHits={[
          "MK-2026-12",
          "LLM_SHADOW:CUSTOMER_OPT_OUT_VIOLATION",
        ]}
      />,
    );
    // Section header visible
    expect(
      screen.getByRole("region", { name: /compliance shadow hits/i }),
    ).toBeInTheDocument();
    // L1 rule renders plain
    expect(screen.getByText("MK-2026-12")).toBeInTheDocument();
    // L2 rule renders with AI pill + concern name without the prefix
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(
      screen.getByText("CUSTOMER_OPT_OUT_VIOLATION"),
    ).toBeInTheDocument();
  });
});
