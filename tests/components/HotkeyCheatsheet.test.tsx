/**
 * HotkeyCheatsheet — `?` overlay (S2 sprint 2026-05-28 finding #5).
 *
 * The cheatsheet was deliberately mounted as a self-contained
 * component (no props, owns its own hotkey listener) so the page-
 * level mount stays a one-liner. These tests pin:
 *
 *   * `?` opens the overlay.
 *   * Escape closes it.
 *   * Hidden by default — no DOM weight on first paint.
 *   * Bindings rendered are sourced from the registry (the
 *     architectural lock at `s2_hotkey_registry_lock.test.ts`
 *     enforces the source-grep; this is the partner render check).
 */
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { HotkeyCheatsheet } from "@/components/ui/HotkeyCheatsheet";
import { HOTKEYS } from "@/lib/hotkeys";

function press(key: string, opts: KeyboardEventInit = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, ...opts }));
  });
}

describe("HotkeyCheatsheet", () => {
  it("is closed by default — no dialog on first paint", () => {
    render(<HotkeyCheatsheet />);
    expect(
      screen.queryByRole("dialog", { name: /keyboard shortcuts/i }),
    ).not.toBeInTheDocument();
  });

  it("opens on ? (Shift+/)", () => {
    render(<HotkeyCheatsheet />);
    press("?", { shiftKey: true });
    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<HotkeyCheatsheet />);
    press("?", { shiftKey: true });
    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
    press("Escape");
    expect(
      screen.queryByRole("dialog", { name: /keyboard shortcuts/i }),
    ).not.toBeInTheDocument();
  });

  it("renders every registry binding's description", () => {
    render(<HotkeyCheatsheet />);
    press("?", { shiftKey: true });
    for (const h of HOTKEYS) {
      // Description is the visible row label; presence in the DOM
      // is the partner of the architectural source-grep lock.
      expect(
        screen.getByText(h.description),
        `cheatsheet must surface "${h.description}" (registry id ${h.id})`,
      ).toBeInTheDocument();
    }
  });

  it("`?` toggles closed when already open", () => {
    render(<HotkeyCheatsheet />);
    press("?", { shiftKey: true });
    expect(
      screen.getByRole("dialog", { name: /keyboard shortcuts/i }),
    ).toBeInTheDocument();
    press("?", { shiftKey: true });
    expect(
      screen.queryByRole("dialog", { name: /keyboard shortcuts/i }),
    ).not.toBeInTheDocument();
  });
});
