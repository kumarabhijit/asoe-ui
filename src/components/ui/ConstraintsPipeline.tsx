/**
 * ConstraintsPipeline — graphical projection of the floor checks +
 * validations + classification outcome as a left-to-right pipeline.
 *
 * Issue #133 PO #14 — the PO's original mental model was a "constraints
 * graph" showing which gates the inbound order passed through and where
 * it broke. Pre-V5.1 the section rendered the same data as a 2-column
 * boolean grid plus a stringly-typed bullet list, which reads as a
 * checklist rather than a flow. This component renders the same data
 * as a linear graph so the operator sees the sequence at a glance:
 *
 *   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 *   │ Sender   │ → │ Customer │ → │ Duplicate│ → │ Credit   │ → │ Validate │ → CLASSIFY
 *   │ ✓ pass   │   │ ✓ pass   │   │ ✗ fail   │   │ ✓ pass   │   │ 2 issues │
 *   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
 *
 * Pure projector (CLAUDE.md Guardrail #6): every signal comes from
 * the `floor_status` booleans + `validation_failures` array the
 * backend ships in `EmailOrderEntryAnalysisData`. No data is
 * synthesised; absent fields propagate via `EvidenceBlock` upstream.
 *
 * Accessibility: the SVG carries `role="img"` plus an `aria-label`
 * summarising the outcome; the textual node list below the SVG is
 * the screen-reader-friendly equivalent (WCAG 1.4.1 — meaning is
 * never colour-only). Each node draws a status-text caption
 * ("Passed" / "Breached" / "N issues") inside the SVG, so pass/fail
 * is conveyed by the literal word, not by the fill colour alone.
 * (The ASCII sketch above uses ✓/✗ only as a legend for the
 * pass/fail states the caption words represent.)
 */
"use client";

import type {
  EmailOrderEntryAnalysisData,
  EmailOrderEntryClassification,
} from "@/types/exceptions";
import { cn } from "@/lib/utils";

/** Visual mapping function (Guardrail #1 default-fallback) — terminal
 *  classification → display tone. Unknown values fall through to
 *  neutral with the raw token as the label. */
const CLASSIFICATION_TONE: Record<
  EmailOrderEntryClassification,
  { label: string; tone: "success" | "warning" | "error" }
> = {
  ONE_CLICK_APPROVE: { label: "One-click approve", tone: "success" },
  STANDARD_REVIEW: { label: "Standard review", tone: "warning" },
  LOW_CONFIDENCE: { label: "Low confidence", tone: "warning" },
  FATAL_REJECT: { label: "Fatal reject", tone: "error" },
};

const FLOOR_NODE_LABELS: Record<
  keyof EmailOrderEntryAnalysisData["floor_status"],
  string
> = {
  sender_authorized: "Sender",
  customer_resolved: "Customer",
  duplicate_po_clear: "Duplicate",
  credit_clear: "Credit",
};

const NODE_WIDTH = 110;
const NODE_HEIGHT = 56;
const NODE_GAP = 24;
const PADDING_X = 8;
const PADDING_Y = 8;

interface PipelineNode {
  key: string;
  title: string;
  status: "pass" | "fail" | "warning" | "neutral";
  caption: string;
}

export interface ConstraintsPipelineProps {
  data: EmailOrderEntryAnalysisData;
  className?: string;
}

