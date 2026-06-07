/**
 * MultiSelect tests — trigger accessible name.
 *
 * Report 08: the trigger's aria-label OVERRIDES the visible selection text
 * for screen readers, so without the selection composed into the label an SR
 * user heard only the static "Filter by …" and never the count or values.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MultiSelect } from "@/components/ui/MultiSelect";

describe("MultiSelect trigger accessible name", () => {
  it("announces 'none selected' when nothing is chosen", () => {
    render(
      <MultiSelect
        options={["A", "B", "C"]}
        value={[]}
        onChange={() => {}}
        placeholder="All states"
        ariaLabel="Filter by state"
      />,
    );
    expect(
      screen.getByLabelText("Filter by state, none selected"),
    ).toBeInTheDocument();
  });

  // REGRESSION (fails on parent): the count + names were missing from the
  // accessible name.
  it("includes the selected count and names in the accessible label", () => {
    render(
      <MultiSelect
        options={["A", "B", "C"]}
        value={["A", "B"]}
        onChange={() => {}}
        placeholder="All states"
        ariaLabel="Filter by state"
      />,
    );
    expect(
      screen.getByLabelText("Filter by state, 2 selected: A, B"),
    ).toBeInTheDocument();
  });
});
