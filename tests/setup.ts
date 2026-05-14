import "@testing-library/jest-dom/vitest";
import * as matchers from "vitest-axe/matchers";
import { expect, vi } from "vitest";

expect.extend(matchers);

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
