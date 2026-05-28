/**
 * CasesQueueRow tests — ADR-041 P3e §2.1 (legacy row, extracted).
 *
 * Verifies the extracted component renders identically to the
 * inline `<button>` it replaced (origin/SLA/pinned chips, PO/SO/
 * case_id identifier, lifecycle label).
 */
import { render, screen } from "@testing-library/react";

import { CasesQueueRow } from "@/app/cases/CasesQueueRow";
import type { CaseListItem } from "@/lib/api";
import type { SlaSnapshot } from "@/types/cases";

const SLA: SlaSnapshot = {
  band: "comfortable",
  deadline: "2026-05-10T20:00:00Z",
  ms_until_deadline: 3 * 60 * 60 * 1000,
  label: "Due in 3h",
};

const CASE: CaseListItem = {
  case_id: "EML-CMP-2026-0062",
  tenant_id: "acme-corp",
  origin: "CUSTOMER",
  source_channel: "email",
  supergroup_code: "SG_NEW_ORDER",
  customer_po_number: "PO-2026-0062",
  opened_at: "2026-05-10T08:00:00Z",
  updated_at: "2026-05-10T09:00:00Z",
  status: "PENDING_REVIEW",
  will_miss_rdd: false,
  tier: 2,
  child_intents: [],
  customer_name: null,
  top_line_sku_code: null,
  top_line_sku_title: null,
  problem_one_liner: null,
  intent: null,
  dollar_impact: null,
  audit_verdict_color: null,
};

describe("CasesQueueRow (legacy)", () => {
  it("renders the case_id identifier when PO is missing", () => {
    render(
      <CasesQueueRow
        case_={{ ...CASE, customer_po_number: null }}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("EML-CMP-2026-0062")).toBeInTheDocument();
  });

  it("prefers customer_po_number over case_id", () => {
    render(
      <CasesQueueRow
        case_={CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("PO-2026-0062")).toBeInTheDocument();
    expect(screen.queryByText("EML-CMP-2026-0062")).not.toBeInTheDocument();
  });

  it("shows the Pinned badge when isPinned is true", () => {
    render(
      <CasesQueueRow
        case_={CASE}
        sla={SLA}
        isSelected={false}
        isPinned
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  it("calls onSelect with case_id on click", () => {
    const onSelect = vi.fn();
    render(
      <CasesQueueRow
        case_={CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        onSelect={onSelect}
      />,
    );
    screen.getByRole("option").click();
    expect(onSelect).toHaveBeenCalledWith("EML-CMP-2026-0062");
  });

  it("sets aria-selected on the option", () => {
    const { rerender } = render(
      <CasesQueueRow
        case_={CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "false");
    rerender(
      <CasesQueueRow
        case_={CASE}
        sla={SLA}
        isSelected
        isPinned={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
  });
});
