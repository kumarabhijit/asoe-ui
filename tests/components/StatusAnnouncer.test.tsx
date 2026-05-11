/**
 * StatusAnnouncer — RTL coverage for the canonical aria-live region (Q1).
 *
 * Per docs/test-strategy/e2e-flow-plan.md (T1) this component is part
 * of the test infra: every flow YAML's `assert_announcement_text` step
 * resolves through this single selector. Regressions here silently
 * disable announcement assertions across every flow, which is exactly
 * what T1 was added to prevent.
 */
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  StatusAnnouncer,
  useStatusAnnouncer,
} from "@/components/ui/StatusAnnouncer";

function Trigger({ messages }: { messages: string[] }) {
  const { announce } = useStatusAnnouncer();
  return (
    <button
      data-testid="trigger"
      onClick={() => {
        for (const m of messages) announce(m);
      }}
    >
      go
    </button>
  );
}

async function flushMicrotasks() {
  // Two awaits give queueMicrotask time to run and React to
  // batch the resulting state update.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("StatusAnnouncer", () => {
  it("renders an aria-live polite, atomic region with stable testid", () => {
    render(<StatusAnnouncer />);
    const node = screen.getByTestId("status-announcer");
    expect(node).toHaveAttribute("aria-live", "polite");
    expect(node).toHaveAttribute("aria-atomic", "true");
    expect(node).toHaveAttribute("role", "status");
  });

  it("emits the initial message when provided", () => {
    render(<StatusAnnouncer initialMessage="Ready" />);
    expect(screen.getByTestId("status-announcer")).toHaveTextContent("Ready");
  });

  it("announces text via the context's announce()", async () => {
    render(
      <StatusAnnouncer>
        <Trigger messages={["Exception resolved"]} />
      </StatusAnnouncer>,
    );
    expect(screen.getByTestId("status-announcer")).toHaveTextContent("");

    act(() => {
      screen.getByTestId("trigger").click();
    });
    await flushMicrotasks();

    expect(screen.getByTestId("status-announcer")).toHaveTextContent(
      "Exception resolved",
    );
  });

  it("debounces rapid announcements to the most recent one", async () => {
    render(
      <StatusAnnouncer>
        <Trigger messages={["first", "second", "third — final"]} />
      </StatusAnnouncer>,
    );

    act(() => {
      screen.getByTestId("trigger").click();
    });
    await flushMicrotasks();

    // The first announce kicks off a microtask flush. Subsequent
    // calls in the same tick overwrite pendingRef. Only the final
    // value should be committed.
    expect(screen.getByTestId("status-announcer")).toHaveTextContent(
      "third — final",
    );
    expect(
      screen.getByTestId("status-announcer").textContent,
    ).not.toContain("first");
    expect(
      screen.getByTestId("status-announcer").textContent,
    ).not.toContain("second");
  });

  it("announce() is a no-op when used outside the provider (no throw)", () => {
    // Components like <ApprovalButton> may call useStatusAnnouncer
    // unconditionally; tests should not have to wrap a provider just
    // to render them.
    render(<Trigger messages={["should not throw"]} />);
    expect(() => screen.getByTestId("trigger").click()).not.toThrow();
  });
});
