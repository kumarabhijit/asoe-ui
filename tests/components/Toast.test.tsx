/**
 * Toast tests — rendering, auto-dismiss, accessibility.
 */
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/Toast";

function ToastTrigger({ variant, message }: { variant: "success" | "warning" | "error" | "info"; message: string }) {
  const { addToast } = useToast();
  return <button onClick={() => addToast(variant, message)}>Show Toast</button>;
}

describe("Toast", () => {
  it("renders toast message when triggered", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger variant="success" message="Exception resolved" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Exception resolved")).toBeInTheDocument();
  });

  it("has role=status and aria-live=polite for accessibility", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger variant="error" message="Error occurred" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Show Toast"));
    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("aria-live", "polite");
  });

  it("auto-dismisses after duration", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(
      <ToastProvider>
        <ToastTrigger variant="info" message="Auto dismiss test" />
      </ToastProvider>
    );

    // Click without userEvent (fake timers conflict with userEvent's internal delays)
    await act(async () => {
      screen.getByText("Show Toast").click();
    });
    expect(screen.getByText("Auto dismiss test")).toBeInTheDocument();

    // Advance past 4.5s auto-dismiss
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText("Auto dismiss test")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
