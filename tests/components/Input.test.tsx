/**
 * Input component tests — label, error state, accessibility.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("renders with label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders without label (search mode)", () => {
    render(<Input placeholder="Search..." />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("handles user input", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Input label="Name" onChange={onChange} />);
    await user.type(screen.getByLabelText("Name"), "test");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows error message with aria-invalid", () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders right icon", () => {
    render(<Input label="Search" rightIcon={<span data-testid="search-icon">S</span>} />);
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });
});
