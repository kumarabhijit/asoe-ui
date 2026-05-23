/**
 * RecordListPane — middle column of the `/cases` three-pane
 * workspace (ADR-041 P3d-remaining, 2026-05-14).
 *
 * The component is a pure renderer — the picker contract that
 * lived inside `CaseDetailPanel` pre-ADR-041 was lifted here, with
 * the auto-mount effect intentionally left behind in
 * `CaseDetailPanel` (its natural home, since it owns the selected-
 * record state).
 *
 * What these tests lock:
 *   * Empty `records` returns null — the workspace's CSS grid
 *     track collapses; no "no records" placeholder leaks
 *     (Guardrail #6 structural omission).
 *   * Each record renders as a `role="radio"` inside a
 *     `role="radiogroup"`; clicking fires `onSelectRecord` with
 *     the record id.
 *   * `selectedRecordId` flips `aria-checked` on the matching row.
 *   * `data-keyboard-nav-id` is set on every row so a future
 *     `useKeyboardListNav` mount on the pane can drive selection
 *     with the same hook the queue uses.
 *
 * Single-record auto-mount is NOT tested here — that's
 * `CaseDetailPanel`'s contract (see `CaseDetailPanel.test.tsx`).
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RecordListPane } from "@/app/cases/RecordListPane";
import type { ExceptionDetail, LifecycleState } from "@/types/exceptions";

function mockRecord(
  over: Partial<{
    id: string;
    order_id: string;
    intent: string;
    lifecycle_state: LifecycleState;
  }> = {},
): ExceptionDetail {
  return {
    id: over.id ?? "exc-A",
    tenant_id: "acme-corp",
    order_id: over.order_id ?? "PO-A",
    event_type: "EDI_850_PRICE_MISMATCH",
    intent: over.intent ?? "CONTRACTUAL_CORRECTION",
    lifecycle_state: over.lifecycle_state ?? "PENDING_REVIEW",
    shadow_verdict: "GREEN",
    selected_recipe: "PriceAdjustmentRecipe",
    resolution_data: {},
    reanalysis_history: [],
    created_at: "2026-05-10T08:00:00Z",
    updated_at: "2026-05-10T08:00:00Z",
  };
}

describe("RecordListPane — empty / null contracts", () => {
  it("renders null when records is empty (Guardrail #6 — no placeholder)", () => {
    const { container } = render(
      <RecordListPane caseId="case-PHB" records={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RecordListPane — picker behaviour", () => {
  it("renders one row per record with the intent + order_id + lifecycle visible", () => {
    render(
      <RecordListPane
        caseId="case-PHB"
        records={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          mockRecord({
            id: "exc-B",
            order_id: "PO-B",
            intent: "DUPLICATE_PO",
            lifecycle_state: "RESOLVED",
          }),
        ]}
      />,
    );
    const rg = screen.getByRole("radiogroup", { name: /select a record/i });
    expect(rg).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText("PO-A")).toBeInTheDocument();
    expect(screen.getByText("PO-B")).toBeInTheDocument();
    expect(screen.getByText("CONTRACTUAL_CORRECTION")).toBeInTheDocument();
    expect(screen.getByText("DUPLICATE_PO")).toBeInTheDocument();
    expect(screen.getByText("RESOLVED")).toBeInTheDocument();
  });

  it("aria-checked reflects selectedRecordId", () => {
    render(
      <RecordListPane
        caseId="case-PHB"
        records={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          mockRecord({ id: "exc-B", order_id: "PO-B" }),
        ]}
        selectedRecordId="exc-B"
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
  });

  it("clicking a row fires onSelectRecord with the record id", async () => {
    const onSelectRecord = vi.fn();
    render(
      <RecordListPane
        caseId="case-PHB"
        records={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          mockRecord({ id: "exc-B", order_id: "PO-B" }),
        ]}
        onSelectRecord={onSelectRecord}
      />,
    );
    await userEvent.click(screen.getAllByRole("radio")[1]);
    expect(onSelectRecord).toHaveBeenCalledWith("exc-B");
  });

  it("is a single Tab stop: roving tabindex puts only one radio in tab order", () => {
    // Regression for the "can't switch panes with Tab" report — when
    // every radio was tabbable, Tab walked all rows instead of moving
    // to the next pane. APG radiogroup roving tabindex: exactly one
    // radio carries tabIndex=0.
    const { rerender } = render(
      <RecordListPane
        caseId="case-PHB"
        records={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          mockRecord({ id: "exc-B", order_id: "PO-B" }),
          mockRecord({ id: "exc-C", order_id: "PO-C" }),
        ]}
      />,
    );
    let radios = screen.getAllByRole("radio");
    // No selection → the FIRST row is the tab stop.
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual([
      "0",
      "-1",
      "-1",
    ]);

    // Selection → the SELECTED row becomes the tab stop.
    rerender(
      <RecordListPane
        caseId="case-PHB"
        records={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          mockRecord({ id: "exc-B", order_id: "PO-B" }),
          mockRecord({ id: "exc-C", order_id: "PO-C" }),
        ]}
        selectedRecordId="exc-B"
      />,
    );
    radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual([
      "-1",
      "0",
      "-1",
    ]);
  });

  it("ArrowDown / ArrowUp move the selection within the pane", () => {
    const onSelectRecord = vi.fn();
    render(
      <RecordListPane
        caseId="case-PHB"
        records={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          mockRecord({ id: "exc-B", order_id: "PO-B" }),
          mockRecord({ id: "exc-C", order_id: "PO-C" }),
        ]}
        selectedRecordId="exc-A"
        onSelectRecord={onSelectRecord}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: /select a record/i });
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(onSelectRecord).toHaveBeenLastCalledWith("exc-B");
    fireEvent.keyDown(group, { key: "End" });
    expect(onSelectRecord).toHaveBeenLastCalledWith("exc-C");
  });

  it("stops handled arrow keys from leaking to document-level listeners", () => {
    // Regression: the queue's document-level useKeyboardListNav fired
    // on the SAME ArrowDown, moving the case selection (and dropping
    // ?record=) while the operator was arrow-navigating the record
    // list. The pane must stopPropagation for keys it owns.
    const docSpy = vi.fn();
    document.addEventListener("keydown", docSpy);
    try {
      render(
        <RecordListPane
          caseId="case-PHB"
          records={[
            mockRecord({ id: "exc-A", order_id: "PO-A" }),
            mockRecord({ id: "exc-B", order_id: "PO-B" }),
          ]}
          selectedRecordId="exc-A"
          onSelectRecord={vi.fn()}
        />,
      );
      const group = screen.getByRole("radiogroup", {
        name: /select a record/i,
      });
      fireEvent.keyDown(group, { key: "ArrowDown" });
      expect(
        docSpy,
        "ArrowDown must not reach document — it would also drive the queue",
      ).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", docSpy);
    }
  });

  it("lets unhandled keys (Tab) pass through to document", () => {
    // Only the nav keys are owned; Tab must still bubble so focus can
    // leave the pane.
    const docSpy = vi.fn();
    document.addEventListener("keydown", docSpy);
    try {
      render(
        <RecordListPane
          caseId="case-PHB"
          records={[mockRecord({ id: "exc-A", order_id: "PO-A" })]}
          selectedRecordId="exc-A"
          onSelectRecord={vi.fn()}
        />,
      );
      const group = screen.getByRole("radiogroup", {
        name: /select a record/i,
      });
      fireEvent.keyDown(group, { key: "Tab" });
      expect(docSpy).toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", docSpy);
    }
  });

  it("ArrowUp clamps at the top edge (no wrap, no spurious select)", () => {
    const onSelectRecord = vi.fn();
    render(
      <RecordListPane
        caseId="case-PHB"
        records={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          mockRecord({ id: "exc-B", order_id: "PO-B" }),
        ]}
        selectedRecordId="exc-A"
        onSelectRecord={onSelectRecord}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: /select a record/i });
    fireEvent.keyDown(group, { key: "ArrowUp" });
    // Already at the top → next === current → no re-select.
    expect(onSelectRecord).not.toHaveBeenCalled();
  });

  it("emits `data-keyboard-nav-id` per row so useKeyboardListNav can drive", () => {
    // Future-proofing: the workspace queue uses `useKeyboardListNav`
    // already; the record-list pane will follow in P3e. Lock the
    // attribute now so the consumer hook works on first wire-up.
    render(
      <RecordListPane
        caseId="case-PHB"
        records={[
          mockRecord({ id: "exc-A", order_id: "PO-A" }),
          mockRecord({ id: "exc-B", order_id: "PO-B" }),
        ]}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("data-keyboard-nav-id", "exc-A");
    expect(radios[1]).toHaveAttribute("data-keyboard-nav-id", "exc-B");
  });
});
