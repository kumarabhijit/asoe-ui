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

import { useEffect, useMemo, useRef, useState } from "react";
import dagre from "dagre";
import type { PipelineTopology, PipelineTopologyEdge, ExecutedNode } from "@/types/api";
import { cn } from "@/lib/utils";
import { humanizeNodeId, formatDurationMs } from "@/lib/format";
import { useFocusRestoreOnClose } from "@/hooks/useFocusRestoreOnClose";

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
  // Click-to-select an edge: opens an inline detail panel below the
  // SVG with the verdict, edge metadata, and (for taken edges) the
  // source node's decision payload + policy hits + sub-spans — same
  // shape the timeline reveals on row expand.
  //
  // Verdict labels stay visible on every edge so the topology reads
  // as a complete graph; visual hierarchy (taken = brand pill, un-
  // taken = quaternary-text only) does the figure-ground work that
  // hover-reveal used to do. Per the Tufte/Munzner/Norman pass on
  // 2026-05-02 — operator preference for "consistent graph + click
  // for detail" overrides the hover-only design.
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const selectedEdge = useMemo(() => {
    if (!selectedEdgeKey) return null;
    return layout.edges.find((e) => edgeKey(e) === selectedEdgeKey) ?? null;
  }, [layout.edges, selectedEdgeKey]);
  const selectedSourceNode = useMemo(() => {
    if (!selectedEdge) return null;
    if (!taken.has(edgeKey(selectedEdge))) return null;
    return executedNodes.find((n) => n.node === selectedEdge.from_node) ?? null;
  }, [selectedEdge, taken, executedNodes]);
  // Keyboard users open the panel from a focused edge `<g>`; restore focus
  // back to that edge when the panel closes so they don't drop to <body>.
  useFocusRestoreOnClose(!!selectedEdge);

  return (
    <div className={cn(className)}>
      <div className="overflow-auto">
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
          const key = edgeKey(edge);
          const isTaken = taken.has(key);
          const isSelected = selectedEdgeKey === key;
          const path = buildPath(edge.points);
          const mid = edge.points[Math.floor(edge.points.length / 2)] ?? edge.points[0];
          const interactive = !!edge.verdict_label;
          const labelAria = edge.verdict_label
            ? `${edge.from_node} to ${edge.to_node}, verdict ${edge.verdict_label}`
            : `${edge.from_node} to ${edge.to_node}`;
          // Hierarchy:
          //   taken     → brand-coloured pill, bold, fontSize 10
          //   un-taken  → no pill, quaternary text, regular weight,
          //                fontSize 9 (low contrast on purpose)
          //   selected  → either gets a 1px-thicker accent stroke so
          //                the click target is visually anchored.
          return (
            <g
              key={`${edge.from_node}-${edge.to_node}-${i}`}
              {...(interactive
                ? {
                    tabIndex: 0,
                    role: "button",
                    "aria-label": `${labelAria}. Click for details.`,
                    "aria-pressed": isSelected,
                    onClick: () =>
                      setSelectedEdgeKey((prev) =>
                        prev === key ? null : key,
                      ),
                    onKeyDown: (
                      e: React.KeyboardEvent<SVGGElement>,
                    ) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedEdgeKey((prev) =>
                          prev === key ? null : key,
                        );
                      }
                    },
                    // No `outline: none` — the global :focus-visible ring
                    // (globals.css) must remain visible on this keyboard-
                    // focusable edge (focus-ring-required a11y rule).
                    style: { cursor: "pointer" },
                  }
                : {})}
            >
              {interactive && (
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  pointerEvents="stroke"
                />
              )}
              <path
                d={path}
                fill="none"
                stroke={
                  isTaken
                    ? "var(--color-brand)"
                    : isSelected
                    ? "var(--color-text-tertiary)"
                    : "var(--color-border)"
                }
                strokeWidth={isTaken ? 2 : isSelected ? 1.5 : 1}
                // Non-colour differentiator (WCAG 1.4.1): the taken path is a
                // SOLID line, every un-taken edge is DASHED — so "which path
                // executed" survives grayscale / colour-blindness, not just the
                // brand-vs-border stroke colour.
                strokeDasharray={isTaken ? undefined : "4 3"}
                markerEnd={isTaken ? "url(#dag-arrow-taken)" : "url(#dag-arrow)"}
                opacity={isTaken ? 1 : isSelected ? 0.85 : 0.5}
                pointerEvents="none"
              />
              {edge.verdict_label && (
                <g pointerEvents="none">
                  {isTaken ? (
                    <>
                      <rect
                        x={mid.x - 30}
                        y={mid.y - 9}
                        width={60}
                        height={18}
                        rx={9}
                        fill="var(--color-surface-primary)"
                        stroke="var(--color-brand)"
                        strokeWidth={isSelected ? 2 : 1.5}
                      />
                      <text
                        x={mid.x}
                        y={mid.y + 3}
                        textAnchor="middle"
                        style={{ fontSize: "var(--font-size-label)" }}
                        fontFamily="ui-monospace, monospace"
                        fontWeight={600}
                        fill="var(--color-brand)"
                      >
                        {edge.verdict_label}
                      </text>
                    </>
                  ) : (
                    <text
                      x={mid.x}
                      y={mid.y + 3}
                      textAnchor="middle"
                      style={{ fontSize: "var(--font-size-label)" }}
                      fontFamily="ui-monospace, monospace"
                      fontWeight={isSelected ? 600 : 400}
                      fill={
                        isSelected
                          ? "var(--color-text-secondary)"
                          : "var(--color-text-quaternary)"
                      }
                    >
                      {edge.verdict_label}
                    </text>
                  )}
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
                style={{ fontSize: "var(--font-size-caption)" }}
                fill={
                  isExecuted
                    ? "var(--color-brand)"
                    : "var(--color-text-secondary)"
                }
                fontWeight={isExecuted ? 600 : 400}
              >
                {humanizeNodeId(node.label)}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
      <div className="mt-8 flex items-baseline gap-12 text-label text-text-tertiary flex-wrap">
        {finalStatus && (
          <span>
            Final status:{" "}
            <span className="font-mono text-text-primary">{finalStatus}</span>
          </span>
        )}
        <span className="text-text-quaternary">
          Click any edge to inspect its verdict and decision payload.
        </span>
      </div>
      {selectedEdge && (
        <EdgeDetailPanel
          edge={selectedEdge}
          isTaken={taken.has(edgeKey(selectedEdge))}
          sourceExecutedNode={selectedSourceNode}
          onClose={() => setSelectedEdgeKey(null)}
        />
      )}
    </div>
  );
}


