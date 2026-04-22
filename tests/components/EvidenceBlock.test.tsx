/**
 * EvidenceBlock tests — three-state presence contract from the
 * 2026-04-22 compliance workshop (Verdict Pillar 3).
 *
 * Covers:
 *   * isPresent helper: undefined/null/empty-string/empty-array/
 *     empty-object all count as absent (mirrors backend).
 *   * Present value → children(value) is rendered.
 *   * Contextual absence → null (structural omission).
 *   * Conditional with predicate true, value absent → null.
 *   * Conditional with predicate false → "Context Not Required for
 *     Resolution" placeholder regardless of value.
 *   * Audit-bearing absence → null (fail-closed) + dev warning.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvidenceBlock, isPresent } from "@/components/ui/EvidenceBlock";

describe("isPresent", () => {
  it.each([
    [undefined, false],
    [null, false],
    ["", false],
    [[], false],
    [{}, false],
    ["x", true],
    [0, true],
    [false, true],
    [[1], true],
    [{ a: 1 }, true],
  ])("isPresent(%o) === %s", (value, expected) => {
    expect(isPresent(value)).toBe(expected);
  });
});

describe("EvidenceBlock", () => {
  it("renders children(value) when value is present", () => {
    render(
      <EvidenceBlock tier="contextual" value="CNT-42">
        {(v) => <span data-testid="contract">{String(v)}</span>}
      </EvidenceBlock>,
    );
    expect(screen.getByTestId("contract")).toHaveTextContent("CNT-42");
  });

  it("structurally omits a contextual field when value is absent", () => {
    const { container } = render(
      <EvidenceBlock tier="contextual" value={undefined}>
        {() => <span>should not render</span>}
      </EvidenceBlock>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Context Not Required placeholder when conditional predicate fails", () => {
    render(
      <EvidenceBlock
        tier="conditional"
        value={undefined}
        predicateHolds={false}
      >
        {() => <span>should not render</span>}
      </EvidenceBlock>,
    );
    // Placeholder is live text so screen readers announce it.
    expect(
      screen.getByRole("note", { name: /Context Not Required for Resolution/i }),
    ).toBeInTheDocument();
  });

  it("renders children when conditional predicate holds and value is present", () => {
    render(
      <EvidenceBlock
        tier="conditional"
        value={["DC-1"]}
        predicateHolds={true}
      >
        {(v) => <span data-testid="alt">{(v as string[]).join(",")}</span>}
      </EvidenceBlock>,
    );
    expect(screen.getByTestId("alt")).toHaveTextContent("DC-1");
  });

  it("structurally omits when conditional predicate holds but value is absent", () => {
    // Audit-bearing gap — composer would normally route to
    // AUDIT_CONTEXT_MISSING; defensive fallback here is silence.
    const { container } = render(
      <EvidenceBlock
        tier="conditional"
        value={undefined}
        predicateHolds={true}
      >
        {() => <span>should not render</span>}
      </EvidenceBlock>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("structurally omits an absent audit-bearing field (fail-closed)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <EvidenceBlock tier="audit-bearing" value={null}>
        {() => <span>should not render</span>}
      </EvidenceBlock>,
    );
    expect(container).toBeEmptyDOMElement();
    // Dev-mode warning confirms the drift is visible during development.
    if (process.env.NODE_ENV === "development") {
      expect(warn).toHaveBeenCalled();
    }
    warn.mockRestore();
  });

  it("honours a custom notRequiredLabel", () => {
    render(
      <EvidenceBlock
        tier="conditional"
        value={undefined}
        predicateHolds={false}
        notRequiredLabel="Gateway didn't fetch this for ALT_DC path"
      >
        {() => <span>should not render</span>}
      </EvidenceBlock>,
    );
    expect(
      screen.getByText(/Gateway didn't fetch this for ALT_DC path/),
    ).toBeInTheDocument();
  });
});
