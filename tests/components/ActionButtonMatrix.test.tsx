/**
 * ActionButtonMatrix tests — ADR-041 P3e §2.2.
 *
 * The matrix is the shared verdict × permission action surface
 * (single source of truth used by both `AgentReasoningCard` and
 * `StickyActionRibbon`). The full button-matrix behaviour is
 * covered by the existing `AgentReasoningCard.test.tsx` suite —
 * since that card now delegates to this component, those tests
 * also exercise the matrix end-to-end.
 *
 * The cases below are focused on the matrix-as-standalone contract:
 * verdict × permission gating, the pending-action / comment swap,
 * and the SOX-mandatory reanalyze-reason gate.
 */
import { fireEvent, render, screen } from "@testing-library/react";

import { ActionButtonMatrix } from "@/components/ui/ActionButtonMatrix";

const onApprove = vi.fn();
const onReject = vi.fn();
const onEscalate = vi.fn();
const onOverride = vi.fn();
const onReanalyze = vi.fn();

beforeEach(() => {
  onApprove.mockReset();
  onReject.mockReset();
  onEscalate.mockReset();
  onOverride.mockReset();
  onReanalyze.mockReset();
});

describe("ActionButtonMatrix — verdict × permission matrix", () => {
  it("GREEN privileged shows Override only — no Approve", () => {
    render(
      <ActionButtonMatrix
        verdict="GREEN"
        onApprove={onApprove}
        onOverride={onOverride}
        canApprove
        canOverride
      />,
    );
    expect(screen.queryByRole("button", { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /different action/i })).toBeInTheDocument();
  });

  it("YELLOW analyst (no override) shows Approve + Reject + Escalate", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onApprove={onApprove}
        onReject={onReject}
        onEscalate={onEscalate}
        canApprove
        canEscalate
      />,
    );
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /triage/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /different action/i })).not.toBeInTheDocument();
  });

  it("RED shows Override + Escalate only — no Approve", () => {
    render(
      <ActionButtonMatrix
        verdict="RED"
        onApprove={onApprove}
        onOverride={onOverride}
        onEscalate={onEscalate}
        canApprove
        canOverride
        canEscalate
      />,
    );
    expect(screen.queryByRole("button", { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /different action/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /triage/i })).toBeInTheDocument();
  });

  it("executionError routes operator to Escalate only", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        executionError={{ message: "Recipe timed out" }}
        onApprove={onApprove}
        onEscalate={onEscalate}
        canApprove
        canEscalate
      />,
    );
    expect(screen.queryByRole("button", { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reject/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /triage/i })).toBeInTheDocument();
  });
});

describe("ActionButtonMatrix — comment-input swap", () => {
  it("clicking Approve opens the comment input and hides the button row", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onApprove={onApprove}
        onReject={onReject}
        canApprove
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Approve/i }));
    expect(screen.getByPlaceholderText(/approval notes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm Approval/i })).toBeInTheDocument();
    // Original button row is gone.
    expect(screen.queryByRole("button", { name: /Reject/i })).not.toBeInTheDocument();
  });

  it("Cancel returns to the button row without firing the handler", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onApprove={onApprove}
        canApprove
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Approve/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
  });

  it("Confirm fires the handler with the typed comment", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onApprove={onApprove}
        canApprove
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Approve/i }));
    const textarea = screen.getByPlaceholderText(/approval notes/i);
    fireEvent.change(textarea, { target: { value: "looks good" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm Approval/i }));
    expect(onApprove).toHaveBeenCalledWith("looks good");
  });
});

describe("ActionButtonMatrix — reanalyze SOX gate", () => {
  it("Confirm Re-analyze is disabled when reason is blank (SOX)", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onReanalyze={onReanalyze}
        canReanalyze
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Re-analyze/i }));
    const confirm = screen.getByRole("button", { name: /Confirm Re-analyze/i });
    expect(confirm).toBeDisabled();
    // Provide a reason → enables.
    fireEvent.change(screen.getByPlaceholderText(/why should this/i), {
      target: { value: "new contract uploaded" },
    });
    expect(confirm).not.toBeDisabled();
  });

  it("Re-analyze button is suppressed when verdict is GREEN", () => {
    render(
      <ActionButtonMatrix
        verdict="GREEN"
        onOverride={onOverride}
        onReanalyze={onReanalyze}
        canOverride
        canReanalyze
      />,
    );
    expect(screen.queryByRole("button", { name: /Re-analyze/i })).not.toBeInTheDocument();
  });

  it("Re-analyze button is suppressed when attempts are exhausted", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onReanalyze={onReanalyze}
        canReanalyze
        reanalyzeAttempts={3}
        reanalyzeMax={3}
      />,
    );
    expect(screen.queryByRole("button", { name: /Re-analyze/i })).not.toBeInTheDocument();
  });
});

describe("ActionButtonMatrix — in-flight disabling", () => {
  it("any actionInFlight disables every button (no double-submit)", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onApprove={onApprove}
        onReject={onReject}
        onEscalate={onEscalate}
        canApprove
        canEscalate
        actionInFlight="approve"
      />,
    );
    for (const name of [/Approve|Approving/i, /Reject|Rejecting/i, /triage/i]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
