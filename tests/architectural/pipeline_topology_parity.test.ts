/**
 * Pipeline-topology parity lock (mock ↔ real compiled graph).
 *
 * `MOCK_PIPELINE_TOPOLOGY` (returned by `pipelineApi.topology()` in mock
 * mode) hand-mirrors the asoe2 compiled LangGraph so the local/Vercel
 * preview renders the same Skill→Shadow→Recipe DAG as Azure. Nothing
 * stopped the two from desyncing — a backend graph reorder would ship a
 * correct DAG on Azure and a stale one on the preview, silently.
 *
 * `src/generated/pipeline_topology.json` is the committed snapshot of the
 * real graph (written by asoe2 `scripts/generate_pipeline_topology.py`;
 * the asoe2 drift test pins it to the live graph). This test pins the
 * mock to that snapshot: nodes (id/label/kind) and edges
 * (from/to/conditional/verdict) must match exactly. Ordering and the
 * `topology_hash` sentinel are normalised out — the mock keeps its
 * display ordering, but its DAG content cannot drift from the backend.
 */
import { describe, it, expect } from "vitest";

import { pipelineApi } from "@/lib/api";
import realTopology from "@/generated/pipeline_topology.json";

type Node = { id: string; label: string; kind: string };
type Edge = {
  from_node: string;
  to_node: string;
  conditional: boolean;
  verdict_label: string | null;
};

const sortNodes = (ns: Node[]) =>
  [...ns].sort((a, b) => a.id.localeCompare(b.id));

const sortEdges = (es: Edge[]) =>
  [...es].sort(
    (a, b) =>
      a.from_node.localeCompare(b.from_node) ||
      a.to_node.localeCompare(b.to_node) ||
      (a.verdict_label ?? "").localeCompare(b.verdict_label ?? ""),
  );

describe("pipeline topology parity (mock ↔ real graph)", () => {
  it("mock nodes match the compiled graph snapshot", async () => {
    const mock = await pipelineApi.topology();
    expect(sortNodes(mock.nodes as Node[])).toEqual(
      sortNodes(realTopology.nodes as Node[]),
    );
  });

  it("mock edges match the compiled graph snapshot", async () => {
    const mock = await pipelineApi.topology();
    expect(sortEdges(mock.edges as Edge[])).toEqual(
      sortEdges(realTopology.edges as Edge[]),
    );
  });
});