export function ConstraintsPipeline({
  data,
  className,
}: ConstraintsPipelineProps) {
  const nodes: PipelineNode[] = [];

  // ── Floor checks (deterministic gates) ────────────────────────────
  (Object.keys(FLOOR_NODE_LABELS) as Array<keyof typeof FLOOR_NODE_LABELS>)
    .forEach((key) => {
      const passed = data.floor_status[key];
      nodes.push({
        key,
        title: FLOOR_NODE_LABELS[key],
        status: passed ? "pass" : "fail",
        caption: passed ? "Passed" : "Breached",
      });
    });

  // ── Validations aggregate ────────────────────────────────────────
  // Single node showing how many soft validations flagged. Zero
  // failures render as a clean "pass"; one-or-more as a "warning"
  // (not a hard fail — the floor checks are the gates that block).
  const failureCount = data.validation_failures.length;
  nodes.push({
    key: "validations",
    title: "Validations",
    status: failureCount === 0 ? "pass" : "warning",
    caption: failureCount === 0
      ? "Clear"
      : `${failureCount} issue${failureCount === 1 ? "" : "s"}`,
  });

  // ── Classification terminal node ─────────────────────────────────
  const classification = CLASSIFICATION_TONE[data.classification];
  const terminal: PipelineNode = {
    key: "classification",
    title: "Classification",
    status: classification?.tone === "success"
      ? "pass"
      : classification?.tone === "error"
        ? "fail"
        : classification?.tone === "warning"
          ? "warning"
          : "neutral",
    caption: classification?.label ?? String(data.classification),
  };
  nodes.push(terminal);

  // ── Layout ───────────────────────────────────────────────────────
  const width = PADDING_X * 2
    + nodes.length * NODE_WIDTH
    + (nodes.length - 1) * NODE_GAP;
  const height = PADDING_Y * 2 + NODE_HEIGHT;

  // Compose an aria-label summary: "Pipeline passed 3 of 5 gates;
  // classification: One-click approve".
  const passCount = nodes.slice(0, -1).filter((n) => n.status === "pass").length;
  const gateCount = nodes.length - 1;
  const summary =
    `Constraint pipeline: ${passCount} of ${gateCount} gates passed; `
    + `classification ${terminal.caption}.`;

  return (
    <div className={cn(className)}>
      <svg
        role="img"
        aria-label={summary}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block max-w-full"
      >
        <defs>
          <marker
            id="constraints-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill="var(--color-text-quaternary)"
            />
          </marker>
        </defs>

        {/* Edges */}
        {nodes.slice(0, -1).map((_, i) => {
          const fromX = PADDING_X + (i + 1) * NODE_WIDTH + i * NODE_GAP;
          const toX = fromX + NODE_GAP;
          const y = PADDING_Y + NODE_HEIGHT / 2;
          return (
            <line
              key={`edge-${i}`}
              x1={fromX}
              y1={y}
              x2={toX}
              y2={y}
              stroke="var(--color-text-quaternary)"
              strokeWidth={1.5}
              markerEnd="url(#constraints-arrow)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const x = PADDING_X + i * (NODE_WIDTH + NODE_GAP);
          const y = PADDING_Y;
          const fill =
            node.status === "pass"
              ? "var(--color-success-subtle)"
              : node.status === "fail"
                ? "var(--color-error-subtle)"
                : node.status === "warning"
                  ? "var(--color-warning-subtle)"
                  : "var(--color-surface-secondary)";
          const stroke =
            node.status === "pass"
              ? "var(--color-success)"
              : node.status === "fail"
                ? "var(--color-error)"
                : node.status === "warning"
                  ? "var(--color-warning)"
                  : "var(--color-border)";
          const captionColor =
            node.status === "pass"
              ? "var(--color-success)"
              : node.status === "fail"
                ? "var(--color-error)"
                : node.status === "warning"
                  ? "var(--color-warning)"
                  : "var(--color-text-secondary)";
          return (
            <g key={node.key}>
              <rect
                x={x}
                y={y}
                rx={6}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
              />
              <text
                x={x + NODE_WIDTH / 2}
                y={y + 20}
                textAnchor="middle"
                style={{ fontSize: "var(--font-size-caption)" }}
                fontWeight={600}
                fill="var(--color-text-primary)"
              >
                {node.title}
              </text>
              <text
                x={x + NODE_WIDTH / 2}
                y={y + 40}
                textAnchor="middle"
                style={{ fontSize: "var(--font-size-label)" }}
                fontFamily="ui-monospace, monospace"
                fill={captionColor}
              >
                {node.caption}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Screen-reader / no-SVG fallback list. Mirrors the SVG so the
          meaning is recoverable without the visual; also serves as
          the printable representation in case-popout flows. */}
      <ul className="sr-only">
        {nodes.map((node) => (
          <li key={`a11y-${node.key}`}>
            {node.title}: {node.status === "pass"
              ? "passed"
              : node.status === "fail"
                ? "breached"
                : node.status === "warning"
                  ? "warning"
                  : node.status}
            {node.caption ? ` (${node.caption})` : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
