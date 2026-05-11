#!/usr/bin/env bash
# scripts/pre-commit.sh — dev-side flow hygiene hook.
#
# When a flow YAML changes, regenerate the matrix and the
# Playwright specs and re-stage the result. CI catches stale
# committers via the drift tests (e2e/__tests__/flows-gen.test.ts
# + journey-matrix.test.ts); this hook saves the round-trip.
#
# Install:
#   ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
#
# Behaviour:
#   - If no files under e2e/flows/ are staged, exit 0 immediately
#     (the hook costs ~0ms for non-flow commits).
#   - Otherwise: regen matrix + specs, then `git add` the touched
#     paths. The commit proceeds with the regen results included.
#   - Exits non-zero only if the regen itself fails (schema
#     violation, codegen error) — the user fixes the YAML and
#     re-commits.
#
# Why not Husky?
#   Husky adds a dependency, a postinstall hook, and a husky/
#   directory the team has to remember. A 30-line shell script
#   installed via a one-liner is the same protection with no
#   runtime baggage.

set -euo pipefail

# Detect whether any staged file lives under e2e/flows/.
if ! git diff --cached --name-only | grep -qE '^e2e/flows/'; then
  exit 0
fi

echo "[pre-commit] flow YAML changed — regenerating matrix + specs..."

# Run the regen tools. Both are idempotent.
npm run --silent flows:matrix
npm run --silent flows:gen

# Re-stage the regenerated artefacts. If nothing changed (the
# matrix + tree were already in sync) git add is a no-op.
git add e2e/flows/JOURNEYS.md
git add e2e/flows-generated/

echo "[pre-commit] regen complete; re-staged matrix + specs"
