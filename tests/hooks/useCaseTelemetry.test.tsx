/**
 * useCaseTelemetry tests — ADR-041 P3e Phase 3 sign-off gate #5.
 *
 * Verifies the case-open telemetry lifecycle hook:
 *
 *   * markFirstAction is idempotent — only the first call per
 *     case_id reports time-to-first-action.
 *   * trackAnalysisScroll keeps the MAX observed value across
 *     repeated calls; out-of-range readings are clamped.
 *   * On unmount (or case_id flip) the max scroll fires the
 *     report, gated on max > 0 so unscrolled cases don't pollute
 *     the metric.
 *   * Passing undefined for case_id makes markFirstAction a no-op
 *     — supports the flag-off pattern in `ExceptionDetailPanel`.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCaseTelemetry } from "@/hooks/useCaseTelemetry";

const reportTimeToFirstAction = vi.fn();
const reportAnalysisScrollDepth = vi.fn();
const reportTimeToActionSubmit = vi.fn();

vi.mock("@/lib/telemetry", () => ({
  reportTimeToFirstAction: (...args: unknown[]) =>
    reportTimeToFirstAction(...args),
  reportAnalysisScrollDepth: (...args: unknown[]) =>
    reportAnalysisScrollDepth(...args),
  reportTimeToActionSubmit: (...args: unknown[]) =>
    reportTimeToActionSubmit(...args),
}));

beforeEach(() => {
  reportTimeToFirstAction.mockReset();
  reportAnalysisScrollDepth.mockReset();
  reportTimeToActionSubmit.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCaseTelemetry — undefined case id", () => {
  it("markFirstAction is a no-op when caseId is undefined", () => {
    const { result } = renderHook(() => useCaseTelemetry(undefined));
    act(() => result.current.markFirstAction("approve"));
    expect(reportTimeToFirstAction).not.toHaveBeenCalled();
  });

  it("trackAnalysisScroll accumulates silently when caseId is undefined", () => {
    const { result, unmount } = renderHook(() =>
      useCaseTelemetry(undefined),
    );
    act(() => result.current.trackAnalysisScroll(0.5));
    unmount();
    // No report fires because the case id was never tracked.
    expect(reportAnalysisScrollDepth).not.toHaveBeenCalled();
  });
});

describe("useCaseTelemetry — markFirstAction", () => {
  it("fires once with the dwell since mount", () => {
    const { result } = renderHook(() => useCaseTelemetry("case-1"));
    act(() => result.current.markFirstAction("approve"));
    expect(reportTimeToFirstAction).toHaveBeenCalledTimes(1);
    const call = reportTimeToFirstAction.mock.calls[0][0];
    expect(call.case_id).toBe("case-1");
    expect(call.first_action).toBe("approve");
    expect(typeof call.dwell_ms).toBe("number");
    expect(call.dwell_ms).toBeGreaterThanOrEqual(0);
  });

  it("is idempotent — subsequent calls within the same case are no-ops", () => {
    const { result } = renderHook(() => useCaseTelemetry("case-1"));
    act(() => {
      result.current.markFirstAction("approve");
      result.current.markFirstAction("reject");
      result.current.markFirstAction("escalate");
    });
    expect(reportTimeToFirstAction).toHaveBeenCalledTimes(1);
    expect(reportTimeToFirstAction.mock.calls[0][0].first_action).toBe(
      "approve",
    );
  });

  it("resets when case_id flips — a new case can report again", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useCaseTelemetry(id),
      { initialProps: { id: "case-1" as string | undefined } },
    );
    act(() => result.current.markFirstAction("approve"));
    expect(reportTimeToFirstAction).toHaveBeenCalledTimes(1);

    rerender({ id: "case-2" });
    act(() => result.current.markFirstAction("override"));
    expect(reportTimeToFirstAction).toHaveBeenCalledTimes(2);
    expect(reportTimeToFirstAction.mock.calls[1][0].case_id).toBe("case-2");
    expect(reportTimeToFirstAction.mock.calls[1][0].first_action).toBe(
      "override",
    );
  });
});

describe("useCaseTelemetry — trackAnalysisScroll + unmount report", () => {
  it("clamps out-of-range readings to [0, 1]", () => {
    const { result, unmount } = renderHook(() => useCaseTelemetry("case-1"));
    act(() => {
      result.current.trackAnalysisScroll(-0.5);
      result.current.trackAnalysisScroll(1.5);
    });
    unmount();
    expect(reportAnalysisScrollDepth).toHaveBeenCalledTimes(1);
    expect(
      reportAnalysisScrollDepth.mock.calls[0][0].max_scroll_pct,
    ).toBe(1);
  });

  it("keeps the maximum observed value", () => {
    const { result, unmount } = renderHook(() => useCaseTelemetry("case-1"));
    act(() => {
      result.current.trackAnalysisScroll(0.3);
      result.current.trackAnalysisScroll(0.7);
      result.current.trackAnalysisScroll(0.5); // doesn't lower the max
    });
    unmount();
    expect(reportAnalysisScrollDepth).toHaveBeenCalledTimes(1);
    expect(
      reportAnalysisScrollDepth.mock.calls[0][0].max_scroll_pct,
    ).toBeCloseTo(0.7);
  });

  it("does not report when nothing was scrolled (max=0)", () => {
    const { unmount } = renderHook(() => useCaseTelemetry("case-1"));
    unmount();
    expect(reportAnalysisScrollDepth).not.toHaveBeenCalled();
  });

  it("flags acted=true when an action fired before unmount", () => {
    const { result, unmount } = renderHook(() => useCaseTelemetry("case-1"));
    act(() => {
      result.current.trackAnalysisScroll(0.4);
      result.current.markFirstAction("approve");
    });
    unmount();
    expect(reportAnalysisScrollDepth).toHaveBeenCalledTimes(1);
    expect(reportAnalysisScrollDepth.mock.calls[0][0].acted).toBe(true);
  });

  it("flags acted=false when the operator scrolled but did not act", () => {
    const { result, unmount } = renderHook(() => useCaseTelemetry("case-1"));
    act(() => result.current.trackAnalysisScroll(0.6));
    unmount();
    expect(reportAnalysisScrollDepth).toHaveBeenCalledTimes(1);
    expect(reportAnalysisScrollDepth.mock.calls[0][0].acted).toBe(false);
  });

  it("reports on case_id flip with the PREVIOUS case's depth", () => {
    const { result, rerender, unmount } = renderHook(
      ({ id }) => useCaseTelemetry(id),
      { initialProps: { id: "case-1" as string | undefined } },
    );
    act(() => result.current.trackAnalysisScroll(0.5));
    rerender({ id: "case-2" });
    // First report fires for case-1 on its cleanup.
    expect(reportAnalysisScrollDepth).toHaveBeenCalledTimes(1);
    expect(reportAnalysisScrollDepth.mock.calls[0][0].case_id).toBe("case-1");
    // Now case-2 lifecycle:
    act(() => result.current.trackAnalysisScroll(0.8));
    unmount();
    expect(reportAnalysisScrollDepth).toHaveBeenCalledTimes(2);
    expect(reportAnalysisScrollDepth.mock.calls[1][0].case_id).toBe("case-2");
    expect(
      reportAnalysisScrollDepth.mock.calls[1][0].max_scroll_pct,
    ).toBeCloseTo(0.8);
  });
});


/* ── S2 sprint 2026-05-28 #8 — time-to-action-submit lock ────── */

