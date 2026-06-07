/**
 * Button component tests — variants, sizes, loading, disabled.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByRole("button", { name: "Click Me" })).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when loading", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loader icon when loading", () => {
    const { container } = render(<Button loading>Submit</Button>);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  // REGRESSION (fails on parent): loading used to REPLACE the children with the
  // spinner, so the control lost its accessible name (WCAG 4.1.2). The label
  // must be retained and the busy state exposed via aria-busy instead.
  it("retains its label and sets aria-busy while loading", () => {
    render(<Button loading>Submit</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("Submit");
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("does not set aria-busy when not loading", () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders all 5 variants without error", () => {
    const variants = ["brand", "neutral", "success", "ghost", "destructive"] as const;
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
      unmount();
    }
  });

  it("renders all 3 sizes without error", () => {
    const sizes = ["sm", "md", "lg"] as const;
    for (const size of sizes) {
      const { unmount } = render(<Button size={size}>{size}</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
      unmount();
    }
  });
});
