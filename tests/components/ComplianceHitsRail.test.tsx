/**
 * ComplianceHitsRail tests — ADR-041 P3e §2.3.
 *
 * The component is the canonical Compliance Shadow hits projector
 * for the `/cases` workspace. Two variants:
 *   * `inline` — legacy stacked card chrome
 *   * `rail` — xl third-column treatment (no shadow, side-rail
 *     surface, own scroll container)
 *
 * Both must return null when there are no hits (Guardrail #6 — no
 * synthesised "no hits" placeholder).
 */
import { render, screen } from "@testing-library/react";

import { ComplianceHitsRail } from "@/app/cases/ComplianceHitsRail";

describe("ComplianceHitsRail", () => {
  it("returns null when there are no hits (no placeholder)", () => {
    const { container } = render(<ComplianceHitsRail hits={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("inline variant renders the legacy stacked card chrome", () => {
    const { container } = render(
      <ComplianceHitsRail
        hits={["PENALTY_MATRIX", "LLM_SHADOW:UNUSUAL_BUYER"]}
        variant="inline"
      />,
    );
    const section = screen.getByRole("region", {
      name: /Compliance Shadow hits/i,
    });
    expect(section).toBeInTheDocument();
    expect(section.className).toMatch(/shadow-xs/);
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("rail variant uses the side-rail surface (own scroll)", () => {
    render(
      <ComplianceHitsRail
        hits={["PENALTY_MATRIX"]}
        variant="rail"
      />,
    );
    const section = screen.getByRole("region", {
      name: /Compliance Shadow hits/i,
    });
    expect(section.className).toMatch(/bg-surface-secondary/);
    expect(section.className).toMatch(/overflow-y-auto/);
    // Rail variant must NOT carry the legacy card shadow.
    expect(section.className).not.toMatch(/shadow-xs/);
  });

  it("renders the count next to the heading", () => {
    render(
      <ComplianceHitsRail
        hits={["A", "B", "C"]}
        variant="rail"
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("defaults to inline variant when not specified", () => {
    render(<ComplianceHitsRail hits={["A"]} />);
    const section = screen.getByRole("region", {
      name: /Compliance Shadow hits/i,
    });
    expect(section.className).toMatch(/shadow-xs/);
  });
});
