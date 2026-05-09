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
