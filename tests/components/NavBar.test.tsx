/**
 * NavBar tests — tabs, agent status, user avatar.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NavBar } from "@/components/ui/NavBar";

const TABS = [
  { id: "queue", label: "Exception Queue", href: "/exceptions" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
];

describe("NavBar", () => {
  it("renders all tab labels", () => {
    render(<NavBar tabs={TABS} />);
    expect(screen.getByText("Exception Queue")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("calls onTabChange when tab clicked", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(<NavBar tabs={TABS} onTabChange={onTabChange} />);
    await user.click(screen.getByText("Dashboard"));
    expect(onTabChange).toHaveBeenCalledWith("dashboard");
  });

  // Regression: primary nav destinations must be real anchors, not
  // <button>s. Buttons can't be Cmd/Ctrl/middle-clicked into a new
  // tab, don't show the URL on hover, and AT announces "button"
  // instead of "link". They also navigated only via an onTabChange →
  // router.push handler, so a missing handler silently dead-ended the
  // tab. See NavBar.tsx tab rendering.
  it("renders each tab as a link pointing at its href", () => {
    render(<NavBar tabs={TABS} />);
    const queue = screen.getByRole("link", { name: "Exception Queue" });
    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(queue).toHaveAttribute("href", "/exceptions");
    expect(dashboard).toHaveAttribute("href", "/dashboard");
  });

  it("navigates even when no onTabChange handler is supplied", () => {
    // The href carries navigation; onTabChange is now an optional
    // side-effect hook. A tab with no handler must still be a working
    // link (pre-fix it was an inert button).
    render(<NavBar tabs={TABS} />);
    expect(
      screen.getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("marks the active tab with aria-current=page", () => {
    render(<NavBar tabs={TABS} activeTab="dashboard" />);
    expect(
      screen.getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Exception Queue" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders agent status when agentCount > 0", () => {
    render(<NavBar tabs={TABS} agentCount={3} />);
    expect(screen.getByText(/3 Agents Live/)).toBeInTheDocument();
  });

  it("does not render agent status when agentCount is 0", () => {
    render(<NavBar tabs={TABS} agentCount={0} />);
    expect(screen.queryByText(/Agent/)).not.toBeInTheDocument();
  });

  it("renders user initials", () => {
    render(<NavBar tabs={TABS} userInitials="JD" userName="Jane Doe" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });
});
