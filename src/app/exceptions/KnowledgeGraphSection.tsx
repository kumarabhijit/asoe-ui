/**
 * KnowledgeGraphSection — Customer Inbox "Knowledge Graph" tab (ADR-042 Phase 7).
 *
 * Dumb projector (Guardrail #6): renders the derived entity graph
 * (`analysis.knowledge_graph`) exactly as the builder supplies it (preview-only
 * / deferrable until that producer lands). No business logic — the backend owns
 * the node/edge derivation.
 *
 * The layout is a deterministic radial diagram (root node centred, related
 * nodes evenly placed on a ring) rendered as inline SVG, paired with an
 * accessible relationships list so the graph is not conveyed by the diagram
 * alone (WCAG 1.4.1 / keyboard + screen-reader parity).
 */
"use client";

import { Share2 } from "lucide-react";

import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphPayload,
} from "@/types/exceptions";

interface KnowledgeGraphSectionProps {
  data: KnowledgeGraphPayload;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RING = 120;
const NODE_R = 8;

// Visual mapping (allowed — default fallback, not enum dispatch): node kind →
// design-token colour for the diagram + legend.
function kindColor(kind: string): string {
  switch (kind) {
    case "order":
      return "var(--color-brand)";
    case "customer":
      return "var(--color-info)";
    case "material":
      return "var(--color-success)";
    case "sap_doc":
      return "var(--color-warning)";
    default:
      return "var(--color-text-tertiary)";
  }
}

function layout(
  nodes: KnowledgeGraphNode[],
  rootId: string | null | undefined,
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const root = nodes.find((n) => n.id === rootId) ?? nodes[0];
  if (root) pos.set(root.id, { x: CENTER, y: CENTER });
  const others = nodes.filter((n) => n.id !== root?.id);
  others.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, others.length) - Math.PI / 2;
    pos.set(n.id, {
      x: CENTER + RING * Math.cos(angle),
      y: CENTER + RING * Math.sin(angle),
    });
  });
  return pos;
}

export function KnowledgeGraphSection({ data }: KnowledgeGraphSectionProps) {
  const { nodes, edges, root_id } = data;
  const pos = layout(nodes, root_id);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <section
      aria-label="Knowledge graph"
      className="bg-surface-primary rounded-md shadow-sm p-16"
    >
      <div className="flex items-center gap-8 mb-12">
        <Share2 size={14} className="text-text-tertiary" aria-hidden />
        <span className="text-subhead font-semibold text-text-primary">
          Knowledge Graph
        </span>
        <span className="ml-auto text-caption text-text-tertiary font-mono">
          {nodes.length} nodes · {edges.length} edges
        </span>
      </div>

      <div className="flex flex-col gap-16 md:flex-row md:items-start">
        {/* Radial diagram */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[320px] shrink-0"
          role="img"
          aria-label={`Entity graph of ${nodes.length} nodes`}
        >
          {edges.map((e, i) => {
            const a = pos.get(e.source);
            const b = pos.get(e.target);
            if (!a || !b) return null;
            return (
              <line
                key={`e-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--color-border-default)"
                strokeWidth={1}
              />
            );
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const isRoot = n.id === (root_id ?? nodes[0]?.id);
            return (
              <g key={n.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isRoot ? NODE_R + 3 : NODE_R}
                  style={{ fill: kindColor(n.kind) }}
                />
                <text
                  x={p.x}
                  y={p.y - NODE_R - 4}
                  textAnchor="middle"
                  className="text-label"
                  style={{ fill: "var(--color-text-tertiary)", fontSize: 9 }}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Accessible relationships list (parity with the diagram) */}
        <div className="flex-1 min-w-0">
          <div className="text-label font-bold uppercase tracking-wider text-text-quaternary mb-8">
            Relationships
          </div>
          <ul className="m-0 p-0 list-none flex flex-col gap-4">
            {edges.map((e, i) => (
              <RelationRow key={`r-${i}`} edge={e} byId={byId} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function RelationRow({
  edge,
  byId,
}: {
  edge: KnowledgeGraphEdge;
  byId: Map<string, KnowledgeGraphNode>;
}) {
  const source = byId.get(edge.source);
  const target = byId.get(edge.target);
  return (
    <li className="flex items-center gap-6 px-10 py-6 bg-surface-secondary rounded-sm border border-border-subtle text-caption">
      <span
        className="inline-block w-6 h-6 rounded-full shrink-0"
        style={{ backgroundColor: kindColor(source?.kind ?? "") }}
        aria-hidden
      />
      <span className="font-medium text-text-primary truncate">
        {source?.label ?? edge.source}
      </span>
      <span className="text-text-quaternary italic">{edge.relation}</span>
      <span
        className="inline-block w-6 h-6 rounded-full shrink-0"
        style={{ backgroundColor: kindColor(target?.kind ?? "") }}
        aria-hidden
      />
      <span className="font-medium text-text-primary truncate">
        {target?.label ?? edge.target}
      </span>
    </li>
  );
}
