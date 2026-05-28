/**
 * CasesQueueRowV2 tests — ADR-041 P3e §2.1.
 *
 * The four-line row anatomy:
 *   Line 1 (chips): origin · SLA · status · VerdictDot
 *   Line 2:         case_id · customer_name
 *   Line 3:         SKU code — title — problem one-liner
 *   Line 4:         intent badge · currency
 *
 * All audit-bearing fields go through `<EvidenceBlock>`, so a null
 * value collapses the cell with no DOM. The row's aria-label
 * carries the spoken form (currency as "X.XX USD", not "$").
 */
import { render, screen, within } from "@testing-library/react";

import { CasesQueueRowV2 } from "@/app/cases/CasesQueueRowV2";
import type { CaseListItem } from "@/lib/api";
import type { SlaSnapshot } from "@/types/cases";

const SLA: SlaSnapshot = {
  band: "breached",
  deadline: "2026-05-10T08:00:00Z",
  ms_until_deadline: -60 * 60 * 1000,
  label: "Breached 1h ago",
};

const FULL_CASE: CaseListItem = {
  case_id: "EML-CMP-2026-0062",
  tenant_id: "acme-corp",
  origin: "CUSTOMER",
  source_channel: "email",
  supergroup_code: "SG_NEW_ORDER",
  customer_po_number: "PO-2026-0062",
  opened_at: "2026-05-10T08:00:00Z",
  updated_at: "2026-05-10T09:00:00Z",
  status: "OPEN_AWAITING_HUMAN",
  will_miss_rdd: false,
  tier: 2,
  child_intents: ["EMAIL_COMPLAINT"],
  customer_name: "acme-corp",
  top_line_sku_code: "BEV-COLA-12PK",
  top_line_sku_title: "Cola 12-pack",
  problem_one_liner: "short shipment: received 380 of 480",
  intent: "EMAIL_COMPLAINT",
  dollar_impact: { amount_cents: 414720, currency: "USD" },
  audit_verdict_color: "R",
};

const BARE_CASE: CaseListItem = {
  ...FULL_CASE,
  customer_name: null,
  top_line_sku_code: null,
  top_line_sku_title: null,
  problem_one_liner: null,
  intent: null,
  dollar_impact: null,
  audit_verdict_color: null,
};

describe("CasesQueueRowV2 — full data", () => {
  it("renders origin, status, customer name, SKU + one-liner, intent, currency", () => {
    render(
      <CasesQueueRowV2
        case_={FULL_CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        density="comfortable"
        onSelect={() => {}}
      />,
    );
    const row = screen.getByRole("option");
    expect(within(row).getByText("Customer Inbox")).toBeInTheDocument();
    expect(within(row).getByText(/Awaiting review/i)).toBeInTheDocument();
    expect(within(row).getByText("EML-CMP-2026-0062")).toBeInTheDocument();
    expect(within(row).getByText("acme-corp")).toBeInTheDocument();
    expect(within(row).getByText("BEV-COLA-12PK")).toBeInTheDocument();
    expect(within(row).getByText(/short shipment/)).toBeInTheDocument();
    expect(within(row).getByText("EMAIL_COMPLAINT")).toBeInTheDocument();
    expect(within(row).getByText("$4,147.20")).toBeInTheDocument();
  });

  it("renders the VerdictDot for RED audit verdict", () => {
    render(
      <CasesQueueRowV2
        case_={FULL_CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        density="comfortable"
        onSelect={() => {}}
      />,
    );
    expect(
      screen.getByRole("img", { name: /audit verdict: red/i }),
    ).toBeInTheDocument();
  });

  it("aria-label concatenates the row in scan order with spoken currency", () => {
    render(
      <CasesQueueRowV2
        case_={FULL_CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        density="comfortable"
        onSelect={() => {}}
      />,
    );
    const row = screen.getByRole("option");
    const label = row.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/Customer Inbox/);
    expect(label).toMatch(/SLA Breached/);
    expect(label).toMatch(/audit verdict R/);
    expect(label).toMatch(/case EML-CMP-2026-0062/);
    expect(label).toMatch(/acme-corp/);
    expect(label).toMatch(/EMAIL_COMPLAINT/);
    // Spoken currency, not the "$" glyph (NVDA/JAWS pronunciation drift).
    expect(label).toMatch(/4,147\.20 USD/);
    expect(label).not.toMatch(/\$4,147/);
  });
});

describe("CasesQueueRowV2 — bare data (EvidenceBlock omission)", () => {
  it("collapses customer name, SKU line, intent, currency when null", () => {
    render(
      <CasesQueueRowV2
        case_={BARE_CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        density="comfortable"
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByText("acme-corp")).not.toBeInTheDocument();
    expect(screen.queryByText("BEV-COLA-12PK")).not.toBeInTheDocument();
    expect(screen.queryByText("EMAIL_COMPLAINT")).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    // The chips on line 1 still render — origin and SLA always present.
    expect(screen.getByText("Customer Inbox")).toBeInTheDocument();
  });

  it("does not show the VerdictDot when audit_verdict_color is null", () => {
    render(
      <CasesQueueRowV2
        case_={BARE_CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        density="comfortable"
        onSelect={() => {}}
      />,
    );
    expect(
      screen.queryByRole("img", { name: /audit verdict/i }),
    ).not.toBeInTheDocument();
  });
});

describe("CasesQueueRowV2 — pinned stripe", () => {
  it("renders a left-edge stripe element when isPinned is true", () => {
    const { container } = render(
      <CasesQueueRowV2
        case_={FULL_CASE}
        sla={SLA}
        isSelected={false}
        isPinned
        density="comfortable"
        onSelect={() => {}}
      />,
    );
    // Stripe is aria-hidden; the "Pinned" semantic lives on
    // data-pinned + the button's aria-label.
    const stripe = container.querySelector("[aria-hidden='true']");
    expect(stripe).not.toBeNull();
    expect(screen.getByRole("option")).toHaveAttribute("data-pinned", "true");
  });
});

describe("CasesQueueRowV2 — density", () => {
  it("compact density hides lines 2 + 4", () => {
    render(
      <CasesQueueRowV2
        case_={FULL_CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        density="compact"
        onSelect={() => {}}
      />,
    );
    // Line 2 (case_id) hidden.
    expect(screen.queryByText("EML-CMP-2026-0062")).not.toBeInTheDocument();
    // Line 4 (intent badge + currency) hidden.
    expect(screen.queryByText("EMAIL_COMPLAINT")).not.toBeInTheDocument();
    expect(screen.queryByText("$4,147.20")).not.toBeInTheDocument();
    // Line 1 chips + line 3 subject still visible.
    expect(screen.getByText("Customer Inbox")).toBeInTheDocument();
    expect(screen.getByText("BEV-COLA-12PK")).toBeInTheDocument();
  });
});

describe("CasesQueueRowV2 — selection", () => {
  it("calls onSelect with case_id on click", () => {
    const onSelect = vi.fn();
    render(
      <CasesQueueRowV2
        case_={FULL_CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        density="comfortable"
        onSelect={onSelect}
      />,
    );
    screen.getByRole("option").click();
    expect(onSelect).toHaveBeenCalledWith("EML-CMP-2026-0062");
  });

  it("aria-selected reflects isSelected", () => {
    const { rerender } = render(
      <CasesQueueRowV2
        case_={FULL_CASE}
        sla={SLA}
        isSelected={false}
        isPinned={false}
        density="comfortable"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "false");
    rerender(
      <CasesQueueRowV2
        case_={FULL_CASE}
        sla={SLA}
        isSelected
        isPinned={false}
        density="comfortable"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
  });
});
