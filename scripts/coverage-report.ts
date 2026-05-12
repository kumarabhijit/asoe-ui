// scripts/coverage-report.ts — emit a journey × arc coverage
// summary for PR descriptions and CI logs.
//
// Items 16-17 from the BDD plan's Phase 8 (observability +
// TDD prep). Reads the flow YAMLs (via loadFlows from
// e2e/journey-matrix.ts) and renders a compact Markdown
// summary:
//
//   - Journey × arc matrix with ✅ / ❌ per cell
//   - Flow tally per arc
//   - Skipped flow list with citations (so reviewers see what
//     is paused before approving the PR)
//
// Usage:
//   npx tsx scripts/coverage-report.ts        # writes to stdout
//   npx tsx scripts/coverage-report.ts --check # exits 1 if any
//                                                enforced cell
//                                                is uncovered
//                                                AND not declared
//                                                deferred via skip
//
// CI hook (future): the workflow can pipe stdout into a sticky
// PR comment via `gh pr comment` — that surfaces coverage diffs
// per push without cluttering the PR description.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENFORCED_ARCS,
  ENFORCED_JOURNEYS,
  journeysOf,
  type Arc,
  type JourneyId,
} from "../e2e/flow-schema";
import { loadFlows } from "../e2e/journey-matrix";

const HERE = dirname(fileURLToPath(import.meta.url));
const FLOWS_ROOT = join(HERE, "..", "e2e", "flows");

function buildMatrix(): {
  cells: Map<string, string[]>;
  liveCount: number;
  skipCount: number;
  skipped: Array<{ rel: string; reason: string }>;
} {
  const flows = loadFlows(FLOWS_ROOT);
  const cells = new Map<string, string[]>();
  let liveCount = 0;
  let skipCount = 0;
  const skipped: Array<{ rel: string; reason: string }> = [];
  for (const entry of flows) {
    const isSkipped = entry.flow.skip !== undefined;
    if (isSkipped) {
      skipCount++;
      skipped.push({ rel: entry.rel, reason: entry.flow.skip!.reason });
    } else {
      liveCount++;
    }
    for (const j of journeysOf(entry.flow)) {
      const key = `${j}|${entry.flow.arc}`;
      const list = cells.get(key) ?? [];
      list.push(entry.rel + (isSkipped ? " (skipped)" : ""));
      cells.set(key, list);
    }
  }
  return { cells, liveCount, skipCount, skipped };
}

function render(): { md: string; gaps: number } {
  const { cells, liveCount, skipCount, skipped } = buildMatrix();
  const lines: string[] = [];
  lines.push("# Journey × arc coverage", "");
  lines.push(
    `**Flows:** ${liveCount} live, ${skipCount} skipped (${liveCount + skipCount} total).`,
    "",
  );

  // Matrix header.
  const arcs: readonly Arc[] = ENFORCED_ARCS;
  const journeys: readonly JourneyId[] = ENFORCED_JOURNEYS;
  lines.push(["| Archetype |", ...arcs.map((a) => ` ${a} |`)].join(""));
  lines.push(["|---|", ...arcs.map(() => "---|")].join(""));
  let gaps = 0;
  for (const j of journeys) {
    const cols = arcs.map((a) => {
      const key = `${j}|${a}`;
      const entries = cells.get(key) ?? [];
      const live = entries.filter((e) => !e.endsWith(" (skipped)"));
      if (live.length > 0) return ` ✅ (${live.length}) |`;
      if (entries.length > 0) return ` ⏸ (${entries.length} skipped) |`;
      gaps++;
      return " ❌ |";
    });
    lines.push([`| ${j} |`, ...cols].join(""));
  }
  lines.push("");

  // Legend.
  lines.push(
    "_Legend: ✅ at least one live flow covers the cell · ⏸ flow(s) exist but skipped (see citations below) · ❌ no flow yet._",
    "",
  );

  if (skipped.length > 0) {
    lines.push("## Skipped flows", "");
    for (const s of skipped) {
      const trimmed = s.reason.replace(/\s+/g, " ").trim();
      lines.push(`- \`${s.rel}\` — ${trimmed}`);
    }
    lines.push("");
  }

  return { md: lines.join("\n"), gaps };
}

function main() {
  const checkMode = process.argv.includes("--check");
  const { md, gaps } = render();
  process.stdout.write(md);
  if (checkMode) {
    if (gaps > 0) {
      console.error(
        `\n[coverage-report] ${gaps} uncovered (journey × arc) cells.`,
      );
      process.exit(1);
    }
    console.error("[coverage-report] all enforced cells covered.");
  }
}

// Exported for tests; the CLI block below runs only when invoked
// directly (npx tsx scripts/coverage-report.ts).
export { buildMatrix, render };

if (
  typeof import.meta.url === "string"
  && process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1]
) {
  main();
}