describe("useCaseTelemetry — markActionSubmit (S2 #8)", () => {
  it("fires reportTimeToActionSubmit with action + reason_tag", () => {
    const { result } = renderHook(() => useCaseTelemetry("case-S2-8"));
    act(() =>
      result.current.markActionSubmit("approve", "CUSTOMER_REQUEST"),
    );
    expect(reportTimeToActionSubmit).toHaveBeenCalledTimes(1);
    const report = reportTimeToActionSubmit.mock.calls[0][0];
    expect(report.case_id).toBe("case-S2-8");
    expect(report.action).toBe("approve");
    expect(report.reason_tag).toBe("CUSTOMER_REQUEST");
    expect(typeof report.dwell_ms).toBe("number");
    expect(report.dwell_ms).toBeGreaterThanOrEqual(0);
  });

  it("omits reason_tag for actions that have none (GREEN Approve, Reanalyze)", () => {
    const { result } = renderHook(() => useCaseTelemetry("case-no-tag"));
    act(() => result.current.markActionSubmit("reanalyze"));
    expect(reportTimeToActionSubmit).toHaveBeenCalledTimes(1);
    const report = reportTimeToActionSubmit.mock.calls[0][0];
    expect(report.reason_tag).toBeUndefined();
  });

  it("is NOT idempotent — a reanalyze + re-approve on the same case fires twice", () => {
    // Distinct from markFirstAction which is a one-shot per case.
    // The submit metric is per-action by design so a reanalyze loop
    // produces multiple measurement windows.
    const { result } = renderHook(() => useCaseTelemetry("case-loop"));
    act(() => result.current.markActionSubmit("reanalyze"));
    act(() => result.current.markActionSubmit("approve", "OTHER"));
    expect(reportTimeToActionSubmit).toHaveBeenCalledTimes(2);
    expect(reportTimeToActionSubmit.mock.calls[0][0].action).toBe("reanalyze");
    expect(reportTimeToActionSubmit.mock.calls[1][0].action).toBe("approve");
  });

  it("is a no-op when case_id is undefined (flag-off pattern)", () => {
    const { result } = renderHook(() => useCaseTelemetry(undefined));
    act(() => result.current.markActionSubmit("approve", "OTHER"));
    expect(reportTimeToActionSubmit).not.toHaveBeenCalled();
  });

  it("marks acted=true so the unmount scroll report carries it", () => {
    const { result, unmount } = renderHook(() => useCaseTelemetry("case-acted"));
    act(() => result.current.trackAnalysisScroll(0.4));
    act(() => result.current.markActionSubmit("approve", "CUSTOMER_REQUEST"));
    unmount();
    expect(reportAnalysisScrollDepth).toHaveBeenCalledTimes(1);
    expect(reportAnalysisScrollDepth.mock.calls[0][0].acted).toBe(true);
  });
});
