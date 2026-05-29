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


/* ── S2 sprint 2026-05-28 — hotkey + mandatory reason_tag locks ─── */

// `act` is required around document-level dispatchEvent — see the
// note in `tests/hooks/useHotkeys.test.ts`. The hotkey handler
// inside ActionButtonMatrix calls setPendingAction, and the
// assertions below depend on that state update having flushed.
import { act } from "@testing-library/react";

function press(key: string, opts: KeyboardEventInit = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, ...opts }));
  });
}

describe("ActionButtonMatrix — S2 #3 ribbon hotkeys", () => {
  it("A opens the Approve comment dialog on YELLOW + canApprove", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        onReject={onReject}
        onEscalate={onEscalate}
        canApprove
        canEscalate
      />,
    );
    press("a");
    // The pending-action panel surfaces a Cancel button — the
    // sentinel that the matrix flipped into the comment swap.
    expect(
      screen.getByRole("button", { name: /^cancel$/i }),
    ).toBeInTheDocument();
  });

  it("R opens the Reject comment dialog on YELLOW + canApprove", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        onReject={onReject}
        canApprove
      />,
    );
    press("r");
    expect(
      screen.getByText(/rejection (comment|reason)/i),
    ).toBeInTheDocument();
  });

  it("O fires onOverride on YELLOW + canOverride", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        onOverride={onOverride}
        canApprove
        canOverride
      />,
    );
    press("o");
    expect(onOverride).toHaveBeenCalledOnce();
  });

  it("E fires onEscalate on YELLOW + canEscalate", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        onEscalate={onEscalate}
        canApprove
        canEscalate
      />,
    );
    press("e");
    expect(onEscalate).toHaveBeenCalledOnce();
  });

  it("Y opens the Reanalyze comment dialog when allowed", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        onReanalyze={onReanalyze}
        canApprove
        canReanalyze
      />,
    );
    press("y");
    expect(screen.getByText(/reanalyze reason/i)).toBeInTheDocument();
  });

  it("A does NOT fire when the operator lacks canApprove", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove={false}
      />,
    );
    press("a");
    expect(
      screen.queryByRole("button", { name: /^cancel$/i }),
    ).not.toBeInTheDocument();
  });

  it("Hotkeys do not fire on GREEN where Approve is not surfaced", () => {
    render(
      <ActionButtonMatrix
        verdict="GREEN"
        recommendedAction="ALLOW_BOTH"
        onApprove={onApprove}
        canApprove
      />,
    );
    press("a");
    expect(
      screen.queryByRole("button", { name: /^cancel$/i }),
    ).not.toBeInTheDocument();
  });

  it("Hotkeys are inert while a comment dialog is open (typing precedence)", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        onOverride={onOverride}
        canApprove
        canOverride
      />,
    );
    press("a"); // opens the approve dialog
    onOverride.mockClear();
    press("o"); // must NOT trigger override while comment swap is open
    expect(onOverride).not.toHaveBeenCalled();
  });
});


describe("ActionButtonMatrix — S2 #7 mandatory reason_tag on YELLOW/RED", () => {
  const TAGS = ["CONTRACT_PRICE_CORRECTION", "CUSTOMER_REQUEST", "OTHER"] as const;

  it("renders a mandatory tag Select above the textarea on YELLOW Approve", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove
        availableReasonTags={TAGS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /block and notify/i }));
    expect(
      screen.getByRole("combobox", { name: /approval reason category/i }),
    ).toBeInTheDocument();
    // The Select carries aria-required.
    expect(
      screen.getByRole("combobox", { name: /approval reason category/i }),
    ).toHaveAttribute("aria-required", "true");
  });

  it("Confirm Approval is disabled until a tag is picked", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove
        availableReasonTags={TAGS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /block and notify/i }));
    const confirm = screen.getByRole("button", { name: /confirm approval/i });
    expect(confirm).toBeDisabled();
    // After picking a tag the Confirm enables and the callback fires
    // with the picked tag as the override.
    fireEvent.change(
      screen.getByRole("combobox", { name: /approval reason category/i }),
      { target: { value: "CUSTOMER_REQUEST" } },
    );
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onApprove).toHaveBeenCalledWith("", "CUSTOMER_REQUEST");
  });

  it("Cmd+Enter cannot bypass the mandatory tag gate", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove
        availableReasonTags={TAGS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /block and notify/i }));
    // textarea is rendered but not autoFocus when the Select owns
    // focus; querying directly.
    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("GREEN keeps the optional-comment path — no tag picker, Confirm enabled immediately", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove
        // GREEN normally hides Approve, but the gate predicate (#7)
        // also relies on verdict — passing GREEN to a render path
        // where Approve isn't visible is the wrong setup. Instead
        // we confirm the gate is off when `availableReasonTags` is
        // empty even on YELLOW.
        availableReasonTags={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /block and notify/i }));
    expect(
      screen.queryByRole("combobox", { name: /reason category/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /confirm approval/i }),
    ).not.toBeDisabled();
  });
});


