/**
 * PolicyHitBadge — visual contract for L1-rule vs L2-LLM hits.
 *
 * The backend stamps L2-LLM-derived concerns with `LLM_SHADOW:`
 * (per `compliance.shadow_llm.combine_verdicts` and ADR-039 §4.5).
 * The badge surfaces that distinction visually so a reviewer
 * can tell at a glance which concerns came from rules vs the AI
 * second opinion.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PolicyHitBadge } from "@/components/ui/PolicyHitBadge";


describe("PolicyHitBadge", () => {
  it("renders a rule-based hit as plain text (no AI badge)", () => {
    render(<PolicyHitBadge hit="MK-2026-12" />);
    expect(screen.getByText("MK-2026-12")).toBeInTheDocument();
    // No AI prefix — the backend didn't stamp LLM_SHADOW: on this one.
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
  });

  // REGRESSION (report 07): the rule branch had no aria-label while the LLM
  // branch did, giving SR users an asymmetric experience. Name the source.
  it("provides a symmetric accessible label naming the rule source", () => {
    render(<PolicyHitBadge hit="MK-2026-12" />);
    expect(
      screen.getByLabelText(/Policy rule: MK-2026-12/i),
    ).toBeInTheDocument();
  });

  it("renders an LLM-derived hit with the AI prefix", () => {
    render(<PolicyHitBadge hit="LLM_SHADOW:CUSTOMER_OPT_OUT_VIOLATION" />);
    // Concern name visible without the prefix.
    expect(
      screen.getByText("CUSTOMER_OPT_OUT_VIOLATION"),
    ).toBeInTheDocument();
    // AI text-pill visible (text-not-color per WCAG 1.4.1).
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("strips whitespace after the LLM_SHADOW prefix", () => {
    // The backend canonicalises but defence-in-depth here too.
    render(<PolicyHitBadge hit="LLM_SHADOW:   HIGH_VALUE_THRESHOLD_PROXIMITY" />);
    expect(
      screen.getByText("HIGH_VALUE_THRESHOLD_PROXIMITY"),
    ).toBeInTheDocument();
  });

  it("provides an accessible label for SR readers on LLM hits", () => {
    render(<PolicyHitBadge hit="LLM_SHADOW:BLANKET_PO_RELEASE_MISIDENTIFIED" />);
    expect(
      screen.getByLabelText(
        /AI second-opinion concern: BLANKET_PO_RELEASE_MISIDENTIFIED/i,
      ),
    ).toBeInTheDocument();
  });

  it("accepts a className override without dropping the visual contract", () => {
    render(
      <PolicyHitBadge
        hit="LLM_SHADOW:CONTRACT_BAND_VIOLATION"
        className="custom-extra"
      />,
    );
    // Concern still rendered; the AI pill still present.
    expect(screen.getByText("CONTRACT_BAND_VIOLATION")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("does not crash when hit is just the bare prefix (defensive)", () => {
    // Defensive: backend should never emit a bare prefix, but if
    // someone ever does, render an empty-concern badge instead of
    // throwing.
    render(<PolicyHitBadge hit="LLM_SHADOW:" />);
    // The AI badge still renders; the concern part is empty.
    expect(screen.getByText("AI")).toBeInTheDocument();
  });
});
