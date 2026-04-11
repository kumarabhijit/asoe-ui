/**
 * Badge component tests — variant mapping, WCAG compliance, Guardrail #2 fallback.
 */
import { render, screen } from "@testing-library/react";
import { Badge, verdictVariant, lifecycleVariant } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Test Label</Badge>);
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("renders with each variant", () => {
    const variants = ["success", "warning", "error", "info", "neutral", "brand"] as const;
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders default icon per variant (WCAG 1.4.1 — never color alone)", () => {
    // Each variant renders an icon by default — status is never conveyed by color alone
    const { container } = render(<Badge variant="success">Resolved</Badge>);
    // Icon (SVG) + text both present
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("allows custom icon override", () => {
    render(<Badge icon={<span data-testid="custom-icon">!</span>}>Custom</Badge>);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("allows icon to be suppressed with null", () => {
    const { container } = render(<Badge icon={null}>No Icon</Badge>);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });
});

describe("verdictVariant — Guardrail #2 fallback", () => {
  it("maps GREEN to success", () => {
    expect(verdictVariant("GREEN")).toBe("success");
  });

  it("maps YELLOW to warning", () => {
    expect(verdictVariant("YELLOW")).toBe("warning");
  });

  it("maps RED to error", () => {
    expect(verdictVariant("RED")).toBe("error");
  });

  it("returns neutral for undefined", () => {
    expect(verdictVariant(undefined)).toBe("neutral");
  });

  it("returns neutral for unknown verdict (Guardrail #2 — new values require zero code changes)", () => {
    expect(verdictVariant("PURPLE")).toBe("neutral");
    expect(verdictVariant("ORANGE")).toBe("neutral");
  });
});

describe("lifecycleVariant — Guardrail #2 fallback", () => {
  it("maps RESOLVED and CLOSED to success", () => {
    expect(lifecycleVariant("RESOLVED")).toBe("success");
    expect(lifecycleVariant("CLOSED")).toBe("success");
  });

  it("maps PENDING_REVIEW, ESCALATED, AUDITING to warning", () => {
    expect(lifecycleVariant("PENDING_REVIEW")).toBe("warning");
    expect(lifecycleVariant("ESCALATED")).toBe("warning");
    expect(lifecycleVariant("AUDITING")).toBe("warning");
  });

  it("maps BLOCKED, REJECTED, FAILED to error", () => {
    expect(lifecycleVariant("BLOCKED")).toBe("error");
    expect(lifecycleVariant("REJECTED")).toBe("error");
    expect(lifecycleVariant("FAILED")).toBe("error");
  });

  it("maps EXECUTING, CLASSIFYING to info", () => {
    expect(lifecycleVariant("EXECUTING")).toBe("info");
    expect(lifecycleVariant("CLASSIFYING")).toBe("info");
  });

  it("returns neutral for unknown state (Guardrail #2)", () => {
    expect(lifecycleVariant("NEW_STATE")).toBe("neutral");
    expect(lifecycleVariant(undefined)).toBe("neutral");
  });
});
