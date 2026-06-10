/**
 * SituationSubline — decision-context line under the Situation headline
 * (audit finding #2, option C — sign-off 2026-06-10).
 *
 * Locks the dumb-projector contract: the sub-line renders the
 * backend-composed `situation_context` facts as given — SLA (live
 * relative label from the ISO timestamp via the shared banding rule)
 * + lifecycle state (governed humanizer) — and structurally omits any
 * null fact (no dash/placeholder partial-truth states). The $ figure
 * must never appear here: option C keeps it in the ImpactBar.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { SituationSubline } from "@/app/exceptions/SituationSubline";

const HOUR_MS = 60 * 60 * 1000;

/** Deadline relative to test runtime — the component ticks off `new
 *  Date()`, so fixtures are built from `Date.now()`. */
const inHours = (h: number) => new Date(Date.now() + h * HOUR_MS).toISOString();

describe("SituationSubline (audit finding #2, option C)", () => {
  it("renders SLA + humanized state when both facts are composed", () => {
    render(
      <SituationSubline
        context={{ sla_due_at: inHours(3), lifecycle_state: "PENDING_REVIEW" }}
      />,
    );
    // Live relative label, prefixed in sentence case ("SLA due in 3h").
    expect(screen.getByText(/^SLA due in /)).toBeInTheDocument();
    // Governed plain language, not the raw enum.
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
    expect(screen.queryByText("PENDING_REVIEW")).not.toBeInTheDocument();
  });

  it("reads 'SLA breached … ago' for a past deadline (urgency in words, not color alone)", () => {
    render(
      <SituationSubline
        context={{ sla_due_at: inHours(-9), lifecycle_state: "ESCALATED" }}
      />,
    );
    expect(screen.getByText(/^SLA breached .* ago$/)).toBeInTheDocument();
  });

  it("structurally omits the SLA segment when sla_due_at is null (no placeholder)", () => {
    const { container } = render(
      <SituationSubline
        context={{ sla_due_at: null, lifecycle_state: "RESOLVED" }}
      />,
    );
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/SLA/);
    // No dangling separator when only one segment renders.
    expect(container.textContent).not.toContain("·");
  });

  it("structurally omits the state segment when lifecycle_state is null", () => {
    const { container } = render(
      <SituationSubline context={{ sla_due_at: inHours(5), lifecycle_state: null }} />,
    );
    expect(screen.getByText(/^SLA due in /)).toBeInTheDocument();
    expect(container.textContent).not.toContain("·");
  });

  it("renders nothing when the composed context carries no facts", () => {
    const { container } = render(
      <SituationSubline context={{ sla_due_at: null, lifecycle_state: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the contract is absent (pre-upgrade payload)", () => {
    const { container } = render(<SituationSubline context={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("omits an unparseable SLA timestamp rather than surfacing 'Invalid SLA'", () => {
    const { container } = render(
      <SituationSubline
        context={{ sla_due_at: "not-a-date", lifecycle_state: "BLOCKED" }}
      />,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Invalid|SLA/);
  });

  it("never renders a dollar figure — the $ home is the ImpactBar (option C)", () => {
    const { container } = render(
      <SituationSubline
        context={{ sla_due_at: inHours(3), lifecycle_state: "PENDING_REVIEW" }}
      />,
    );
    expect(container.textContent).not.toContain("$");
  });
});
