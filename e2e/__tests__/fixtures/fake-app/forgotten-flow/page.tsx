/**
 * Fixture for meta-test-self-check.test.ts.
 *
 * This file deliberately exists OUTSIDE src/app/ so the production
 * scanner doesn't see it. The self-check test runs the same
 * scanner over this fixture root and asserts an orphaned page.tsx
 * is flagged. Locks the scanner against being silently neutered
 * by a future refactor.
 *
 * Do not import from this file. It is a string-recognised marker.
 */
export default function ForgottenFlowPage() {
  return null;
}
