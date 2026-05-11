/**
 * Spec-as-oracle: every hand-written enum union in `src/types/exceptions.ts`
 * matches the corresponding `Literal` in `../asoe2/constraints/specs.py`.
 *
 * Complements `tests/architectural/openapi_drift.test.ts`:
 *   - That file checks `MOCK_HEALTH.allowed_intents` / `allowed_recipes`.
 *   - This file checks `ResolutionAction` and the
 *     `MOCK_HEALTH.allowed_resolution_actions` / `allowed_override_reason_tags`
 *     coverage that the OpenAPI gate cannot catch (the schema serialises
 *     these as plain `string[]`).
 *
 * Reference: docs/test-strategy/design.md Lane 2 Week 5 (hand-written
 * union retirement); docs/test-strategy/eng-review-test-plan.md (Edge
 * Cases — `MOCK_HEALTH.allowed_intents` enum-parity test).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MOCK_HEALTH } from "../fixtures";
import type { ResolutionAction } from "@/types/exceptions";

const ASOE2_SPECS_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "asoe2",
  "constraints",
  "specs.py",
);

function extractLiteralValues(source: string, name: string): string[] {
  const startRe = new RegExp(
    String.raw`${name}\s*=\s*Literal\s*\[`,
    "m",
  );
  const start = source.match(startRe);
  if (!start || start.index === undefined) return [];
  const after = source.slice(start.index + start[0].length);
  const closeIdx = after.indexOf("]");
  if (closeIdx === -1) return [];
  const body = after.slice(0, closeIdx);
  return [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/** UI hand-written `ResolutionAction` union — kept in lockstep with src/types/exceptions.ts. */
const UI_RESOLUTION_ACTIONS: readonly ResolutionAction[] = [
  "BLOCK_AND_NOTIFY",
  "MERGE",
  "SUPERSEDE",
  "ALLOW_BOTH",
  "ESCALATE",
  "REQUEST_BUYER_CONFIRMATION",
  "ONE_CLICK_APPROVE",
  "STANDARD_REVIEW",
  "LOW_CONFIDENCE_FLAG",
  "AUTO_CORRECT",
  "REQUEST_CLARIFICATION",
  "REJECT",
] as const;

describe("Enum parity (asoe-ui ↔ asoe2 constraints/specs.py)", () => {
  it("UI ResolutionAction matches AllowedResolutionAction in asoe2", () => {
    if (!existsSync(ASOE2_SPECS_PATH)) {
      console.warn(`skipping — asoe2 not found at ${ASOE2_SPECS_PATH}`);
      return;
    }
    const src = readFileSync(ASOE2_SPECS_PATH, "utf-8");
    const backend = new Set(extractLiteralValues(src, "AllowedResolutionAction"));
    const ui = new Set<string>(UI_RESOLUTION_ACTIONS);
    const onlyBackend = [...backend].filter((v) => !ui.has(v));
    const onlyUi = [...ui].filter((v) => !backend.has(v));
    expect(
      onlyBackend,
      `ResolutionAction values in asoe2 but missing from UI: ${JSON.stringify(onlyBackend)}`,
    ).toEqual([]);
    expect(
      onlyUi,
      `ResolutionAction values in UI but missing from asoe2: ${JSON.stringify(onlyUi)}`,
    ).toEqual([]);
  });

  it("MOCK_HEALTH.allowed_resolution_actions matches AllowedResolutionAction", () => {
    if (!existsSync(ASOE2_SPECS_PATH)) {
      console.warn(`skipping — asoe2 not found at ${ASOE2_SPECS_PATH}`);
      return;
    }
    const src = readFileSync(ASOE2_SPECS_PATH, "utf-8");
    const backend = new Set(
      extractLiteralValues(src, "AllowedResolutionAction"),
    );
    const mock = new Set(MOCK_HEALTH.allowed_resolution_actions);
    const missing = [...backend].filter((v) => !mock.has(v));
    expect(
      missing,
      `MOCK_HEALTH.allowed_resolution_actions missing: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });

  it("MOCK_HEALTH.allowed_override_reason_tags matches global tuple in asoe2", () => {
    if (!existsSync(ASOE2_SPECS_PATH)) {
      console.warn(`skipping — asoe2 not found at ${ASOE2_SPECS_PATH}`);
      return;
    }
    const src = readFileSync(ASOE2_SPECS_PATH, "utf-8");
    // _GLOBAL_REASON_TAGS is a tuple, not a Literal; reuse the same
    // quoted-string scan against the tuple body.
    const tupleMatch = src.match(
      /_GLOBAL_REASON_TAGS\s*:\s*tuple\[str,\s*\.\.\.\]\s*=\s*\(([\s\S]*?)\)/,
    );
    if (!tupleMatch) throw new Error("_GLOBAL_REASON_TAGS parse failed");
    const backend = new Set(
      [...tupleMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    );
    const mock = new Set(MOCK_HEALTH.allowed_override_reason_tags);
    const missing = [...backend].filter((v) => !mock.has(v));
    expect(
      missing,
      `MOCK_HEALTH.allowed_override_reason_tags missing: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });

  it("MOCK_HEALTH.allowed_override_reason_tags_by_intent has every intent", () => {
    if (!existsSync(ASOE2_SPECS_PATH)) {
      console.warn(`skipping — asoe2 not found at ${ASOE2_SPECS_PATH}`);
      return;
    }
    const src = readFileSync(ASOE2_SPECS_PATH, "utf-8");
    const intents = new Set(extractLiteralValues(src, "AllowedIntent"));
    const mockKeys = new Set(
      Object.keys(MOCK_HEALTH.allowed_override_reason_tags_by_intent),
    );
    const missing = [...intents].filter((i) => !mockKeys.has(i));
    expect(
      missing,
      `MOCK_HEALTH.allowed_override_reason_tags_by_intent missing intents: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });
});
