/**
 * AgentAnalysisSection tests — ADR-041 P3e Phase 3 gate #5
 * scroll-observer wiring.
 *
 * The section's display behaviour (Problem / Root Cause /
 * Recommendation blocks, collapsed-by-default + auto-expand on
 * HITL) is exercised through the broader ExceptionDetailPanel
 * tests. This file focuses on the new optional `onScrollDepth`
 * observer prop: SSR safety, observer mounts only when open + a
 * callback is supplied, and the observer's intersection-ratio
 * threshold sweep fires the callback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { AgentAnalysisSection } from "@/app/exceptions/AgentAnalysisSection";
import type { OrderAnalysis } from "@/types/exceptions";

const ANALYSIS: OrderAnalysis = {
  diagnosis: "Sample problem statement.",
  root_cause: "Sample root cause.",
  recommendation: "Sample recommendation.",
  confidence: 80,
  risk: "MEDIUM",
  resolution: "Sample resolution prose.",
  lines: [],
};

// IntersectionObserver doesn't exist in jsdom; install a spy.
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Element[] = [];
  disconnected = false;

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  // Required by the spec; we don't use these.
  root: Document | Element | null = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentAnalysisSection — onScrollDepth observer", () => {
  it("does not mount an observer when closed", () => {
    const onScrollDepth = vi.fn();
    render(
      <AgentAnalysisSection
        analysis={ANALYSIS}
        defaultOpen={false}
        onScrollDepth={onScrollDepth}
      />,
    );
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it("does not mount an observer when onScrollDepth is omitted", () => {
    render(
      <AgentAnalysisSection analysis={ANALYSIS} defaultOpen={true} />,
    );
    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it("mounts an observer when open and onScrollDepth is provided", () => {
    const onScrollDepth = vi.fn();
    render(
      <AgentAnalysisSection
        analysis={ANALYSIS}
        defaultOpen={true}
        onScrollDepth={onScrollDepth}
      />,
    );
    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].observed.length).toBe(1);
  });

  it("uses a multi-step threshold sweep (~21 steps for 5% resolution)", () => {
    render(
      <AgentAnalysisSection
        analysis={ANALYSIS}
        defaultOpen={true}
        onScrollDepth={vi.fn()}
      />,
    );
    const observer = MockIntersectionObserver.instances[0];
    const threshold = observer.options?.threshold;
    expect(Array.isArray(threshold)).toBe(true);
    if (Array.isArray(threshold)) {
      expect(threshold.length).toBeGreaterThanOrEqual(11);
      expect(threshold[0]).toBe(0);
      expect(threshold[threshold.length - 1]).toBe(1);
    }
  });

  it("propagates intersectionRatio to the onScrollDepth callback", () => {
    const onScrollDepth = vi.fn();
    render(
      <AgentAnalysisSection
        analysis={ANALYSIS}
        defaultOpen={true}
        onScrollDepth={onScrollDepth}
      />,
    );
    const observer = MockIntersectionObserver.instances[0];
    // Synthesise an entry — the section's observer treats every
    // entry as a scroll-depth update.
    const fakeEntry = { intersectionRatio: 0.5 } as IntersectionObserverEntry;
    observer.callback(
      [fakeEntry],
      observer as unknown as IntersectionObserver,
    );
    expect(onScrollDepth).toHaveBeenCalledWith(0.5);
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(
      <AgentAnalysisSection
        analysis={ANALYSIS}
        defaultOpen={true}
        onScrollDepth={vi.fn()}
      />,
    );
    const observer = MockIntersectionObserver.instances[0];
    expect(observer.disconnected).toBe(false);
    unmount();
    expect(observer.disconnected).toBe(true);
  });
});
