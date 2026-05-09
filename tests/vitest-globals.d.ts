/// <reference types="vitest/globals" />
//
// Wires vitest's runtime globals (describe / it / expect / vi /
// beforeEach / afterEach / beforeAll / afterAll) into the
// TypeScript compilation. vitest.config.ts sets `globals: true`,
// which makes those names available at run time without an
// explicit `import { ... } from "vitest"` — but tsc has no way to
// know that without a type reference. This single-line .d.ts is
// the documented vitest pattern for projects that prefer not to
// override `compilerOptions.types` (which would disable Next.js's
// automatic @types/* discovery).
//
// Module augmentation below extends `expect.Assertion` with the
// `toHaveNoViolations` matcher that tests/setup.ts wires in via
// `expect.extend(vitest-axe/matchers)`. We can't simply import
// vitest-axe/extend-expect — its bundled `.d.ts` declares the
// matcher inside `namespace Vi`, which was vitest's pre-4.x
// extension surface. vitest 4.x declares `Assertion` directly in
// the @vitest/expect module, so the augmentation has to target
// both that module and `vitest` (which re-exports `Assertion`).
declare module "@vitest/expect" {
  interface Matchers<T = unknown> {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

// Empty export forces this file to be a module rather than ambient,
// so the `declare module` block above is treated as augmentation
// rather than a wholesale module redeclaration that would shadow
// vitest's own type exports.
export {};
