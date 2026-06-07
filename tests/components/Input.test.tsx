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
    const onChange = vi.fn();
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

  // REGRESSION (report 08): ids were derived from the label slug, so two
  // inputs sharing a label collided — breaking htmlFor + aria-describedby.
  it("gives two inputs with the same label distinct ids + error associations", () => {
    render(
      <>
        <Input label="Amount" error="First error" />
        <Input label="Amount" error="Second error" />
      </>,
    );
    const inputs = screen.getAllByLabelText("Amount");
    expect(inputs).toHaveLength(2);
    expect(inputs[0].id).not.toBe(inputs[1].id);
    expect(inputs[0].getAttribute("aria-describedby")).toBe(
      `${inputs[0].id}-error`,
    );
  });

  // REGRESSION (report 08): with neither id nor label, the error rendered but
  // aria-describedby pointed nowhere. useId() guarantees an association.
  it("associates the error message even without an id or label", () => {
    render(<Input error="Required" />);
    const input = screen.getByRole("textbox");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Required");
  });
});
