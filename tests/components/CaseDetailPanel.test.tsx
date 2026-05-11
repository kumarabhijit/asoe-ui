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
import type { ExceptionDetail } from "@/types/exceptions";


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
    // Issue #133 (PO #10): source_channel is rendered through the
    // `sourceChannelLabel` helper now — "email" prints as "Email".
    expect(screen.getByText("Email")).toBeInTheDocument();
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


describe("CaseDetailPanel — Attached records stack (Phase 28.5.x)", () => {
  function mockRecord(over: Partial<{ id: string; order_id: string; intent: string }> = {}): ExceptionDetail {
    return {
      id: over.id ?? "exc-A",
      tenant_id: "acme-corp",
      order_id: over.order_id ?? "PO-A",
      event_type: "EDI_850_PRICE_MISMATCH",
      intent: over.intent ?? "CONTRACTUAL_CORRECTION",
      lifecycle_state: "PENDING_REVIEW",
      shadow_verdict: "GREEN",
      selected_recipe: "PriceAdjustmentRecipe",
      resolution_data: {},
      reanalysis_history: [],
      created_at: "2026-05-10T08:00:00Z",
      updated_at: "2026-05-10T08:00:00Z",
    };
  }

  it("hides the section when no attached records are passed", () => {
    render(<CaseDetailPanel orderCase={mockCase()} />);
    expect(
      screen.queryByRole("region", { name: /attached records/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the section when attached records is empty", () => {
    render(<CaseDetailPanel orderCase={mockCase()} attachedRecords={[]} />);
    expect(
      screen.queryByRole("region", { name: /attached records/i }),
    ).not.toBeInTheDocument();
  });

  it("renders one row per record with a deep-link to /exceptions/{id}", () => {
    render(
      <CaseDetailPanel
        orderCase={mockCase()}
        attachedRecords={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          {
            ...mockRecord({
              id: "exc-B", order_id: "PO-B", intent: "DUPLICATE_PO",
            }),
            lifecycle_state: "RESOLVED",
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("region", { name: /attached records/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("PO-A")).toBeInTheDocument();
    expect(screen.getByText("PO-B")).toBeInTheDocument();
    expect(screen.getByText("CONTRACTUAL_CORRECTION")).toBeInTheDocument();
    expect(screen.getByText("DUPLICATE_PO")).toBeInTheDocument();
    // Both rows are Links to the per-event detail surface.
    const linkA = screen.getByRole("link", { name: /open exception po-a/i });
    expect(linkA).toHaveAttribute("href", "/exceptions/exc-A");
    const linkB = screen.getByRole("link", { name: /open exception po-b/i });
    expect(linkB).toHaveAttribute("href", "/exceptions/exc-B");
  });
});
