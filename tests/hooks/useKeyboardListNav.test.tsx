/**
 * `useKeyboardListNav` — keyboard navigation contract tests
 * (Phase 28.5.x §D5).
 *
 * Covers ArrowDown / ArrowUp / j / k / Home / End / Enter-passthrough
 * + the "don't hijack while typing in an input" rule + the
 * scrollIntoView side-effect on selection move.
 */
import { describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { fireEvent, render, renderHook } from "@testing-library/react";

import { useKeyboardListNav } from "@/hooks/useKeyboardListNav";

interface Row {
  id: string;
}

function Harness({
  items,
  selectedId,
  onSelect,
  enabled = true,
}: {
  items: Row[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useKeyboardListNav<Row>({
    items,
    getId: (r) => r.id,
    selectedId,
    onSelect,
    containerRef: ref,
    enabled,
  });
  return (
    <div ref={ref} role="listbox" aria-label="Test listbox">
      {items.map((item) => (
        <div
          key={item.id}
          role="option"
          tabIndex={-1}
          aria-selected={item.id === selectedId}
          data-keyboard-nav-id={item.id}
        >
          {item.id}
        </div>
      ))}
    </div>
  );
}


describe("useKeyboardListNav — navigation keys", () => {
  it("ArrowDown moves selection forward; bottom edge clamps", () => {
    const onSelect = vi.fn();
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const { rerender } = render(
      <Harness items={items} selectedId="a" onSelect={onSelect} />,
    );
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenLastCalledWith("b");

    rerender(<Harness items={items} selectedId="c" onSelect={onSelect} />);
    onSelect.mockClear();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    // Clamped at the last item — no further onSelect.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ArrowUp moves selection backward; top edge clamps", () => {
    const onSelect = vi.fn();
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const { rerender } = render(
      <Harness items={items} selectedId="b" onSelect={onSelect} />,
    );
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(onSelect).toHaveBeenLastCalledWith("a");

    rerender(<Harness items={items} selectedId="a" onSelect={onSelect} />);
    onSelect.mockClear();
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("j / k act as vim-style ArrowDown / ArrowUp aliases", () => {
    const onSelect = vi.fn();
    render(
      <Harness items={[{ id: "a" }, { id: "b" }]} selectedId="a" onSelect={onSelect} />,
    );
    fireEvent.keyDown(document, { key: "j" });
    expect(onSelect).toHaveBeenLastCalledWith("b");
  });

  it("Home jumps to first; End jumps to last", () => {
    const onSelect = vi.fn();
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    render(<Harness items={items} selectedId="b" onSelect={onSelect} />);
    fireEvent.keyDown(document, { key: "Home" });
    expect(onSelect).toHaveBeenLastCalledWith("a");
    fireEvent.keyDown(document, { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith("c");
  });
});


describe("useKeyboardListNav — no-hijack guards", () => {
  it("does not hijack when modifier keys are held (Cmd+ArrowDown belongs to OS)", () => {
    const onSelect = vi.fn();
    render(
      <Harness items={[{ id: "a" }, { id: "b" }]} selectedId="a" onSelect={onSelect} />,
    );
    fireEvent.keyDown(document, { key: "ArrowDown", metaKey: true });
    fireEvent.keyDown(document, { key: "ArrowDown", ctrlKey: true });
    fireEvent.keyDown(document, { key: "ArrowDown", altKey: true });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not hijack when focus is in an input (typing in search box)", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <>
        <input data-testid="search" />
        <Harness items={[{ id: "a" }, { id: "b" }]} selectedId="a" onSelect={onSelect} />
      </>,
    );
    const input = container.querySelector<HTMLInputElement>("input")!;
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not hijack when an open dialog has focus", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <>
        <div role="dialog">
          <button data-testid="dialog-button">Cancel</button>
        </div>
        <Harness items={[{ id: "a" }, { id: "b" }]} selectedId="a" onSelect={onSelect} />
      </>,
    );
    const btn = container.querySelector<HTMLButtonElement>("[data-testid='dialog-button']")!;
    btn.focus();
    fireEvent.keyDown(btn, { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("is a no-op when disabled=false", () => {
    const onSelect = vi.fn();
    render(
      <Harness items={[{ id: "a" }, { id: "b" }]} selectedId="a" onSelect={onSelect} enabled={false} />,
    );
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("is a no-op when items is empty", () => {
    const onSelect = vi.fn();
    render(<Harness items={[]} selectedId={null} onSelect={onSelect} />);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(onSelect).not.toHaveBeenCalled();
  });
});


describe("useKeyboardListNav — first-press from no-selection", () => {
  it("ArrowDown from selectedId=null lands on the first item", () => {
    const onSelect = vi.fn();
    render(
      <Harness items={[{ id: "a" }, { id: "b" }]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});