/**
 * Inline detail panel for a clicked edge. Renders below the SVG so
 * the layout doesn't shift when it opens (Norman: predictable
 * targets). For taken edges the panel projects the source node's
 * ExecutedNode entry — same shape the timeline reveals on row
 * expand, so the operator's mental model is consistent across views.
 */
function EdgeDetailPanel({
  edge,
  isTaken,
  sourceExecutedNode,
  onClose,
}: {
  edge: PipelineTopologyEdge;
  isTaken: boolean;
  sourceExecutedNode: ExecutedNode | null;
  onClose: () => void;
}) {
  const verdictTone = isTaken
    ? "bg-brand-subtle text-brand"
    : "bg-surface-secondary text-text-tertiary";
  // Move focus into the panel on open so keyboard users land on the new
  // content (and the global :focus-visible ring anchors it); focus is
  // restored to the originating edge on close by useFocusRestoreOnClose.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="mt-12 rounded-md bg-surface-primary border border-border p-12 flex flex-col gap-10"
      role="region"
      aria-label="Edge details"
    >
      <div className="flex items-baseline justify-between gap-10">
        <div className="flex items-baseline gap-8 flex-wrap text-caption">
          <span className="font-semibold text-text-primary">
            {humanizeNodeId(edge.from_node)}
          </span>
          <span className="text-text-quaternary" aria-hidden="true">→</span>
          <span className="font-semibold text-text-primary">
            {humanizeNodeId(edge.to_node)}
          </span>
          {edge.verdict_label && (
            <span
              className={cn(
                "text-label font-mono px-6 py-px rounded-full",
                verdictTone,
              )}
            >
              {edge.verdict_label}
            </span>
          )}
          {!edge.conditional && (
            <span className="text-label text-text-quaternary">
              unconditional
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close edge details"
          className="bg-transparent border-none cursor-pointer text-label text-text-tertiary hover:text-text-primary px-6 py-2 rounded-sm font-sans"
        >
          Close
        </button>
      </div>

      {!isTaken && (
        <div className="text-caption text-text-tertiary">
          This edge was not traversed in this attempt. The graph shows
          it for topology completeness; no decision payload was
          recorded against it.
        </div>
      )}

      {isTaken && !sourceExecutedNode && (
        <div className="text-caption text-text-tertiary">
          This edge is on the taken path, but no executed-node entry
          was recorded for {humanizeNodeId(edge.from_node)}. (Trace may
          predate Phase B per-node instrumentation.)
        </div>
      )}

      {isTaken && sourceExecutedNode && (
        <div className="flex flex-col gap-12 text-caption">
          <div className="grid grid-cols-2 gap-8 text-label">
            <Field label="Status" value={sourceExecutedNode.status} mono />
            <Field
              label="Duration"
              value={formatDurationMs(sourceExecutedNode.duration_ms)}
              mono
            />
            <Field
              label="Entered"
              value={sourceExecutedNode.entered_at}
              mono
            />
            <Field
              label="Completed"
              value={sourceExecutedNode.completed_at ?? null}
              mono
            />
          </div>

          {Object.keys(sourceExecutedNode.decision).length > 0 && (
            <div>
              <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
                Decision (from {humanizeNodeId(sourceExecutedNode.node)})
              </div>
              <pre className="m-0 px-10 py-6 rounded-sm bg-surface-secondary text-label font-mono text-text-secondary overflow-auto">
                {JSON.stringify(sourceExecutedNode.decision, null, 2)}
              </pre>
            </div>
          )}

          {sourceExecutedNode.policy_hits.length > 0 && (
            <div>
              <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
                Policy hits
              </div>
              <ul className="list-disc pl-20 m-0 flex flex-col gap-2">
                {sourceExecutedNode.policy_hits.map((h, i) => (
                  <li
                    key={i}
                    className="text-label text-text-secondary font-mono"
                  >
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sourceExecutedNode.sub_spans.length > 0 && (
            <div>
              <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-4">
                Gateway calls
              </div>
              <div className="flex flex-col gap-4 text-label">
                {sourceExecutedNode.sub_spans.map((s, i) => (
                  <div
                    key={`${s.gateway}-${s.started_at}-${i}`}
                    className="flex items-center gap-8"
                  >
                    <span className="font-mono text-text-secondary">
                      {s.gateway}
                    </span>
                    {typeof s.duration_ms === "number" && (
                      <span className="font-mono text-text-tertiary">
                        {formatDurationMs(s.duration_ms)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "font-mono px-4 py-px rounded-full",
                        s.status === "ok"
                          ? "bg-success-subtle text-success"
                          : s.status === "timeout"
                          ? "bg-warning-subtle text-warning"
                          : "bg-error-subtle text-error",
                      )}
                    >
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <span className="text-text-quaternary text-label uppercase tracking-wider">
        {label}
      </span>
      <div
        className={cn(
          "mt-px text-text-secondary text-label break-all",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  );
}
