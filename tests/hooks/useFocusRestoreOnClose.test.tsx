/**
 * useFocusRestoreOnClose — S3 sprint 2026-05-29 finding #C.
 *
 * Locks the contract that custom-dialog consumers (HotkeyCheatsheet,
 * ActionButtonMatrix comment swap) rely on: focus captures on open,
 * restores on close, and survives an unmounted trigger gracefully.
 */
import { act, render } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect } from "vitest";

import { useFocusRestoreOnClose } from "@/hooks/useFocusRestoreOnClose";

function Harness() {
  const [open, setOpen] = useState(false);
  useFocusRestoreOnClose(open);
  return (
    <div>
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <div role="dialog" aria-label="Test dialog">
          <button
            type="button"
            autoFocus
            data-testid="close"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

async function nextFrame() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe("useFocusRestoreOnClose", () => {
  it("restores focus to the previously focused element when open flips to false", async () => {
    const { getByTestId } = render(<Harness />);
    const trigger = getByTestId("trigger");
    // Open the dialog from the trigger — focus moves inside.
    act(() => {
      trigger.focus();
      trigger.click();
    });
    expect(document.activeElement).toBe(getByTestId("close"));
    // Close — restore should land on the trigger.
    act(() => {
      getByTestId("close").click();
    });
    await act(async () => {
      await nextFrame();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("does nothing when nothing had focus prior to open (body baseline)", async () => {
    const { getByTestId } = render(<Harness />);
    // Don't focus the trigger first — document.activeElement is body.
    act(() => {
      getByTestId("trigger").click();
    });
    expect(document.activeElement).toBe(getByTestId("close"));
    act(() => {
      getByTestId("close").click();
    });
    await act(async () => {
      await nextFrame();
    });
    // No prior focus was captured (body excluded), so focus stays
    // wherever the browser put it after dialog unmount — typically
    // body. The hook does not crash and does not steal focus.
    expect(document.activeElement).not.toBe(getByTestId("trigger"));
  });

  it("survives an unmounted trigger (no crash)", async () => {
    function Unmounter() {
      const [open, setOpen] = useState(false);
      const [triggerVisible, setTriggerVisible] = useState(true);
      useFocusRestoreOnClose(open);
      return (
        <div>
          {triggerVisible && (
            <button
              type="button"
              data-testid="trigger"
              onClick={() => {
                setOpen(true);
                setTriggerVisible(false);
              }}
            >
              Open and remove me
            </button>
          )}
          {open && (
            <button type="button" data-testid="close" onClick={() => setOpen(false)}>
              Close
            </button>
          )}
        </div>
      );
    }
    const { getByTestId } = render(<Unmounter />);
    act(() => {
      const trigger = getByTestId("trigger");
      trigger.focus();
      trigger.click();
    });
    act(() => {
      getByTestId("close").click();
    });
    // No throw despite the captured trigger being unmounted.
    await act(async () => {
      await nextFrame();
    });
    expect(true).toBe(true);
  });
});
