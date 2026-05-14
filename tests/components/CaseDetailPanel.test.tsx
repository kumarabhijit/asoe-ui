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

// Stub the inline ExceptionDetailPanel — it pulls NextAuth + WebSocket
// + a full mock graph. Tests in this file exercise only the case-level
// surface (header anatomy, picker semantics, slim-strip disclosure);
// the per-record ribbon is exercised in its own dedicated suite.
vi.mock("@/app/exceptions/ExceptionDetailPanel", () => ({
  default: ({ exceptionId }: { exceptionId: string }) => (
    <div data-testid="exception-detail-panel-stub">{exceptionId}</div>
  ),
}));

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
    case_type: "EMAIL_ENTRY",
    email_classification: "NEW_ORDER",
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


describe("CaseDetailPanel — picker lifted into RecordListPane (ADR-041 P3d-remaining)", () => {
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

  it("does NOT render an inline picker — that's RecordListPane's job now", () => {
    // ADR-041 P3d-remaining (2026-05-14) lifted the picker out as
    // the workspace's middle column. CaseDetailPanel keeps the
    // auto-mount effect (which signals the parent via
    // onSelectRecord) but no longer renders the radio-group itself.
    // The picker-render contract is tested in
    // `tests/components/RecordListPane.test.tsx`.
    render(
      <CaseDetailPanel
        orderCase={mockCase()}
        attachedRecords={[mockRecord({ id: "exc-A", order_id: "PO-A" })]}
      />,
    );
    expect(
      screen.queryByRole("region", { name: /attached records/i }),
      "the inline records section was lifted to RecordListPane",
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: /select a record/i }),
      "the picker now lives in RecordListPane",
    ).not.toBeInTheDocument();
  });

  it("still fires the single-record auto-mount via onSelectRecord", () => {
    // The CSA's "one task end-to-end" happy path: a single attached
    // record means no picking — the ribbon mounts on first paint.
    // CaseDetailPanel owns the effect (it's the consumer of the
    // selection), so the auto-mount still fires whether the picker
    // is visible in a separate pane or not. This preserves the
    // focused `/cases/[id]` view (no queue chrome, no record-list
    // pane mounted) and below-xl widths where the workspace
    // collapses the middle column.
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


describe("CaseDetailPanel — slim case context strip", () => {
  function mockRecord(over: Partial<{ id: string }> = {}): ExceptionDetail {
    return {
      id: over.id ?? "exc-mounted",
      tenant_id: "acme-corp",
      order_id: "PO-mounted",
      event_type: "EDI_850_PRICE_MISMATCH",
      intent: "CONTRACTUAL_CORRECTION",
      lifecycle_state: "PENDING_REVIEW",
      shadow_verdict: "GREEN",
      selected_recipe: "PriceAdjustmentRecipe",
      resolution_data: {},
      reanalysis_history: [],
      created_at: "2026-05-10T08:00:00Z",
      updated_at: "2026-05-10T08:00:00Z",
    };
  }

  it("collapses to the slim context strip when a record is mounted", () => {
    // With selectedRecordId set, the per-record HITL ribbon owns the
    // primary visual weight. The case header collapses to a slim
    // context strip — case_id + channel + SLA + customer PO + status.
    // The verbose `dl` grid (`Opened`, `SLA deadline · …`, `Customer`,
    // `Skill bundle at open`) only re-appears via the disclosure.
    render(
      <CaseDetailPanel
        orderCase={mockCase()}
        attachedRecords={[mockRecord()]}
        selectedRecordId="exc-mounted"
      />,
    );
    expect(
      screen.getByRole("banner", { name: /case context/i }),
    ).toBeInTheDocument();
    // Slim strip still surfaces case_id + channel.
    expect(screen.getAllByText("case-PHB").length).toBeGreaterThan(0);
    expect(screen.getByText("Email")).toBeInTheDocument();
    // Field grid heading absent until disclosure expands.
    expect(screen.queryByText(/skill bundle at open/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^opened$/i)).not.toBeInTheDocument();
    // Disclosure is keyboard-reachable.
    expect(
      screen.getByRole("button", { name: /case details/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("re-expands the full header on disclosure click and collapses again", async () => {
    render(
      <CaseDetailPanel
        orderCase={mockCase()}
        attachedRecords={[mockRecord()]}
        selectedRecordId="exc-mounted"
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^case details$/i }),
    );
    // Full grid present.
    expect(
      screen.getByRole("banner", { name: /^case header$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^opened$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /hide case details/i }),
    ).toHaveAttribute("aria-expanded", "true");
    // Re-collapse round-trips back to the slim strip.
    await userEvent.click(
      screen.getByRole("button", { name: /hide case details/i }),
    );
    expect(
      screen.getByRole("banner", { name: /case context/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^opened$/i)).not.toBeInTheDocument();
  });

  it("renders the full header when no record is selected", () => {
    // Multi-record cases without a pick (or no-records cases) keep the
    // full header — there's no inline ribbon yet, so the case-level
    // fields ARE the primary content.
    render(<CaseDetailPanel orderCase={mockCase()} />);
    expect(
      screen.getByRole("banner", { name: /^case header$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^opened$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^case details$/i }),
    ).not.toBeInTheDocument();
  });
});
