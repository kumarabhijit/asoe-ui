/**
 * AgentReasoningCard tests — two-layer cognition, verdict-specific behavior.
 *
 * Tests the core agent-first component per Section 11.1:
 * - GREEN: Layer 2 collapsed, "View Details" toggles it
 * - YELLOW: Layer 2 auto-expanded, Approve/Reject/Escalate shown
 * - RED: Layer 2 auto-expanded, Override admin-gated, no primary CTA
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentReasoningCard } from "@/components/ui/AgentReasoningCard";
import { MOCK_TRACE } from "../fixtures";

describe("AgentReasoningCard", () => {
  describe("Layer 1 — always visible", () => {
    it("renders agent analysis header", () => {
      render(<AgentReasoningCard verdict="GREEN" />);
      expect(screen.getByText("Agent Analysis")).toBeInTheDocument();
    });

    it("renders confidence bar when provided", () => {
      render(<AgentReasoningCard verdict="GREEN" confidence={0.92} />);
      expect(screen.getByText("92%")).toBeInTheDocument();
    });

    it("renders intent when provided", () => {
      render(<AgentReasoningCard verdict="GREEN" intent="CONTRACTUAL_CORRECTION" />);
      expect(screen.getByText("CONTRACTUAL CORRECTION")).toBeInTheDocument();
    });

    it("renders recipe name when provided", () => {
      render(<AgentReasoningCard verdict="GREEN" recipeName="PriceAdjustmentRecipe.py" />);
      expect(screen.getByText("PriceAdjustmentRecipe")).toBeInTheDocument();
    });

    it("renders explanation when provided", () => {
      render(<AgentReasoningCard verdict="GREEN" explanation="Test explanation" />);
      expect(screen.getByText("Test explanation")).toBeInTheDocument();
    });
  });

  describe("GREEN verdict", () => {
    it("shows 'Auto-resolved' badge", () => {
      render(<AgentReasoningCard verdict="GREEN" />);
      expect(screen.getByText("Auto-resolved")).toBeInTheDocument();
    });

    it("shows 'View Details' button (not Approve/Reject)", () => {
      render(<AgentReasoningCard verdict="GREEN" />);
      expect(screen.getByText("View Details")).toBeInTheDocument();
      expect(screen.queryByText("Approve")).not.toBeInTheDocument();
      expect(screen.queryByText("Reject")).not.toBeInTheDocument();
    });

    it("Layer 2 is collapsed by default", () => {
      render(<AgentReasoningCard verdict="GREEN" trace={MOCK_TRACE} />);
      expect(screen.queryByText("deterministic_fallback")).not.toBeInTheDocument();
    });

    it("'View Details' toggles Layer 2", async () => {
      const user = userEvent.setup();
      render(<AgentReasoningCard verdict="GREEN" trace={MOCK_TRACE} />);

      await user.click(screen.getByText("View Details"));
      expect(screen.getByText("deterministic_fallback")).toBeInTheDocument();

      await user.click(screen.getByText("Hide Details"));
      expect(screen.queryByText("deterministic_fallback")).not.toBeInTheDocument();
    });
  });

  describe("YELLOW verdict", () => {
    it("shows 'Review Required' badge", () => {
      render(<AgentReasoningCard verdict="YELLOW" />);
      expect(screen.getByText("Review Required")).toBeInTheDocument();
    });

    it("shows Approve, Reject, Escalate buttons", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onEscalate={vi.fn()}
        />
      );
      expect(screen.getByText("Approve")).toBeInTheDocument();
      expect(screen.getByText("Reject")).toBeInTheDocument();
      expect(screen.getByText("Escalate")).toBeInTheDocument();
    });

    it("Layer 2 is auto-expanded", () => {
      render(<AgentReasoningCard verdict="YELLOW" trace={MOCK_TRACE} />);
      expect(screen.getByText("deterministic_fallback")).toBeInTheDocument();
    });

    it("fires onApprove with comment when Approve confirmed", async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      render(<AgentReasoningCard verdict="YELLOW" onApprove={onApprove} />);
      // Step 1: Click Approve to open comment input
      await user.click(screen.getByText("Approve"));
      expect(screen.getByText("Approval Comment")).toBeInTheDocument();
      // Step 2: Type a comment and confirm
      await user.type(screen.getByPlaceholderText("Add approval notes (optional)..."), "Looks correct");
      await user.click(screen.getByText("Confirm Approval"));
      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onApprove).toHaveBeenCalledWith("Looks correct");
    });
  });

  describe("RED verdict", () => {
    it("shows 'Blocked by Policy' badge", () => {
      render(<AgentReasoningCard verdict="RED" />);
      expect(screen.getByText("Blocked by Policy")).toBeInTheDocument();
    });

    it("Layer 2 is auto-expanded", () => {
      render(<AgentReasoningCard verdict="RED" trace={MOCK_TRACE} />);
      expect(screen.getByText("deterministic_fallback")).toBeInTheDocument();
    });

    it("shows policy hits when provided", () => {
      render(
        <AgentReasoningCard verdict="RED" policyHits={["PENALTY_MATRIX_VIOLATION"]} />
      );
      expect(screen.getByText("PENALTY_MATRIX_VIOLATION")).toBeInTheDocument();
    });

    it("shows Acknowledge and Escalate but NOT Override for non-admin", () => {
      render(
        <AgentReasoningCard
          verdict="RED"
          isAdmin={false}
          onApprove={vi.fn()}
          onOverride={vi.fn()}
          onEscalate={vi.fn()}
        />
      );
      expect(screen.getByText("Acknowledge")).toBeInTheDocument();
      expect(screen.getByText("Escalate")).toBeInTheDocument();
      expect(screen.queryByText("Override")).not.toBeInTheDocument();
    });

    it("shows Override button only for admin (SOX compliance)", () => {
      render(
        <AgentReasoningCard
          verdict="RED"
          isAdmin={true}
          onOverride={vi.fn()}
          onEscalate={vi.fn()}
        />
      );
      expect(screen.getByText("Override")).toBeInTheDocument();
    });
  });
});