describe("ActionButtonMatrix — S2 #4 Cmd+Enter discoverability", () => {
  it("placeholder copy advertises ⌘↵ in every comment dialog variant", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /block and notify/i }));
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "placeholder",
      expect.stringMatching(/⌘↵/),
    );
  });

  it("Confirm Approval button carries aria-keyshortcuts=\"Meta+Enter\"", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /block and notify/i }));
    expect(
      screen.getByRole("button", { name: /confirm approval/i }),
    ).toHaveAttribute("aria-keyshortcuts", "Meta+Enter");
  });
});


describe("ActionButtonMatrix — S2 #10 aria-live on comment dialog", () => {
  it("optional-comment variant (no tag picker) carries an explicit aria-label and aria-live=polite", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove
        // No availableReasonTags = optional-comment path (no
        // mandatory tag gate). Pre-S2-#10 this branch had no
        // aria-label and no live announcement, so screen readers
        // heard nothing when the dialog opened.
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /block and notify/i }));
    const container = screen
      .getByPlaceholderText(/add approval notes \(optional\)/i)
      .closest("div[aria-live]");
    expect(container, "comment dialog wrapper must declare aria-live").not.toBeNull();
    expect(container).toHaveAttribute("aria-live", "polite");
    expect(container).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/approval comment/i),
    );
  });

  it("mandatory-tag variant keeps role=dialog + aria-live=polite", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        recommendedAction="BLOCK_AND_NOTIFY"
        onApprove={onApprove}
        canApprove
        availableReasonTags={["A_TAG", "B_TAG"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /block and notify/i }));
    const dialog = screen.getByRole("dialog", { name: /approval reason required/i });
    expect(dialog).toHaveAttribute("aria-live", "polite");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("YELLOW ribbon shows a kbd hint on every visible button (S2 #13)", () => {
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onApprove={onApprove}
        onReject={onReject}
        onEscalate={onEscalate}
        onOverride={onOverride}
        onReanalyze={onReanalyze}
        canApprove
        canEscalate
        canOverride
        canReanalyze
      />,
    );
    // Approve/Reject/Override/Escalate/Re-analyze all surfaced on
    // YELLOW. The kbd hint sits inside the button as an aria-hidden
    // element; querying via the button accessible name and reading
    // the kbd child is the cleanest assertion.
    const buttons = [
      { name: /approve/i, letter: "A" },
      { name: /reject/i, letter: "R" },
      { name: /choose different action/i, letter: "O" },
      { name: /triage/i, letter: "E" },
      { name: /re-analyze/i, letter: "Y" },
    ];
    for (const { name, letter } of buttons) {
      const button = screen.getByRole("button", { name });
      const kbd = button.querySelector("kbd");
      expect(kbd, `${name} button must carry a kbd hint`).not.toBeNull();
      expect(kbd?.textContent).toBe(letter);
      expect(kbd).toHaveAttribute("aria-hidden");
    }
  });

  it("Rejection optional-comment variant labels itself as a rejection", () => {
    // No `recommendedAction` so the matrix uses the generic
    // primary/secondary labels ("Approve" / "Reject") instead of
    // a recipe-driven label like "Block and notify".
    render(
      <ActionButtonMatrix
        verdict="YELLOW"
        onApprove={onApprove}
        onReject={onReject}
        canApprove
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    const container = screen
      .getByRole("textbox")
      .closest("div[aria-live]");
    expect(container).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/rejection comment/i),
    );
  });
});
