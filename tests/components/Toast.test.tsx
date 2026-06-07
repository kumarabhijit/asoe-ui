/**
 * Toast tests — rendering, auto-dismiss, accessibility.
 */
import { render, screen, act, fireEvent } from "@testing-library/react";
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

  // REGRESSION (fails on parent): every toast was role=status + polite, so an
  // error a user must act on could sit silently behind other announcements.
  // Errors/warnings must interrupt (role=alert + assertive).
  it("announces error toasts assertively (role=alert)", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger variant="error" message="Error occurred" />
      </ToastProvider>
    );

    await user.click(screen.getByText("Show Toast"));
    const toast = screen.getByRole("alert");
    expect(toast).toHaveAttribute("aria-live", "assertive");
  });

  it("announces success toasts politely (role=status)", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastTrigger variant="success" message="Resolved" />
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

  // REGRESSION (fails on parent): WCAG 2.2.1 (Timing Adjustable) — the
  // auto-dismiss timer had no pause-on-hover, so a slow reader lost a long
  // error before reading it. Hovering must pause the timer; leaving resumes.
  it("pauses the auto-dismiss timer while hovered, resumes on leave", async () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <ToastTrigger variant="error" message="Hover to read me" />
      </ToastProvider>
    );

    await act(async () => { screen.getByText("Show Toast").click(); });
    const toast = screen.getByRole("alert");
    expect(screen.getByText("Hover to read me")).toBeInTheDocument();

    // Part-way through, the operator hovers — the timer must pause.
    await act(async () => { vi.advanceTimersByTime(2000); });
    fireEvent.mouseEnter(toast);
    // Well past the original 4.5s window — still present because paused.
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText("Hover to read me")).toBeInTheDocument();

    // Leaving resumes with the remaining ~2.5s.
    fireEvent.mouseLeave(toast);
    await act(async () => { vi.advanceTimersByTime(2600); });
    expect(screen.queryByText("Hover to read me")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
