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
    const onTabChange = jest.fn();
    render(<NavBar tabs={TABS} onTabChange={onTabChange} />);
    await user.click(screen.getByText("Dashboard"));
    expect(onTabChange).toHaveBeenCalledWith("dashboard");
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
