/**
 * ClassificationHistoryPanel — requirements §8.6 audit strip.
 *
 * Locks:
 *   * Empty trail renders nothing (Guardrail #6).
 *   * Each entry surfaces classifier_type / supergroup_code /
 *     intent_code / reason_text in append order.
 *   * Partner-redacted rows render their coarse `internal:*`
 *     attribution cleanly (no `user:` prefix leaks).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ClassificationHistoryPanel } from "@/components/cases/ClassificationHistoryPanel";
import type {
  ClassificationHistoryEntry,
  ClassifierType,
} from "@/types/exceptions";


function entry(
  over: Partial<ClassificationHistoryEntry> = {},
): ClassificationHistoryEntry {
  return {
    id: "cls-001",
    case_id: "case-A",
    child_case_id: null,
    supergroup_code: "SG_BLOCK_PRICING",
    intent_code: "INT_PRICE_MISMATCH",
    classified_at: "2026-05-27T09:00:00Z",
    classified_by: "user:alice@acme.com",
    classifier_type: "HUMAN",
    model_version: null,
    reason_text: "Operator reclassified after PO inspection.",
    source_event_id: null,
    taxonomy_version: "2026-05-27-v1",
    ...over,
  };
}


describe("ClassificationHistoryPanel", () => {
  it("renders nothing when the trail is empty", () => {
    const { container } = render(
      <ClassificationHistoryPanel entries={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders one row per entry with supergroup + intent + reason", () => {
    render(<ClassificationHistoryPanel entries={[entry()]} />);
    expect(
      screen.getByRole("region", { name: /classification history/i }),
    ).toBeInTheDocument();
    // PO 2026-05-28 — supergroup_code displays via
    // `formatSupergroupCode` which strips the SG_ prefix and
    // humanises snake_case. Full code remains on the hover title.
    expect(screen.getByText("Block Pricing")).toBeInTheDocument();
    expect(screen.getByTitle("SG_BLOCK_PRICING")).toBeInTheDocument();
    expect(screen.getByText("INT_PRICE_MISMATCH")).toBeInTheDocument();
    expect(
      screen.getByText(/Operator reclassified after PO inspection/),
    ).toBeInTheDocument();
    expect(screen.getByText("HUMAN")).toBeInTheDocument();
  });

  it("renders partner-redacted rows with the coarse internal: attribution (no user: prefix)", () => {
    render(
      <ClassificationHistoryPanel
        entries={[
          entry({
            id: "cls-redacted",
            classified_by: "internal:model",
            classifier_type: "MODEL",
            reason_text: null,
            model_version: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText("MODEL")).toBeInTheDocument();
    expect(screen.getByText(/internal model/)).toBeInTheDocument();
    // The raw `user:` prefix must never reach a partner surface.
    expect(screen.queryByText(/user:/)).not.toBeInTheDocument();
  });

  it("preserves entry order (append-order audit)", () => {
    render(
      <ClassificationHistoryPanel
        entries={[
          entry({ id: "first", supergroup_code: "SG_NEEDS_TRIAGE" }),
          entry({ id: "second", supergroup_code: "SG_BLOCK_PRICING" }),
        ]}
      />,
    );
    // PO 2026-05-28 — supergroup codes display via
    // `formatSupergroupCode`; the SG_ prefix is stripped and
    // snake_case → Title Case. The full code is preserved on
    // the hover title so audit hover still surfaces it.
    const codes = screen.getAllByTitle(/^SG_/);
    expect(codes[0].getAttribute("title")).toBe("SG_NEEDS_TRIAGE");
    expect(codes[1].getAttribute("title")).toBe("SG_BLOCK_PRICING");
    expect(codes[0].textContent).toBe("Needs Triage");
    expect(codes[1].textContent).toBe("Block Pricing");
  });

  // REGRESSION (fails on parent): the panel put the classifier icon in
  // Badge *children* while Badge also auto-renders DEFAULT_ICONS[variant] —
  // so every badge showed TWO icons. Routing the icon through the `icon`
  // prop (the intended Badge API) renders exactly one.
  it("renders exactly one icon per classifier badge", () => {
    const { container } = render(
      <ClassificationHistoryPanel entries={[entry()]} />,
    );
    const badge = container.querySelector("span.inline-flex");
    expect(badge?.querySelectorAll("svg")).toHaveLength(1);
  });

  // Forward-compat: a classifier_type the UI enum doesn't know yet still
  // renders a neutral badge with the raw type text + a fallback icon, not a
  // blank/undefined variant. Cast is a deliberate future-value probe.
  it("falls back to a neutral badge for an unknown classifier_type", () => {
    const { container } = render(
      <ClassificationHistoryPanel
        entries={[entry({ classifier_type: "AGENT" as ClassifierType })]}
      />,
    );
    expect(screen.getByText("AGENT")).toBeInTheDocument();
    const badge = container.querySelector("span.inline-flex");
    expect(badge?.querySelectorAll("svg")).toHaveLength(1);
  });
});
