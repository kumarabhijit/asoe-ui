/**
 * Accessibility tests for CaseListPane + the legacy ExceptionListPane
 * (Phase 28.5.x §D5 P1 follow-up).
 *
 * The audit elevated jest-axe / vitest-axe coverage from "V5.1.2
 * nice-to-have" to P1 in the same PR as the role swap. These tests
 * lock the `role="listbox"`/`role="option"` pattern and run
 * vitest-axe over the rendered output to catch regressions.
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";

import { CaseListPane } from "@/app/exceptions/CaseListPane";
import type { CaseListItem } from "@/lib/api";

// Mock next/navigation so the URL-sync effect doesn't blow up in
// the jsdom environment.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// useHealth — return a minimal payload that lets the chips render.
vi.mock("@/hooks/useHealth", () => ({
  useHealth: () => ({
    health: {
      allowed_case_statuses: [
        "OPEN_AGENT_PROCESSING",
        "OPEN_AWAITING_HUMAN",
        "RESOLVED",
      ],
      allowed_intents: ["DUPLICATE_PO", "CONTRACTUAL_CORRECTION"],
      allowed_case_sources: ["manual_order", "automated_order"],
    },
    loading: false,
    error: null,
  }),
}));

function mockCase(over: Partial<CaseListItem> = {}): CaseListItem {
  return {
    case_id: "case-A",
    tenant_id: "acme",
    customer_id: "acct-walmart",
    source: "manual_order",
    source_channel: "email",
    customer_po_number: "PO-1",
    sales_order_id: null,
    edi_transaction_id: null,
    source_email_id: null,
    opened_at: "2026-05-10T08:00:00Z",
    closed_at: null,
    status: "OPEN_AWAITING_HUMAN",
    sla_deadline: "2026-05-11T08:00:00Z",
    tier: 2,
    working_memory_summary: null,
    last_compaction_at: null,
    bundle_version_at_open: null,
    child_intents: ["DUPLICATE_PO"],
    ...over,
  };
}


describe("CaseListPane — a11y", () => {
  it("has no axe violations with seeded cases", async () => {
    const { container } = render(
      <CaseListPane
        cases={[
          mockCase({ case_id: "case-A", customer_po_number: "PO-A" }),
          mockCase({ case_id: "case-B", customer_po_number: "PO-B" }),
        ]}
        total={2}
        loading={false}
        error={null}
        refetch={() => {}}
        selectedId="case-A"
        onSelect={() => {}}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations in the empty state", async () => {
    const { container } = render(
      <CaseListPane
        cases={[]}
        total={0}
        loading={false}
        error={null}
        refetch={() => {}}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders the case list with role=listbox + role=option rows", () => {
    const { container } = render(
      <CaseListPane
        cases={[mockCase()]}
        total={1}
        loading={false}
        error={null}
        refetch={() => {}}
        selectedId="case-A"
        onSelect={() => {}}
      />,
    );
    const listbox = container.querySelector('[role="listbox"][aria-label="Case list"]');
    expect(listbox).not.toBeNull();
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
  });

  it("renders search input with type=search and accessible name", () => {
    const { container } = render(
      <CaseListPane
        cases={[mockCase()]}
        total={1}
        loading={false}
        error={null}
        refetch={() => {}}
        selectedId="case-A"
        onSelect={() => {}}
      />,
    );
    const search = container.querySelector('input[type="search"]');
    expect(search).not.toBeNull();
    expect(search?.getAttribute("aria-label")).toBe("Search cases");
  });
});
