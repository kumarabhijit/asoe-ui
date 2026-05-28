/**
 * VerdictDot tests — ADR-041 P3e §2.4.
 *
 * The primitive renders a colored dot + R/A/G letter for the queue
 * row's audit-verdict chip. WCAG 1.4.1 — color is never the sole
 * carrier; the letter pairing is the icon.
 */
import { render, screen } from "@testing-library/react";

import { VerdictDot } from "@/components/ui/VerdictDot";

describe("VerdictDot", () => {
  it("renders the letter for each color", () => {
    for (const color of ["R", "A", "G"] as const) {
      const { unmount } = render(<VerdictDot color={color} />);
      // The letter appears as plain text inside the inline-flex
      // span — getByText is the right matcher.
      expect(screen.getByText(color)).toBeInTheDocument();
      unmount();
    }
  });

  it("exposes the spoken form via aria-label (WCAG 1.4.1)", () => {
    render(<VerdictDot color="R" />);
    expect(
      screen.getByRole("img", { name: /audit verdict: red/i }),
    ).toBeInTheDocument();
  });

  it("renders an aria-hidden dot — color is decorative, letter carries meaning", () => {
    const { container } = render(<VerdictDot color="A" />);
    const dot = container.querySelector("[aria-hidden='true']");
    expect(dot).not.toBeNull();
    // The dot is a sibling of the letter glyph, not its replacement.
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("uses semantic tokens, not raw hex (Guardrail #2)", () => {
    const { container } = render(<VerdictDot color="G" />);
    const root = container.firstElementChild as HTMLElement;
    // The component sets inline style via design tokens so light /
    // dark mode flips with the rest of the surface. A hex value here
    // would mean the developer hard-coded a colour.
    expect(root.getAttribute("style") || "").toMatch(/var\(--color-/);
  });

  it("supports sm + md sizes", () => {
    const { rerender, container } = render(<VerdictDot color="G" size="sm" />);
    const sm = container.firstElementChild!.className;
    rerender(<VerdictDot color="G" size="md" />);
    const md = container.firstElementChild!.className;
    expect(sm).not.toEqual(md);
  });
});
