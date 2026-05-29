import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { beforeEach, expect, vi } from "vitest";

import { __resetMockIdempotencyCache } from "@/lib/api";
import { resetMockExceptions } from "@/lib/mock-data/exceptions";

expect.extend(matchers);

// Mock action paths in src/lib/api.ts (disposition / escalate /
// cosign) now mutate the underlying MOCK_EXCEPTIONS row so the
// Vercel mock preview reflects the action in the queue / case
// header / dashboard tiles (matching the live asoe2 backend). The
// trade-off is cross-test fixture leak: a disposition() on exc-002
// in one test would change its lifecycle and break a later
// escalate() test on the same id. Reset the seed between tests so
// the leak window is the test body only.
beforeEach(() => {
  resetMockExceptions();
  __resetMockIdempotencyCache();
});

// jsdom does not implement window.matchMedia. next-themes and a
// handful of other libraries (and our own reduced-motion checks)
// call it on mount. Stub a no-op MediaQueryList rather than
// patching each test individually. The stub returns matches=false
// for every query — i.e. behaves like "no media match" which is
// the conservative default for SSR-equivalent jsdom.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom does not implement Element.prototype.scrollIntoView. The
// keyboard-navigation hook (useKeyboardListNav) calls it inside a
// requestAnimationFrame after a selection move; a test that flushes
// that frame would otherwise hit jsdom's "Not implemented" throw.
// Stub a no-op so the side-effect is exercised without crashing.
if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op in jsdom */
  };
}

// jsdom does not implement ResizeObserver. cmdk's Command primitive
// (S2 sprint follow-up #6 — Combobox in OverrideChooserDialog) uses
// a ResizeObserver internally to measure its list height. Stub it
// with a no-op implementation matching the DOM contract so
// component tests can mount Combobox cleanly. Real browsers (the
// playwright e2e suites) implement the API natively.
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class NoopResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: NoopResizeObserver,
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: NoopResizeObserver,
  });
}

// next-auth's client logger POSTs to `/api/auth/_log` on every
// session event. The URL is relative, so undici's URL parser
// throws `ERR_INVALID_URL` — surfaced by vitest as "Unhandled
// Errors" (~6 per full run). The noise is harmless locally but
// inflates the unhandled-errors counter that some CI runners
// treat as a job-level failure. Stub `fetch` for that one URL so
// the logger no-ops cleanly; everything else falls through.
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string"
    ? input
    : (input instanceof URL ? input.href : (input as Request).url);
  if (url === "/api/auth/_log" || url.endsWith("/api/auth/_log")) {
    return Promise.resolve(new Response(null, { status: 204 }));
  }
  return originalFetch(input as RequestInfo, init);
}) as typeof fetch;
