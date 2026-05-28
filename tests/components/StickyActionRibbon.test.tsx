/**
 * StickyActionRibbon tests — ADR-041 P3e §2.2.
 *
 * The ribbon delegates to `<ActionButtonMatrix>` for the verdict ×
 * permission logic (covered by ActionButtonMatrix.test.tsx). These
 * cases lock the ribbon-specific contract: it carries the
 * `action-ribbon` anchor id so the slim-header skip-link can
 * target it, the section has a region label, and the wrapper
 * applies `position: sticky`.
 */
import { render, screen } from "@testing-library/react";

import { StickyActionRibbon } from "@/components/ui/StickyActionRibbon";

describe("StickyActionRibbon", () => {
  it("mounts with id=action-ribbon for the slim-header skip-link", () => {
    const { container } = render(
      <StickyActionRibbon verdict="YELLOW" canApprove onApprove={() => {}} />,
    );
    expect(container.querySelector("#action-ribbon")).not.toBeNull();
  });

  it("custom id override is respected", () => {
    const { container } = render(
      <StickyActionRibbon
        id="my-anchor"
        verdict="YELLOW"
        canApprove
        onApprove={() => {}}
      />,
    );
    expect(container.querySelector("#my-anchor")).not.toBeNull();
    expect(container.querySelector("#action-ribbon")).toBeNull();
  });

  it("region is labelled 'Recommended actions' for SR navigation", () => {
    render(
      <StickyActionRibbon verdict="YELLOW" canApprove onApprove={() => {}} />,
    );
    expect(
      screen.getByRole("region", { name: /Recommended actions/i }),
    ).toBeInTheDocument();
  });

  it("renders as a card-chromed surface (mounted above the scroll container)", () => {
    // The previous version applied `position: sticky` inside
    // ExceptionDetailPanel's inner scroll container — broken,
    // because the sticky reference was the same surface that
    // scrolled, so the ribbon scrolled away with its content.
    // The ribbon now mounts as a sibling of the scroll container
    // (see file-top comment in StickyActionRibbon.tsx); pinning is
    // achieved by being outside the scroll surface, not by
    // `position: sticky`. This test guards against re-adding the
    // broken sticky positioning.
    const { container } = render(
      <StickyActionRibbon verdict="YELLOW" canApprove onApprove={() => {}} />,
    );
    const section = container.querySelector("section");
    expect(section?.className).not.toMatch(/\bsticky\b/);
    expect(section?.className).toMatch(/bg-surface-primary/);
    expect(section?.className).toMatch(/shadow-sm/);
  });

  it("renders the matrix's buttons (delegation, not duplication)", () => {
    render(
      <StickyActionRibbon
        verdict="YELLOW"
        onApprove={() => {}}
        onReject={() => {}}
        onEscalate={() => {}}
        canApprove
        canEscalate
      />,
    );
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /triage/i })).toBeInTheDocument();
  });
});
