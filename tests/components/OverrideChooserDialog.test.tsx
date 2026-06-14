/**
 * Phase 2 — OverrideChooserDialog inline validation.
 *
 * "Disabled is never silent" (ADR-045 CP3): when a mandatory field is
 * missing, the dialog must explain — inline — why Confirm is inert,
 * rather than presenting a dead button. These tests lock the
 * consolidated blocked-reason status text and the enabled/disabled
 * Confirm gating. They fail on the parent commit (no blocked-reason
 * surface existed).
 */
import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { OverrideChooserDialog } from "@/app/exceptions/OverrideChooserDialog";

const BASE = {
  open: true,
  onOpenChange: () => {},
  onActionChange: () => {},
  onReasonTagChange: () => {},
  onNotesChange: () => {},
  onSubmit: vi.fn(),
  submitting: false,
  allowedActions: ["MERGE", "SUPERSEDE"] as const,
  allowedReasonTags: ["contract_terms", "buyer_confirmed"] as const,
};

describe("OverrideChooserDialog inline validation", () => {
  it("explains the first missing field and disables Confirm when empty", () => {
    render(
      <OverrideChooserDialog {...BASE} action="" reasonTag="" notes="" />,
    );
    expect(screen.getByText("Choose a resolution action.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirm Override/i }),
    ).toBeDisabled();
  });

  it("advances the blocked reason to the reason field once an action is chosen", () => {
    render(
      <OverrideChooserDialog {...BASE} action="MERGE" reasonTag="" notes="" />,
    );
    expect(screen.getByText("Choose a reason category.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirm Override/i }),
    ).toBeDisabled();
  });

  it("clears the blocked reason and enables Confirm when valid", () => {
    render(
      <OverrideChooserDialog
        {...BASE}
        action="MERGE"
        reasonTag="contract_terms"
        notes=""
      />,
    );
    expect(screen.queryByText(/^Choose a/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirm Override/i }),
    ).toBeEnabled();
  });
});
