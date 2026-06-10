/**
 * ViewModeToggle tests — Legacy/Modern picker, aria radio state,
 * persistence, hydration guard.
 *
 * Unlike ThemeToggle (which mocks next-themes), this drives the REAL
 * ViewModeProvider so the test proves the end-to-end contract: a
 * selection persists to localStorage and the active radio reflects it.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { ViewModeToggle } from "@/components/ui/ViewModeToggle";
import { ViewModeProvider } from "@/hooks/useViewMode";

const STORAGE_KEY = "asoe.view-mode";

function renderToggle(node: ReactNode = <ViewModeToggle />) {
  return render(<ViewModeProvider>{node}</ViewModeProvider>);
}

describe("ViewModeToggle", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("renders a trigger button with an icon", () => {
    renderToggle();
    const trigger = screen.getByRole("button", { name: /change view/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger.querySelector("svg")).toBeInTheDocument();
  });

  it("exposes the active view in the aria-label after mount", async () => {
    renderToggle();
    const trigger = await screen.findByRole("button", {
      name: /change view \(current: legacy view\)/i,
    });
    expect(trigger).toBeInTheDocument();
  });

  it("opens the menu and shows both governed options", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: /change view/i }));
    expect(await screen.findByText("Legacy view")).toBeInTheDocument();
    expect(screen.getByText("Modern view")).toBeInTheDocument();
  });

  it("marks Legacy as the checked radio by default (env flag off)", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: /change view/i }));
    const legacy = await screen.findByRole("menuitemradio", {
      name: /legacy view/i,
    });
    const modern = screen.getByRole("menuitemradio", { name: /modern view/i });
    expect(legacy).toHaveAttribute("aria-checked", "true");
    expect(modern).toHaveAttribute("aria-checked", "false");
  });

  it("persists Modern when selected and reflects it on reopen", async () => {
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole("button", { name: /change view/i }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: /modern view/i }),
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("modern");

    // Reopen — the active radio now reflects the stored choice.
    await user.click(screen.getByRole("button", { name: /change view/i }));
    const modern = await screen.findByRole("menuitemradio", {
      name: /modern view/i,
    });
    expect(modern).toHaveAttribute("aria-checked", "true");
  });
});
