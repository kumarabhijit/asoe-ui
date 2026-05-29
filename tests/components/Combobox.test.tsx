/**
 * Combobox tests — S2 sprint follow-up #6.
 *
 * Locks the primitive's behavioural contract independently of any
 * consumer so a future consumer (a per-intent recipe override
 * picker, a global case-id search) can rely on it without
 * re-discovering the API.
 *
 * Out of scope here:
 *   * Filtering semantics under cmdk's internal scoring algorithm —
 *     cmdk's own tests cover the matcher. We only assert that the
 *     filter input is wired and that typing prunes the visible
 *     rows.
 *   * Visual styling — covered by the design-system component sweep.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { Combobox } from "@/components/ui/Combobox";

const FLAT_ITEMS = [
  { value: "ALLOW_BOTH", label: "ALLOW BOTH" },
  { value: "SUPERSEDE", label: "SUPERSEDE" },
  { value: "REJECT", label: "REJECT" },
];

describe("Combobox", () => {
  it("renders the placeholder when nothing is selected", () => {
    render(
      <Combobox
        value=""
        onChange={vi.fn()}
        items={FLAT_ITEMS}
        ariaLabel="Resolution action"
        placeholder="Select an action…"
      />,
    );
    const trigger = screen.getByRole("combobox", {
      name: /resolution action/i,
    });
    expect(trigger).toHaveTextContent(/select an action/i);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renders the selected item's label as the trigger text", () => {
    render(
      <Combobox
        value="SUPERSEDE"
        onChange={vi.fn()}
        items={FLAT_ITEMS}
        ariaLabel="Resolution action"
      />,
    );
    const trigger = screen.getByRole("combobox", {
      name: /resolution action/i,
    });
    expect(trigger).toHaveTextContent("SUPERSEDE");
  });

  it("opens the listbox on click and lists every item", () => {
    render(
      <Combobox
        value=""
        onChange={vi.fn()}
        items={FLAT_ITEMS}
        ariaLabel="Resolution action"
      />,
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: /resolution action/i }),
    );
    for (const it of FLAT_ITEMS) {
      expect(
        screen.getByRole("option", { name: new RegExp(`^${it.label}$`, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("clicking an option fires onChange with the value and closes the popover", () => {
    const onChange = vi.fn();
    render(
      <Combobox
        value=""
        onChange={onChange}
        items={FLAT_ITEMS}
        ariaLabel="Resolution action"
      />,
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: /resolution action/i }),
    );
    fireEvent.click(
      screen.getByRole("option", { name: /^SUPERSEDE$/i }),
    );
    expect(onChange).toHaveBeenCalledWith("SUPERSEDE");
    // Popover closed — listbox role gone.
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("renders groups with headings when `groups` is passed", () => {
    render(
      <Combobox
        value=""
        onChange={vi.fn()}
        groups={[
          {
            heading: "Confirm the agent",
            items: [{ value: "ALLOW_BOTH", label: "ALLOW BOTH" }],
          },
          {
            heading: "Edge case",
            items: [{ value: "OTHER", label: "OTHER" }],
          },
        ]}
        ariaLabel="Override reason category"
      />,
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: /override reason category/i }),
    );
    expect(screen.getByText("Confirm the agent")).toBeInTheDocument();
    expect(screen.getByText("Edge case")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^ALLOW BOTH$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^OTHER$/i }),
    ).toBeInTheDocument();
  });

  it("typing in the filter input prunes the visible rows", () => {
    render(
      <Combobox
        value=""
        onChange={vi.fn()}
        items={FLAT_ITEMS}
        ariaLabel="Resolution action"
        filterPlaceholder="Filter actions…"
      />,
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: /resolution action/i }),
    );
    const input = screen.getByPlaceholderText(/filter actions/i);
    fireEvent.change(input, { target: { value: "SUP" } });
    // Only SUPERSEDE matches "SUP". cmdk hides non-matching rows
    // from the a11y tree (aria-hidden) — they may still exist in the
    // DOM. We assert via role queries which respect the hidden state.
    expect(
      screen.getByRole("option", { name: /^SUPERSEDE$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /^REJECT$/i }),
    ).not.toBeInTheDocument();
  });

  it("declares aria-required on the trigger when required=true", () => {
    render(
      <Combobox
        value=""
        onChange={vi.fn()}
        items={FLAT_ITEMS}
        ariaLabel="Resolution action"
        required
      />,
    );
    expect(
      screen.getByRole("combobox", { name: /resolution action/i }),
    ).toHaveAttribute("aria-required", "true");
  });

  it("Escape inside the open popover closes it", () => {
    render(
      <Combobox
        value=""
        onChange={vi.fn()}
        items={FLAT_ITEMS}
        ariaLabel="Resolution action"
      />,
    );
    fireEvent.click(
      screen.getByRole("combobox", { name: /resolution action/i }),
    );
    expect(screen.getByRole("option", { name: /^REJECT$/i })).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/type to filter/i);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
