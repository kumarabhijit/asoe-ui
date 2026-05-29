/**
 * SlaBandAnnouncer — S3 sprint 2026-05-29 finding #B.
 *
 * Locks the "announce on transition, silence on tick" contract.
 * Sighted users see the chip color flip; SR users now hear it too,
 * but only when the band actually changes.
 */
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SlaBandAnnouncer } from "@/components/ui/SlaBandAnnouncer";
import type { SlaSnapshot } from "@/types/cases";

function sla(band: SlaSnapshot["band"], label = "label"): SlaSnapshot {
  return { band, label, deadline: null, ms_until_deadline: 0 };
}

function getLiveRegion(container: HTMLElement): HTMLElement {
  const region = container.querySelector<HTMLElement>(
    "[role='status'][aria-live='polite']",
  );
  if (!region) throw new Error("live region not found");
  return region;
}

describe("SlaBandAnnouncer", () => {
  it("renders an empty live region on first sight of a case (no false alarm)", () => {
    const { container } = render(
      <SlaBandAnnouncer sla={sla("at_risk", "2h left")} caseId="case-A" />,
    );
    const region = getLiveRegion(container);
    // Baseline: the operator's eye is already on the chip; we don't
    // announce the initial state.
    expect(region.textContent).toBe("");
  });

  it("announces only when the band changes for the SAME case", () => {
    const { container, rerender } = render(
      <SlaBandAnnouncer sla={sla("comfortable", "2d left")} caseId="case-A" />,
    );
    // Tick the label without crossing a band — no announcement.
    rerender(
      <SlaBandAnnouncer sla={sla("comfortable", "1d 23h left")} caseId="case-A" />,
    );
    expect(getLiveRegion(container).textContent).toBe("");
    // Cross a band — announce.
    rerender(
      <SlaBandAnnouncer sla={sla("at_risk", "3h left")} caseId="case-A" />,
    );
    expect(getLiveRegion(container).textContent).toBe("Case case-A: SLA at risk");
    // Cross again — announce the new band.
    rerender(
      <SlaBandAnnouncer sla={sla("breached", "Breached 5m ago")} caseId="case-A" />,
    );
    expect(getLiveRegion(container).textContent).toBe("Case case-A: SLA breached");
  });

  it("re-baselines when caseId changes (no announcement on case switch)", () => {
    const { container, rerender } = render(
      <SlaBandAnnouncer sla={sla("at_risk", "3h left")} caseId="case-A" />,
    );
    // Switch cases — the new case starts in a different band, but
    // that is not a TRANSITION for the new case, just a baseline.
    rerender(
      <SlaBandAnnouncer sla={sla("breached", "Breached")} caseId="case-B" />,
    );
    expect(getLiveRegion(container).textContent).toBe("");
  });

  it("is silent for transitions through the `none` band (no SLA on the case)", () => {
    const { container, rerender } = render(
      <SlaBandAnnouncer sla={sla("at_risk", "3h left")} caseId="case-A" />,
    );
    rerender(
      <SlaBandAnnouncer sla={sla("none", "")} caseId="case-A" />,
    );
    // No announcement — there's nothing operator-meaningful to say.
    expect(getLiveRegion(container).textContent).toBe("");
  });

  it("announces a recovery transition (at_risk → comfortable)", () => {
    const { container, rerender } = render(
      <SlaBandAnnouncer sla={sla("at_risk", "3h left")} caseId="case-A" />,
    );
    rerender(
      <SlaBandAnnouncer sla={sla("comfortable", "2d left")} caseId="case-A" />,
    );
    expect(getLiveRegion(container).textContent).toBe("Case case-A: SLA on track");
  });

  it("is silent when caseId is undefined", () => {
    const { container } = render(
      <SlaBandAnnouncer sla={sla("breached")} caseId={undefined} />,
    );
    expect(getLiveRegion(container).textContent).toBe("");
  });
});
