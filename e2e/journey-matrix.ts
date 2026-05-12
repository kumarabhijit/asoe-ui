// Auto-generates the journey × flow matrix block inside
// e2e/flows/JOURNEYS.md.
//
// Phase 0e of the BDD test plan. Closes JOURNEYS.md gap G2 (the
// matrix was hand-maintained; drift mitigation was a quarterly
// review). With this generator, the matrix is derived from every
// flow YAML's `journey:` + `arc:` tags.
//
// Behaviour:
//   - Walks e2e/flows recursively for *.yaml files.
//   - Parses each via the load-bearing zod schema (flow-schema.ts).
//   - Emits a sorted Markdown table.
//   - Replaces the content between <!-- BEGIN MATRIX --> and
//     <!-- END MATRIX --> markers inside JOURNEYS.md.
//
// Callers:
//   1. A vitest test asserts the file on disk matches the
//      generator's output (no manual drift permitted).
//   2. A standalone CLI entry point regenerates the file in-place.
//      Used by humans + the pre-commit hook (Phase 7).

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import {
  ENFORCED_JOURNEYS,
  flowSchema,
  journeysOf,
  type Arc,
  type Flow,
  type JourneyId,
} from "./flow-schema";

export interface FlowEntry {
  rel: string;
  flow: Flow;
}

const BEGIN_MARKER = "<!-- BEGIN MATRIX -->";
const END_MARKER = "<!-- END MATRIX -->";

// Per-archetype "Flows owned by Jn." lists live between these
// markers (one block per enforced journey). Generated alongside
// the matrix so prose archetype descriptions can't drift from
// the actual `journey:` tags in flow YAMLs.
const PER_ARCHETYPE_BEGIN = "<!-- BEGIN PER-ARCHETYPE FLOWS -->";
const PER_ARCHETYPE_END = "<!-- END PER-ARCHETYPE FLOWS -->";

export function listFlowFiles(flowsRoot: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry.startsWith("_")) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) out.push(full);
    }
  }
  walk(flowsRoot);
  return out;
}

export function loadFlows(flowsRoot: string): FlowEntry[] {
  return listFlowFiles(flowsRoot)
    .map((path) => ({
      rel: relative(dirname(flowsRoot), path).split("\\").join("/"),
      flow: flowSchema.parse(YAML.parse(readFileSync(path, "utf-8"))),
    }))
    // Stable sort by rel path so the generator is deterministic.
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

// Render the matrix block (header + rows + trailing newline) as
// it appears between the markers. Stable formatting: one row per
// flow, sorted alphabetically; journeys sorted within each row;
// trailing newline so the closing marker sits on its own line.
export function renderMatrix(flows: FlowEntry[]): string {
  const lines: string[] = [];
  lines.push("| Flow | Journey | Arc |");
  lines.push("|---|---|---|");
  // Defensive sort: callers always pass loadFlows()'s sorted
  // output, but the deterministic-output contract is asserted
  // by passing a reversed list. Sort here so the contract holds
  // regardless of input order.
  const sorted = [...flows].sort((a, b) => a.rel.localeCompare(b.rel));
  for (const entry of sorted) {
    const journeys = journeysOf(entry.flow).sort().join(", ");
    // Drop the leading "flows/" prefix so the table column
    // reads "triage/inbox-load.yaml" instead of
    // "flows/triage/inbox-load.yaml".
    const rel = entry.rel.replace(/^flows\//, "");
    lines.push(`| \`${rel}\` | ${journeys} | ${entry.flow.arc} |`);
  }
  return lines.join("\n") + "\n";
}

// Group flows by journey ID, then render one Markdown block per
// archetype. The block lists each flow's relative path + arc
// tag, sorted alphabetically; archetypes with zero flows render
// an explicit placeholder ("(no flows yet)") so reviewers see
// the gap.
export function renderPerArchetypeBlock(flows: FlowEntry[]): string {
  const sorted = [...flows].sort((a, b) => a.rel.localeCompare(b.rel));
  const byJourney = new Map<JourneyId, FlowEntry[]>();
  for (const j of ENFORCED_JOURNEYS) byJourney.set(j, []);
  for (const entry of sorted) {
    for (const j of journeysOf(entry.flow)) {
      byJourney.get(j)?.push(entry);
    }
  }
  const lines: string[] = [];
  for (const journey of ENFORCED_JOURNEYS) {
    lines.push(`#### Flows owned by ${journey}`, "");
    const items = byJourney.get(journey) ?? [];
    if (items.length === 0) {
      lines.push("- _(no flows yet)_");
    } else {
      for (const entry of items) {
        const rel = entry.rel.replace(/^flows\//, "");
        lines.push(`- \`${rel}\` — ${entry.flow.arc}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function spliceBlock(
  source: string,
  begin: string,
  end: string,
  body: string,
): string {
  const beginIdx = source.indexOf(begin);
  const endIdx = source.indexOf(end);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(`Missing markers ${begin} / ${end}`);
  }
  const before = source.slice(0, beginIdx + begin.length);
  const after = source.slice(endIdx);
  return `${before}\n${body}${after}`;
}

export function spliceMatrix(journeysMd: string, matrixBody: string): string {
  const beginIdx = journeysMd.indexOf(BEGIN_MARKER);
  const endIdx = journeysMd.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(
      `JOURNEYS.md missing matrix markers ${BEGIN_MARKER} / ${END_MARKER}`,
    );
  }
  const before = journeysMd.slice(0, beginIdx + BEGIN_MARKER.length);
  const after = journeysMd.slice(endIdx);
  return `${before}\n${matrixBody}${after}`;
}

// Pure function — given the current JOURNEYS.md text and the
// flows directory, return what JOURNEYS.md should look like.
export function regenerateJourneysMd(
  journeysMd: string,
  flowsRoot: string,
): string {
  const flows = loadFlows(flowsRoot);
  let out = spliceMatrix(journeysMd, renderMatrix(flows));
  // Per-archetype block is optional — only spliced when the
  // markers are present. Older snapshots of JOURNEYS.md won't
  // have them; the matrix-only regen still works.
  if (
    out.includes(PER_ARCHETYPE_BEGIN)
    && out.includes(PER_ARCHETYPE_END)
  ) {
    out = spliceBlock(
      out,
      PER_ARCHETYPE_BEGIN,
      PER_ARCHETYPE_END,
      renderPerArchetypeBlock(flows),
    );
  }
  return out;
}

// CLI: bun run e2e/journey-matrix.ts (or via node --import tsx).
// Rewrites e2e/flows/JOURNEYS.md in place.
function isMain(): boolean {
  try {
    return (
      typeof import.meta.url === "string" &&
      process.argv[1] !== undefined &&
      fileURLToPath(import.meta.url) === process.argv[1]
    );
  } catch {
    return false;
  }
}

if (isMain()) {
  const flowsRoot = join(__dirname, "flows");
  const journeysPath = join(flowsRoot, "JOURNEYS.md");
  const current = readFileSync(journeysPath, "utf-8");
  const next = regenerateJourneysMd(current, flowsRoot);
  if (current !== next) {
    writeFileSync(journeysPath, next);
    console.log("[journey-matrix] JOURNEYS.md updated");
  } else {
    console.log("[journey-matrix] JOURNEYS.md already current");
  }
}
