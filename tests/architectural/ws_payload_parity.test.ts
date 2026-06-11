/**
 * WebSocket payload parity lock — src/types/websocket.ts must mirror
 * asoe2/api/events.py (Guardrail #3: types match backend contracts).
 *
 * Regression context (Phase 1 contract audit, 2026-06-11): the UI
 * declared `CaseOpenedPayload.source` while the backend emits `origin`,
 * and `PipelineProgressPayload` was missing the ADR-027 Phase B batched
 * `executed_nodes` field — both real wire drifts the OpenAPI drift gate
 * cannot catch (WS payloads are not part of the REST schema). This lock
 * reads both sources directly, the same cross-repo pattern as
 * openapi_drift.test.ts's vocabulary-parity check.
 *
 * Skipped when the sibling asoe2 checkout is absent (UI-only CI).
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const EVENTS_PY = join(__dirname, "..", "..", "..", "asoe2", "api", "events.py");
const WEBSOCKET_TS = join(__dirname, "..", "..", "src", "types", "websocket.ts");

const HAS_ASOE2 = existsSync(EVENTS_PY);

/** All string literals inside a Python `Literal[...]` assignment. */
function pyLiteralValues(src: string, name: string): string[] {
  const m = src.match(new RegExp(`${name} = Literal\\[([\\s\\S]*?)\\]`));
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** Top-level field names of a Pydantic model class body. */
function pyModelFields(src: string, className: string): string[] {
  const m = src.match(
    new RegExp(`class ${className}\\(BaseModel\\):([\\s\\S]*?)(?=\\nclass |\\n@|$)`),
  );
  if (!m) return [];
  const body = m[1].replace(/"""[\s\S]*?"""/g, "");
  return [...body.matchAll(/^ {4}(\w+):/gm)].map((x) => x[1]);
}

/** All string literals of a TS string-literal union type. */
function tsUnionValues(src: string, name: string): string[] {
  const m = src.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** Top-level (two-space-indented) field names of a TS interface. */
function tsInterfaceFields(src: string, name: string): string[] {
  const m = src.match(
    new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!m) return [];
  return [...m[1].matchAll(/^ {2}(\w+)\??:/gm)].map((x) => x[1]);
}

describe.skipIf(!HAS_ASOE2)("WS payload parity: websocket.ts ↔ events.py", () => {
  const py = HAS_ASOE2 ? readFileSync(EVENTS_PY, "utf-8") : "";
  const ts = readFileSync(WEBSOCKET_TS, "utf-8");

  it("event-type vocabularies are identical", () => {
    const backend = pyLiteralValues(py, "EventType").sort();
    const ui = tsUnionValues(ts, "WSEventType").sort();
    expect(backend.length).toBeGreaterThan(0);
    expect(ui).toEqual(backend);
  });

  // The payload models whose field sets must match exactly. WSErrorPayload
  // maps to the backend's ErrorPayload (renamed UI-side to avoid clashing
  // with DOM ErrorEvent).
  const PAYLOAD_PAIRS: Array<[string, string]> = [
    ["PipelineProgressPayload", "PipelineProgressPayload"],
    ["ExceptionUpdatePayload", "ExceptionUpdatePayload"],
    ["TaskCompletePayload", "TaskCompletePayload"],
    ["ErrorPayload", "WSErrorPayload"],
    ["ReanalysisStartedPayload", "ReanalysisStartedPayload"],
    ["CaseOpenedPayload", "CaseOpenedPayload"],
    ["CaseUpdatedPayload", "CaseUpdatedPayload"],
    ["CaseClosedPayload", "CaseClosedPayload"],
    ["ReplyDraftedPayload", "ReplyDraftedPayload"],
    ["ReplySentPayload", "ReplySentPayload"],
  ];

  it.each(PAYLOAD_PAIRS)("%s fields match UI %s", (pyName, tsName) => {
    const backend = pyModelFields(py, pyName).sort();
    const ui = tsInterfaceFields(ts, tsName).sort();
    expect(backend.length, `backend model ${pyName} not found`).toBeGreaterThan(0);
    expect(ui, `UI interface ${tsName} drifted from asoe2 ${pyName}`).toEqual(backend);
  });

  it("CaseOpenedPayload carries `origin` (not the pre-fix `source`)", () => {
    const fields = tsInterfaceFields(ts, "CaseOpenedPayload");
    expect(fields).toContain("origin");
    expect(fields).not.toContain("source");
  });

  it("PipelineProgressPayload declares the Phase B batched executed_nodes", () => {
    expect(tsInterfaceFields(ts, "PipelineProgressPayload")).toContain("executed_nodes");
  });
});
