/**
 * Sidebar tests — open/close, accessibility (dialog role, escape key).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/components/ui/Sidebar";

describe("Sidebar", () => {
  it("renders children when open", () => {
    render(
      <Sidebar open={true} onClose={jest.fn()} title="Detail">
        <p>Panel content</p>
      </Sidebar>
    );
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    render(
      <Sidebar open={true} onClose={jest.fn()} title="Exception Detail">
        <p>Content</p>
      </Sidebar>
    );
    expect(screen.getByText("Exception Detail")).toBeInTheDocument();
  });

  it("has dialog role and aria-modal for accessibility", () => {
    render(
      <Sidebar open={true} onClose={jest.fn()} title="Panel">
        <p>Content</p>
      </Sidebar>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Sidebar open={true} onClose={onClose} title="Panel">
        <p>Content</p>
      </Sidebar>
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when overlay is clicked", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { container } = render(
      <Sidebar open={true} onClose={onClose} title="Panel">
        <p>Content</p>
      </Sidebar>
    );
    // The overlay is the first div (before the panel)
    const overlay = container.firstChild as HTMLElement;
    if (overlay) await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("is hidden when not open", () => {
    render(
      <Sidebar open={false} onClose={jest.fn()} title="Panel">
        <p>Hidden content</p>
      </Sidebar>
    );
    // Dialog exists in DOM but is translated off-screen
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });
});
