/**
 * AgentReasoningCard tests — Layer 1 cognition, verdict × permission matrix.
 *
 * Option A (stakeholder-approved) button matrix:
 *   GREEN  → [Override…] only when canOverride && onOverride.
 *   YELLOW → [Approve] [Reject] [Escalate] when canApprove/canEscalate;
 *            [Override…] when canOverride.
 *   RED    → [Override…] when canOverride, [Escalate] when canEscalate.
 *   FAILED/isErrored → [Escalate for Triage] only.
 *
 * Accessible names are the long noun-phrase form (Approve recommendation,
 * Reject recommendation, Choose different action, Send for triage,
 * Re-analyze exception).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentReasoningCard } from "@/components/ui/AgentReasoningCard";
import { exceptionsApi } from "@/lib/api";

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

  describe("GREEN verdict — Option A matrix", () => {
    it("shows 'Auto-resolved' badge", () => {
      render(<AgentReasoningCard verdict="GREEN" />);
      expect(screen.getByText("Auto-resolved")).toBeInTheDocument();
    });

    it("shows Override when canOverride=true and onOverride provided", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          canOverride
          onOverride={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Choose different action" }),
      ).toBeInTheDocument();
      // No Approve / Reject on GREEN — the agent already acted.
      expect(screen.queryByText("Approve")).not.toBeInTheDocument();
      expect(screen.queryByText("Reject")).not.toBeInTheDocument();
    });

    it("renders no buttons when canOverride=false (no onOverride wired)", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          canOverride={false}
        />,
      );
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("YELLOW verdict — Option A matrix", () => {
    it("shows 'Review Required' badge", () => {
      render(<AgentReasoningCard verdict="YELLOW" />);
      expect(screen.getByText("Review Required")).toBeInTheDocument();
    });

    it("shows Approve/Reject/Escalate when canApprove only (no Override)", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canApprove
          canEscalate
          canOverride={false}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onEscalate={vi.fn()}
          onOverride={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Approve recommendation" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Reject recommendation" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Send for triage" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Choose different action" }),
      ).not.toBeInTheDocument();
    });

    it("shows all four actions when canApprove && canOverride && canEscalate", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canApprove
          canOverride
          canEscalate
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onOverride={vi.fn()}
          onEscalate={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Approve recommendation" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Reject recommendation" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Choose different action" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Send for triage" }),
      ).toBeInTheDocument();
    });

    it("fires onApprove with comment when Approve confirmed", async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canApprove
          onApprove={onApprove}
        />,
      );
      await user.click(
        screen.getByRole("button", { name: "Approve recommendation" }),
      );
      expect(screen.getByText("Approval Comment")).toBeInTheDocument();
      await user.type(
        screen.getByPlaceholderText("Add approval notes (optional)..."),
        "Looks correct",
      );
      await user.click(screen.getByText("Confirm Approval"));
      expect(onApprove).toHaveBeenCalledTimes(1);
      expect(onApprove).toHaveBeenCalledWith("Looks correct");
    });
  });

  describe("RED verdict — Option A matrix", () => {
    it("shows Override + Escalate when canOverride && canEscalate, no Acknowledge", () => {
      render(
        <AgentReasoningCard
          verdict="RED"
          canOverride
          canEscalate
          onOverride={vi.fn()}
          onEscalate={vi.fn()}
          onApprove={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Choose different action" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Send for triage" }),
      ).toBeInTheDocument();
      // The old "Acknowledge" button has been removed — it silently called
      // approve, which was semantically wrong.
      expect(screen.queryByText("Acknowledge")).not.toBeInTheDocument();
    });

    it("shows 'Blocked by Policy' badge", () => {
      render(<AgentReasoningCard verdict="RED" />);
      expect(screen.getByText("Blocked by Policy")).toBeInTheDocument();
    });

    it("shows policy hits when provided", () => {
      render(
        <AgentReasoningCard verdict="RED" policyHits={["PENALTY_MATRIX_VIOLATION"]} />,
      );
      expect(screen.getByText("PENALTY_MATRIX_VIOLATION")).toBeInTheDocument();
    });

    it("hides Override when canOverride=false", () => {
      render(
        <AgentReasoningCard
          verdict="RED"
          canOverride={false}
          canEscalate
          onOverride={vi.fn()}
          onEscalate={vi.fn()}
        />,
      );
      expect(
        screen.queryByRole("button", { name: "Choose different action" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Send for triage" }),
      ).toBeInTheDocument();
    });
  });

  describe("FAILED / execution error", () => {
    it("shows only 'Escalate for Triage'", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          executionError={{ message: "Gateway timed out" }}
          canApprove
          canEscalate
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onEscalate={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Send for triage" }),
      ).toHaveTextContent("Escalate for Triage");
      expect(screen.queryByText("Approve")).not.toBeInTheDocument();
      expect(screen.queryByText("Reject")).not.toBeInTheDocument();
    });
  });

  describe("Accessible names (WCAG 2.5.3)", () => {
    it("Approve → 'Approve recommendation'", () => {
      render(
        <AgentReasoningCard verdict="YELLOW" canApprove onApprove={vi.fn()} />,
      );
      expect(
        screen.getByRole("button", { name: "Approve recommendation" }),
      ).toHaveTextContent("Approve");
    });

    it("Reject → 'Reject recommendation'", () => {
      render(
        <AgentReasoningCard verdict="YELLOW" canApprove onReject={vi.fn()} />,
      );
      expect(
        screen.getByRole("button", { name: "Reject recommendation" }),
      ).toHaveTextContent("Reject");
    });

    it("Override → 'Choose different action'", () => {
      render(
        <AgentReasoningCard verdict="YELLOW" canOverride onOverride={vi.fn()} />,
      );
      const btn = screen.getByRole("button", { name: "Choose different action" });
      expect(btn).toHaveTextContent("Override");
      // Trailing ellipsis on the visible label.
      expect(btn.textContent).toContain("…");
    });

    it("Escalate → 'Send for triage'", () => {
      render(
        <AgentReasoningCard verdict="YELLOW" canEscalate onEscalate={vi.fn()} />,
      );
      expect(
        screen.getByRole("button", { name: "Send for triage" }),
      ).toHaveTextContent("Escalate");
    });

    it("Re-analyze → 'Re-analyze exception'", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canReanalyze
          onReanalyze={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Re-analyze exception" }),
      ).toBeInTheDocument();
    });
  });

  describe("Pessimistic UI — actionInFlight", () => {
    it("shows 'Overriding…' and disables peers when actionInFlight='override'", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canApprove
          canOverride
          canEscalate
          actionInFlight="override"
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onOverride={vi.fn()}
          onEscalate={vi.fn()}
        />,
      );
      const override = screen.getByRole("button", { name: "Choose different action" });
      expect(override).toHaveTextContent("Overriding…");
      expect(override).toBeDisabled();
      // Peers are disabled too — no double-submit.
      expect(
        screen.getByRole("button", { name: "Approve recommendation" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Reject recommendation" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Send for triage" }),
      ).toBeDisabled();
    });

    it("shows 'Approving…' when actionInFlight='approve'", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canApprove
          actionInFlight="approve"
          onApprove={vi.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Approve recommendation" }),
      ).toHaveTextContent("Approving…");
    });
  });

  describe("Re-analyze affordance", () => {
    it("is hidden on GREEN (no outcome-shopping on auto-resolved)", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          canReanalyze
          onReanalyze={vi.fn()}
        />,
      );
      expect(screen.queryByText("Re-analyze")).not.toBeInTheDocument();
    });

    it("is shown on YELLOW", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canReanalyze
          onReanalyze={vi.fn()}
        />,
      );
      expect(screen.getByText("Re-analyze")).toBeInTheDocument();
    });

    it("is shown on RED", () => {
      render(
        <AgentReasoningCard
          verdict="RED"
          canReanalyze
          onReanalyze={vi.fn()}
        />,
      );
      expect(screen.getByText("Re-analyze")).toBeInTheDocument();
    });

    it("is shown when executionError is present (regardless of verdict)", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          executionError={{ message: "Gateway timed out" }}
          canReanalyze
          onReanalyze={vi.fn()}
        />,
      );
      expect(screen.getByText("Re-analyze")).toBeInTheDocument();
    });

    it("is hidden when no onReanalyze handler provided (permission-gated)", () => {
      render(<AgentReasoningCard verdict="YELLOW" />);
      expect(screen.queryByText("Re-analyze")).not.toBeInTheDocument();
    });

    it("disables the button when attempts are exhausted", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canReanalyze
          onReanalyze={vi.fn()}
          reanalyzeAttempts={3}
          reanalyzeMax={3}
        />,
      );
      expect(screen.queryByText("Re-analyze")).not.toBeInTheDocument();
    });

    it("displays the attempt counter", () => {
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canReanalyze
          onReanalyze={vi.fn()}
          reanalyzeAttempts={1}
          reanalyzeMax={3}
        />,
      );
      expect(screen.getByText("1/3")).toBeInTheDocument();
    });

    it("requires a non-empty reason before firing onReanalyze", async () => {
      const user = userEvent.setup();
      const onReanalyze = vi.fn();
      render(
        <AgentReasoningCard
          verdict="YELLOW"
          canReanalyze
          onReanalyze={onReanalyze}
        />,
      );

      await user.click(screen.getByText("Re-analyze"));
      expect(screen.getByText(/Reanalyze Reason \(required\)/)).toBeInTheDocument();
      const confirm = screen.getByText("Confirm Re-analyze");
      expect(confirm).toBeDisabled();
      expect(onReanalyze).not.toHaveBeenCalled();

      await user.type(
        screen.getByPlaceholderText(/Why should this be re-run/),
        "Contract uploaded",
      );
      expect(confirm).toBeEnabled();
      await user.click(confirm);
      expect(onReanalyze).toHaveBeenCalledWith("Contract uploaded");
    });
  });

  describe("Execution error", () => {
    it("shows 'Execution Failed' badge when executionError is provided", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          executionError={{
            node: "execute_recipe",
            message: "Gateway timed out after 30000ms",
            failedAt: "2026-04-15T14:05:42Z",
          }}
        />,
      );
      expect(screen.getByText("Execution Failed")).toBeInTheDocument();
      expect(screen.queryByText("Auto-resolved")).not.toBeInTheDocument();
    });

    it("renders the failed pipeline node label", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          executionError={{ node: "execute_recipe", message: "boom" }}
        />,
      );
      expect(screen.getByText("Failed at Execute Recipe")).toBeInTheDocument();
    });

    it("falls back to generic 'Pipeline failure' label when node is unknown", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          executionError={{ message: "unexpected error" }}
        />,
      );
      expect(screen.getByText("Pipeline failure")).toBeInTheDocument();
    });

    it("renders the error message verbatim", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          executionError={{ message: "Gateway returned TIMEOUT after 30s" }}
        />,
      );
      expect(screen.getByText("Gateway returned TIMEOUT after 30s")).toBeInTheDocument();
    });

    it("suppresses the generic explanation when errored (no misleading success text)", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          explanation="Deterministic execution completed successfully."
          executionError={{ message: "Execution aborted" }}
        />,
      );
      expect(
        screen.queryByText("Deterministic execution completed successfully."),
      ).not.toBeInTheDocument();
    });

    it("uses role=alert with aria-live for screen readers", () => {
      render(
        <AgentReasoningCard
          verdict="GREEN"
          executionError={{ message: "Crash" }}
        />,
      );
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "polite");
    });
  });
});

describe("ExceptionDetailPanel escalate contract (source-level)", () => {
  // This is a source-contract test — rendering the full panel requires
  // a NextAuth SessionProvider plus a full mock graph. What we actually
  // need to verify is that the Phase-1 migration landed: the Escalate
  // button path must call exceptionsApi.escalate and NOT the old
  // exceptionsApi.override({ action: "ESCALATE" }) piggy-back.
  //
  // Reading the source verifies the wiring without coupling to a brittle
  // NextAuth test harness.
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const panel = fs.readFileSync(
    path.resolve(__dirname, "../../src/app/exceptions/ExceptionDetailPanel.tsx"),
    "utf-8",
  );

  it("handleEscalate calls exceptionsApi.escalate", () => {
    expect(panel).toMatch(/exceptionsApi\.escalate\(/);
  });

  it("no longer piggy-backs escalation on override with action=ESCALATE", () => {
    expect(panel).not.toMatch(/override\([^)]*action:\s*["']ESCALATE["']/);
  });

  it("wires canOverride / canApprove / canEscalate through to AgentReasoningCard", () => {
    expect(panel).toMatch(/canOverride=\{hasPermission\(["']exceptions:override["']\)\}/);
    expect(panel).toMatch(/canApprove=\{hasPermission\(["']exceptions:approve["']\)\}/);
    expect(panel).toMatch(/canEscalate=\{hasPermission\(["']exceptions:escalate["']\)\}/);
  });

  it("wires onOverride to a handler that opens the chooser", () => {
    expect(panel).toMatch(/onOverride=\{handleOverride\}/);
    expect(panel).toMatch(/function handleOverride\(\)/);
  });
});

describe("exceptionsApi — Idempotency-Key contract", () => {
  it("override() with an explicit idempotencyKey returns the cached response on retry", async () => {
    const key = "test-override-key-abc";
    const first = await exceptionsApi.override(
      "exc-002",
      { action: "ALLOW_BOTH", notes: "Retry test" },
      { idempotencyKey: key },
    );
    const second = await exceptionsApi.override(
      "exc-002",
      { action: "ALLOW_BOTH", notes: "Retry test" },
      { idempotencyKey: key },
    );
    expect(second).toEqual(first);
  });

  it("override() with same key + different body raises 409-equivalent conflict", async () => {
    const key = "test-override-conflict";
    await exceptionsApi.override(
      "exc-002",
      { action: "ALLOW_BOTH", notes: "First" },
      { idempotencyKey: key },
    );
    await expect(
      exceptionsApi.override(
        "exc-002",
        { action: "MERGE", notes: "Second" },
        { idempotencyKey: key },
      ),
    ).rejects.toThrow(/Idempotency-Key conflict/);
  });

  it("override() rejects malformed idempotency keys", async () => {
    await expect(
      exceptionsApi.override(
        "exc-002",
        { action: "ALLOW_BOTH", notes: "bad key" },
        { idempotencyKey: "bad key with spaces" },
      ),
    ).rejects.toThrow(/Invalid Idempotency-Key/);
  });

  it("escalate() exists and is distinct from override()", async () => {
    expect(typeof exceptionsApi.escalate).toBe("function");
    const result = await exceptionsApi.escalate(
      "exc-002",
      { reason: "Needs manager review" },
    );
    expect(result.lifecycle_state).toBe("ESCALATED");
    expect(result.resolution_notes).toContain("Needs manager review");
  });
});
