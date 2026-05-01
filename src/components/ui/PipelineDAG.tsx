/**
 * PipelineDAG — audit-first directed-acyclic graph view (ADR-027 Phase D).
 *
 * Renders the compiled-graph topology with the taken path highlighted
 * and verdict labels on every conditional edge. Topology comes from
 * `useTopology()` (GET /api/v1/pipeline/topology — the compiled graph
 * is the source of truth). Per-record path comes from the trace's
 * `executed_nodes` list. Both surfaces share the attempt selector
 * with EventsTimeline so audit users can scrub through reanalysis
 * attempts in lockstep.
 *
 * Layout: dagre (layered Sugiyama). Bundle ceiling: ~12 KB gzipped
 * for dagre + this component on the lazy chunk; CI enforces.
 */
"use client";

import { useMemo } from "react";
import dagre from "dagre";
import type { PipelineTopology, PipelineTopologyEdge, ExecutedNode } from "@/types/api";
import { cn } from "@/lib/utils";

interface PipelineDAGProps {
  topology: PipelineTopology;
  executedNodes: ExecutedNode[];
  finalStatus?: string | null;
  className?: string;
}

const NODE_WIDTH = 130;
const NODE_HEIGHT = 36;

interface PositionedNode {
  id: string;
  label: string;
  kind: "node" | "terminal";
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PositionedEdge {
  from_node: string;
  to_node: string;
  conditional: boolean;
  verdict_label: string | null;
  points: { x: number; y: number }[];
}

interface LayoutResult {
  width: number;
  height: number;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

function layoutGraph(topology: PipelineTopology): LayoutResult {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "TB", nodesep: 30, ranksep: 50, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of topology.nodes) {
    g.setNode(node.id, {
      label: node.label,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }
  // Multigraph: shadow_audit→build_analysis appears twice (red + yellow).
  topology.edges.forEach((edge, i) => {
    g.setEdge(
      edge.from_node,
      edge.to_node,
      { verdict_label: edge.verdict_label, conditional: edge.conditional },
      `e${i}`,
    );
  });

  dagre.layout(g);

  const positioned: PositionedNode[] = [];
  for (const node of topology.nodes) {
    const n = g.node(node.id);
    if (!n) continue;
    positioned.push({
      id: node.id,
      label: node.label,
      kind: node.kind,
      x: n.x - n.width / 2,
      y: n.y - n.height / 2,
      width: n.width,
      height: n.height,
    });
  }

  const edges: PositionedEdge[] = [];
  topology.edges.forEach((edge, i) => {
    const e = g.edge({ v: edge.from_node, w: edge.to_node, name: `e${i}` });
    if (!e) return;
    edges.push({
      from_node: edge.from_node,
      to_node: edge.to_node,
      conditional: edge.conditional,
      verdict_label: edge.verdict_label,
      points: e.points.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
    });
  });

  return {
    width: g.graph().width ?? 600,
    height: g.graph().height ?? 400,
    nodes: positioned,
    edges,
  };
}

/**
 * Compute the set of edges that the record actually traversed. For each
 * adjacent pair (prev, curr) in executed_nodes, find the topology edge
 * matching (prev.node → curr.node). When the prev node carries an
 * exit_verdict, prefer the edge whose verdict_label matches; otherwise
 * accept any edge between the two nodes (e.g. unconditional edges).
 *
 * The implicit classify → build_analysis "cross_check_disagreement"
 * edge is matched by verdict_label too.
 */
function computeTakenEdges(
  topology: PipelineTopology,
  executedNodes: ExecutedNode[],
): Set<string> {
  const taken = new Set<string>();
  for (let i = 0; i < executedNodes.length - 1; i++) {
    const prev = executedNodes[i];
    const curr = executedNodes[i + 1];
    const candidates = topology.edges.filter(
      (e) => e.from_node === prev.node && e.to_node === curr.node,
    );
    if (candidates.length === 0) continue;
    const verdictMatch = prev.exit_verdict
      ? candidates.find((e) => e.verdict_label === prev.exit_verdict)
      : null;
    const chosen = verdictMatch ?? candidates[0];
    taken.add(edgeKey(chosen));
  }
  return taken;
}

function edgeKey(edge: { from_node: string; to_node: string; verdict_label: string | null }): string {
  return `${edge.from_node}::${edge.to_node}::${edge.verdict_label ?? ""}`;
}

function buildPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mid = {
      x: (points[i].x + points[i + 1].x) / 2,
      y: (points[i].y + points[i + 1].y) / 2,
    };
    d += ` Q ${points[i].x} ${points[i].y} ${mid.x} ${mid.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function humanizeNode(id: string): string {
  return id
    .split("_")
    .map((p) => (p.length === 0 ? "" : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

export function PipelineDAG({
  topology,
  executedNodes,
  finalStatus,
  className,
}: PipelineDAGProps) {
  const layout = useMemo(() => layoutGraph(topology), [topology]);
  const taken = useMemo(
    () => computeTakenEdges(topology, executedNodes),
    [topology, executedNodes],
  );
  const executedNodeIds = useMemo(
    () => new Set(executedNodes.map((n) => n.node)),
    [executedNodes],
  );

  return (
    <div className={cn("overflow-auto", className)}>
      <svg
        role="img"
        aria-label="Pipeline DAG view"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="font-sans"
      >
        <defs>
          <marker
            id="dag-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
          <marker
            id="dag-arrow-taken"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand)" />
          </marker>
        </defs>
        {layout.edges.map((edge, i) => {
          const isTaken = taken.has(edgeKey(edge));
          const path = buildPath(edge.points);
          const mid = edge.points[Math.floor(edge.points.length / 2)] ?? edge.points[0];
          return (
            <g key={`${edge.from_node}-${edge.to_node}-${i}`}>
              <path
                d={path}
                fill="none"
                stroke={isTaken ? "var(--color-brand)" : "var(--color-border)"}
                strokeWidth={isTaken ? 2 : 1}
                markerEnd={isTaken ? "url(#dag-arrow-taken)" : "url(#dag-arrow)"}
                opacity={isTaken ? 1 : 0.6}
              />
              {edge.verdict_label && (
                <g>
                  <rect
                    x={mid.x - 28}
                    y={mid.y - 8}
                    width={56}
                    height={16}
                    rx={8}
                    fill="var(--color-surface-primary)"
                    stroke={
                      isTaken
                        ? "var(--color-brand)"
                        : "var(--color-border)"
                    }
                    strokeWidth={1}
                  />
                  <text
                    x={mid.x}
                    y={mid.y + 3}
                    textAnchor="middle"
                    fontSize={9}
                    fontFamily="ui-monospace, monospace"
                    fill={
                      isTaken
                        ? "var(--color-brand)"
                        : "var(--color-text-tertiary)"
                    }
                  >
                    {edge.verdict_label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {layout.nodes.map((node) => {
          const isExecuted = executedNodeIds.has(node.id);
          const isTerminalKind = node.kind === "terminal";
          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={6}
                fill={
                  isExecuted
                    ? "var(--color-brand-subtle, var(--color-surface-primary))"
                    : "var(--color-surface-primary)"
                }
                stroke={
                  isExecuted
                    ? "var(--color-brand)"
                    : isTerminalKind
                    ? "var(--color-text-tertiary)"
                    : "var(--color-border)"
                }
                strokeWidth={isExecuted ? 2 : 1}
              />
              <text
                x={node.x + node.width / 2}
                y={node.y + node.height / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fill={
                  isExecuted
                    ? "var(--color-brand)"
                    : "var(--color-text-secondary)"
                }
                fontWeight={isExecuted ? 600 : 400}
              >
                {humanizeNode(node.label)}
              </text>
            </g>
          );
        })}
      </svg>
      {finalStatus && (
        <div className="mt-8 text-label text-text-tertiary">
          Final status:{" "}
          <span className="font-mono text-text-primary">{finalStatus}</span>
        </div>
      )}
    </div>
  );
}
