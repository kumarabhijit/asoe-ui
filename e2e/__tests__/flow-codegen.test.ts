// T1 — codegen golden-output test.
//
// Locks the generated Playwright spec text against accidental drift.
// If anyone edits flow-codegen.ts and forgets to update the
// expected snapshot, this test fails loudly. The expected snapshot
// is committed alongside the input YAML so a reviewer can read both
// in the diff.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { generateSpec } from "../flow-codegen";
import { flowSchema } from "../flow-schema";

const FIXTURE_DIR = join(__dirname, "fixtures");

function readFixture(rel: string): string {
  return readFileSync(join(FIXTURE_DIR, rel), "utf-8");
}

describe("flow-codegen — golden output", () => {
  it("generates the expected spec for the sample flow", async () => {
    const yamlText = readFixture("sample-flow.yaml");
    const { spec, flow } = generateSpec({
      rawFlow: YAML.parse(yamlText),
      sourcePath: "e2e/__tests__/fixtures/sample-flow.yaml",
    });
    expect(flow.name).toBe("sample-flow");
    // toMatchFileSnapshot writes the file on first run and compares
    // byte-for-byte thereafter. To intentionally update the snapshot:
    //   npx vitest run e2e/__tests__/flow-codegen.test.ts -u
    // The diff between old/new .expected.spec.ts is the human-
    // reviewable record of the codegen change.
    await expect(spec).toMatchFileSnapshot(
      join(FIXTURE_DIR, "sample-flow.expected.spec.ts"),
    );
  });

  it("is deterministic — same input produces identical bytes twice", () => {
    const yamlText = readFixture("sample-flow.yaml");
    const a = generateSpec({
      rawFlow: YAML.parse(yamlText),
      sourcePath: "e2e/__tests__/fixtures/sample-flow.yaml",
    }).spec;
    const b = generateSpec({
      rawFlow: YAML.parse(yamlText),
      sourcePath: "e2e/__tests__/fixtures/sample-flow.yaml",
    }).spec;
    expect(a).toBe(b);
  });

  it("propagates schema errors instead of emitting a partial spec", () => {
    const bad = {
      name: "broken",
      kind: "golden",
      entry: "/inbox",
      steps: [
        // click without keyboard_equivalent — D6 violation.
        { action: "click", selector: ".x" },
      ],
    };
    expect(() =>
      generateSpec({ rawFlow: bad, sourcePath: "<inline>" }),
    ).toThrow();
    // Independently verify the schema rejects the same input.
    expect(flowSchema.safeParse(bad).success).toBe(false);
  });

  it("emits the DO NOT EDIT header so editors know not to hand-edit", () => {
    const { spec } = generateSpec({
      rawFlow: YAML.parse(readFixture("sample-flow.yaml")),
      sourcePath: "<inline>",
    });
    expect(spec).toMatch(/^\/\/ AUTO-GENERATED/);
    expect(spec).toMatch(/DO NOT EDIT/);
  });

  it("emits one Playwright test() per opted-in state plus the happy path", () => {
    const { spec } = generateSpec({
      rawFlow: YAML.parse(readFixture("sample-flow.yaml")),
      sourcePath: "<inline>",
    });
    const testBlocks = spec.match(/^\s*test\(/gm) ?? [];
    // 1 happy path + 3 states (loading, empty, error) = 4 blocks
    expect(testBlocks.length).toBe(4);
    expect(spec).toContain('test("happy path"');
    expect(spec).toContain('test("state: loading"');
    expect(spec).toContain('test("state: empty"');
    expect(spec).toContain('test("state: error"');
  });

  it("loading state uses the deferred-promise + assert-during pattern (P1)", () => {
    const { spec } = generateSpec({
      rawFlow: YAML.parse(readFixture("sample-flow.yaml")),
      sourcePath: "<inline>",
    });
    expect(spec).toContain("let resolveRoute");
    expect(spec).toContain("await routeReady;");
    // The skeleton assertion must precede resolveRoute() — that is
    // what makes the pattern observe the loading state rather than
    // race the resolved nav.
    const skelIdx = spec.indexOf("inbox-skeleton");
    const resolveIdx = spec.indexOf("resolveRoute();");
    expect(skelIdx).toBeGreaterThan(0);
    expect(resolveIdx).toBeGreaterThan(skelIdx);
  });

  it("announcement assertions resolve to the canonical status-announcer testid (Q1)", () => {
    const { spec } = generateSpec({
      rawFlow: YAML.parse(readFixture("sample-flow.yaml")),
      sourcePath: "<inline>",
    });
    // The generated spec embeds the testid via JSON.stringify, so
    // the inner quotes are backslash-escaped. Match the substring
    // either way.
    expect(spec).toMatch(/data-testid=\\?"status-announcer\\?"/);
    expect(spec).toContain("Exception loaded");
  });
});
