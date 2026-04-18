/**
 * ThemeToggle tests — tri-state, aria, hydration guard, Guardrail #2 fallback.
 *
 * next-themes is mocked so the test asserts the component's contract with
 * the hook (setTheme is called with the correct value on select) rather
 * than re-testing next-themes itself.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Mock next-themes. Each test overrides the return shape to simulate
// light / dark / system and the SSR pre-mount state.
const setThemeMock = vi.fn();
const useThemeMock = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => useThemeMock(),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    setThemeMock.mockClear();
    useThemeMock.mockReturnValue({
      theme: "system",
      setTheme: setThemeMock,
      resolvedTheme: "light",
    });
  });

  it("renders trigger with Sun icon in light resolved theme", () => {
    render(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: /change theme/i });
    expect(trigger).toBeInTheDocument();
    // Sun icon is from Lucide — rendered as inline <svg>.
    expect(trigger.querySelector("svg")).toBeInTheDocument();
  });

  it("exposes the current theme in the aria-label after mount", async () => {
    useThemeMock.mockReturnValue({
      theme: "dark",
      setTheme: setThemeMock,
      resolvedTheme: "dark",
    });
    render(<ThemeToggle />);
    const trigger = await screen.findByRole("button", {
      name: /change theme \(current: dark\)/i,
    });
    expect(trigger).toBeInTheDocument();
  });

  it("opens the menu and shows all three options", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /change theme/i }));
    // Items render via Radix Portal — use findByRole scoped by role.
    expect(await screen.findByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("calls setTheme('light') when Light is selected", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /change theme/i }));
    await user.click(await screen.findByText("Light"));
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("calls setTheme('dark') when Dark is selected", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /change theme/i }));
    await user.click(await screen.findByText("Dark"));
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme('system') when System is selected", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /change theme/i }));
    await user.click(await screen.findByText("System"));
    expect(setThemeMock).toHaveBeenCalledWith("system");
  });

  it("marks the active option with aria-checked=true", async () => {
    useThemeMock.mockReturnValue({
      theme: "dark",
      setTheme: setThemeMock,
      resolvedTheme: "dark",
    });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /change theme/i }));
    const darkOption = await screen.findByRole("menuitemradio", { name: /dark/i });
    expect(darkOption).toHaveAttribute("aria-checked", "true");

    const lightOption = screen.getByRole("menuitemradio", { name: /light/i });
    expect(lightOption).toHaveAttribute("aria-checked", "false");
  });

  it("falls back to 'system' when theme is undefined (Guardrail #2 default)", async () => {
    useThemeMock.mockReturnValue({
      theme: undefined,
      setTheme: setThemeMock,
      resolvedTheme: "light",
    });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /change theme/i }));
    const systemOption = await screen.findByRole("menuitemradio", { name: /system/i });
    expect(systemOption).toHaveAttribute("aria-checked", "true");
  });

  it("accepts align prop for menu placement", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle align="start" />);
    await user.click(screen.getByRole("button", { name: /change theme/i }));
    // Alignment is a Radix prop — the menu renders regardless of value.
    expect(await screen.findByText("Light")).toBeInTheDocument();
  });
});
