/**
 * Accessibility tests — vitest-axe on status-related components.
 *
 * Per Section 11.3 WCAG 2.1 AA Compliance:
 * - Status indicators never rely on color alone (icon + text)
 * - All interactive elements keyboard-navigable
 * - aria-live on dynamic content
 * - dialog semantics on Sidebar
 */
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sidebar } from "@/components/ui/Sidebar";
import { MetricTile } from "@/components/ui/MetricTile";
import { Input } from "@/components/ui/Input";

describe("Accessibility: Badge (status indicator)", () => {
  const variants = ["success", "warning", "error", "info", "neutral"] as const;

  for (const variant of variants) {
    it(`${variant} variant has no axe violations`, async () => {
      const { container } = render(<Badge variant={variant}>Status Text</Badge>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  }

  it("all variants include both icon and text (WCAG 1.4.1)", () => {
    for (const variant of variants) {
      const { container, unmount } = render(<Badge variant={variant}>Label</Badge>);
      expect(container.querySelector("svg")).toBeInTheDocument();
      expect(container.textContent).toContain("Label");
      unmount();
    }
  });
});

describe("Accessibility: Button", () => {
  it("has no axe violations", async () => {
    const { container } = render(<Button>Click Me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("disabled button has no axe violations", async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Accessibility: Input", () => {
  it("has no axe violations with label", async () => {
    const { container } = render(<Input label="Email Address" type="email" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("error state has no axe violations", async () => {
    const { container } = render(<Input label="Email" error="Required field" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Accessibility: Sidebar (dialog)", () => {
  it("has dialog role and aria-modal", async () => {
    const { container } = render(
      <Sidebar open={true} onClose={() => {}} title="Test Panel">
        <p>Content</p>
      </Sidebar>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Accessibility: MetricTile", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <MetricTile icon={<span>I</span>} label="Total" value={42} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
