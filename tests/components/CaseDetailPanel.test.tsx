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
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

  it("renders one picker row per record and fires onSelectRecord when clicked", async () => {
    // S15a — rows are no longer Links to /exceptions/{id}; they are
    // radio-style picker buttons that flip the parent's
    // selectedRecordId. The parent (CaseDetailPage) reflects the
    // selection into the ?record=<id> URL query.
    const onSelectRecord = vi.fn();
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
        onSelectRecord={onSelectRecord}
      />,
    );
    expect(
      screen.getByRole("region", { name: /attached records/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("PO-A")).toBeInTheDocument();
    expect(screen.getByText("PO-B")).toBeInTheDocument();
    expect(screen.getByText("CONTRACTUAL_CORRECTION")).toBeInTheDocument();
    expect(screen.getByText("DUPLICATE_PO")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    await userEvent.click(radios[1]);
    expect(onSelectRecord).toHaveBeenCalledWith("exc-B");
  });

  it("auto-selects the only record on a single-record case", () => {
    // The CSA's "one task end-to-end" happy path: a single attached
    // record means no picking — the ribbon mounts on first paint.
    // CaseDetailPanel signals the auto-mount via onSelectRecord; the
    // page-level URL sync writes ?record=<id> in response.
    const onSelectRecord = vi.fn();
    render(
      <CaseDetailPanel
        orderCase={mockCase()}
        attachedRecords={[mockRecord({ id: "only-exc", order_id: "PO-only" })]}
        onSelectRecord={onSelectRecord}
      />,
    );
    expect(onSelectRecord).toHaveBeenCalledWith("only-exc");
  });
});
