/**
 * useHotkeys — jsdom contract.
 *
 * S2 sprint 2026-05-28. The hook is the shared primitive behind the
 * ribbon hotkeys (#3) and the `?` cheatsheet (#5). These tests pin
 * the contract that the panel relied on when sizing the CSA-time
 * win: typing in a comment must never fire a binding, modifier-key
 * combinations are strict, and disabled bindings stay inert until
 * they re-enable on a permission flip.
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

import { useHotkeys } from "@/hooks/useHotkeys";

// React's automatic batching only flushes state updates when the
// event flows through React's synthetic system. A document-level
// `dispatchEvent` (the natural way to fire a global hotkey in a
// test) sidesteps that, so any setState inside the handler stays
// pending until the next microtask. Wrapping in `act` forces the
// flush so the next assertion sees the post-press DOM/state.
function press(key: string, opts: KeyboardEventInit = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, ...opts }));
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useHotkeys", () => {
  it("fires the matching handler on a bare keystroke", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: "a", handler }]));
    press("a");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("is case-insensitive on letter keys", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: "a", handler }]));
    // Shift+A produces uppercase "A"; bare binding requires no Shift
    // so it must NOT fire on Shift+A. Pressing "A" without Shift
    // (CapsLock) does fire — case is normalised.
    press("A");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("requires Shift exactly when configured", () => {
    const handler = vi.fn();
    renderHook(() =>
      useHotkeys([{ key: "?", requiresShift: true, handler }]),
    );
    press("?", { shiftKey: true });
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does NOT fire on Shift+<key> when the binding has no requiresShift", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: "a", handler }]));
    press("A", { shiftKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips when the event target is an INPUT", () => {
    const handler = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    renderHook(() => useHotkeys([{ key: "a", handler }]));
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips when the event target is a TEXTAREA", () => {
    const handler = vi.fn();
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();
    renderHook(() => useHotkeys([{ key: "a", handler }]));
    ta.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips when the event target is a SELECT", () => {
    const handler = vi.fn();
    const sel = document.createElement("select");
    document.body.appendChild(sel);
    sel.focus();
    renderHook(() => useHotkeys([{ key: "a", handler }]));
    sel.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips when the event target is contentEditable", () => {
    const handler = vi.fn();
    const div = document.createElement("div");
    // Set the attribute directly. JSDOM's `contentEditable` IDL
    // setter does not always reflect to the attribute, and the
    // `isContentEditable` property reads back inconsistently — but
    // the attribute is the source of truth in HTML and our hook's
    // fallback check picks it up.
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    div.focus();
    renderHook(() => useHotkeys([{ key: "a", handler }]));
    div.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", bubbles: true }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("a disabled binding stays inert and a later-enabled one fires", () => {
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useHotkeys([{ key: "a", handler, enabled }]),
      { initialProps: { enabled: false } },
    );
    press("a");
    expect(handler).not.toHaveBeenCalled();
    rerender({ enabled: true });
    press("a");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("Alt-prefixed keystrokes bail (reserved for browser/OS chords)", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: "a", handler }]));
    press("a", { altKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("first matching handler wins; the second never fires", () => {
    const first = vi.fn();
    const second = vi.fn();
    renderHook(() =>
      useHotkeys([
        { key: "a", handler: first },
        { key: "a", handler: second },
      ]),
    );
    press("a");
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });
});
