/**
 * ScaffoldDataBanner / SampleDataTag — non-live data provenance cue.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SampleDataTag, isMockDataMode } from "@/components/ui/ScaffoldDataBanner";

describe("SampleDataTag", () => {
  it("renders a labelled note in mock-data mode", () => {
    render(<SampleDataTag mockOverride={true} />);
    const note = screen.getByRole("note");
    expect(note).toHaveAttribute("aria-label", expect.stringMatching(/not live/i));
    expect(note).toHaveTextContent(/Sample data/i);
  });

  it("renders nothing in live mode (so it never appears on a real backend)", () => {
    const { container } = render(<SampleDataTag mockOverride={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("honours a custom label", () => {
    render(<SampleDataTag mockOverride={true} label="Demo feed" />);
    expect(screen.getByRole("note")).toHaveTextContent("Demo feed");
  });
});

describe("isMockDataMode", () => {
  it("respects the override", () => {
    expect(isMockDataMode(true)).toBe(true);
    expect(isMockDataMode(false)).toBe(false);
  });
});
