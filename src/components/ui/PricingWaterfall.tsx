/**
 * PricingWaterfall — vertical timeline of pricing condition steps.
 * Adapted from samples/asoe-sample-screen.jsx.
 *
 * Distinct from WaterfallStepper: WaterfallStepper visualizes the 10-node
 * pipeline execution (WebSocket-driven). PricingWaterfall visualizes
 * the pricing condition chain for a line item (API data-driven).
 */
"use client";

import {
  CircleDot,
  FileText,
  Clock,
  Package,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { PricingWaterfallStep, PricingConditionType } from "@/types/exceptions";

interface PricingWaterfallProps {
  steps: PricingWaterfallStep[];
  style?: CSSProperties;
}

const TYPE_ICONS: Record<PricingConditionType, ReactNode> = {
  BASE: <CircleDot size={14} />,
  CONTRACT: <FileText size={14} />,
  TPR: <Clock size={14} />,
  UOM: <Package size={14} />,
  RESULT: <Check size={14} />,
  ERROR: <X size={14} />,
};

const TYPE_COLORS: Record<PricingConditionType, string> = {
  BASE: "var(--color-text-secondary)",
  CONTRACT: "var(--color-cat-purple)",
  TPR: "var(--color-cat-amber)",
  UOM: "var(--color-cat-teal)",
  RESULT: "var(--color-success)",
  ERROR: "var(--color-error)",
};

function typeColor(type: string): string {
  return TYPE_COLORS[type as PricingConditionType] ?? "var(--color-text-secondary)";
}

function typeIcon(type: string): ReactNode {
  return TYPE_ICONS[type as PricingConditionType] ?? <CircleDot size={14} />;
}

function fmtPrice(n: number): string {
  const sign = n > 0 ? "" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function PricingWaterfall({ steps, style }: PricingWaterfallProps) {
  if (!steps || steps.length === 0) {
    return (
      <div
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: "var(--font-size-caption)",
          fontStyle: "italic",
          padding: "var(--space-12) 0",
        }}
      >
        Waterfall data available after audit.
      </div>
    );
  }

  return (
    <div style={style}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        const isError = step.type === "ERROR";
        const isResult = step.type === "RESULT";
        const clr = typeColor(step.type);

        const cardBg = isError
          ? "var(--color-error-subtle)"
          : isResult
            ? "var(--color-success-subtle)"
            : "var(--color-surface-secondary)";

        const cardBorder = isError
          ? "1px solid var(--color-error-border)"
          : isResult
            ? "1px solid var(--color-success-border)"
            : "1px solid var(--color-border-default)";

        return (
          <div
            key={idx}
            style={{
              display: "flex",
              gap: 0,
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* Timeline node + connector */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginRight: "var(--space-12)",
                flexShrink: 0,
                width: 32,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: isError
                    ? "var(--color-error-subtle)"
                    : isResult
                      ? "var(--color-success-subtle)"
                      : "var(--color-surface-primary)",
                  border: `2px solid ${clr}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: clr,
                  position: "relative",
                  zIndex: 2,
                }}
              >
                {typeIcon(step.type)}
              </div>
              {!isLast && (
                <div
                  style={{
                    width: 1,
                    flex: 1,
                    minHeight: 8,
                    background: "var(--color-border-default)",
                  }}
                />
              )}
            </div>

            {/* Step card */}
            <div
              style={{
                flex: 1,
                marginBottom: isLast ? 0 : "var(--space-8)",
                background: cardBg,
                border: cardBorder,
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-10) var(--space-12)",
              }}
            >
              {/* Header row: label + record + value + running total */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-8)",
                  marginBottom: "var(--space-4)",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "var(--font-size-caption)",
                    color: isError
                      ? "var(--color-error)"
                      : isResult
                        ? "var(--color-success)"
                        : "var(--color-text-primary)",
                  }}
                >
                  {step.label}
                </span>
                <code
                  style={{
                    fontSize: "var(--font-size-label)",
                    color: "var(--color-text-tertiary)",
                    background:
                      isError || isResult
                        ? "rgba(255,255,255,0.6)"
                        : "var(--color-surface-primary)",
                    padding: "1px 6px",
                    borderRadius: 3,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {step.record}
                </code>
                <div style={{ flex: 1 }} />
                {step.value != null && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-body)",
                      fontWeight: 700,
                      color: isError
                        ? "var(--color-error)"
                        : step.value < 0
                          ? "var(--color-cat-amber)"
                          : isResult
                            ? "var(--color-success)"
                            : "var(--color-text-primary)",
                    }}
                  >
                    {step.value > 0 &&
                    step.type !== "BASE" &&
                    step.type !== "RESULT"
                      ? "+"
                      : ""}
                    {fmtPrice(step.value)}
                  </span>
                )}
                {step.running != null && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--font-size-caption)",
                      color: "var(--color-text-tertiary)",
                    }}
                  >
                    ={" "}
                    <strong
                      style={{
                        color: isResult
                          ? "var(--color-success)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {fmtPrice(step.running)}
                    </strong>
                  </span>
                )}
              </div>

              {/* Detail text */}
              <div
                style={{
                  fontSize: "var(--font-size-caption)",
                  color: "var(--color-text-tertiary)",
                  lineHeight: 1.55,
                }}
              >
                {step.detail}
              </div>

              {/* Error callout */}
              {isError && step.error && (
                <div
                  role="alert"
                  style={{
                    marginTop: "var(--space-8)",
                    background: "var(--color-error-subtle)",
                    border: "1px solid var(--color-error-border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-8) var(--space-10)",
                    fontSize: "var(--font-size-caption)",
                    color: "var(--color-error)",
                    display: "flex",
                    gap: "var(--space-6)",
                    lineHeight: 1.5,
                  }}
                >
                  <AlertTriangle
                    size={13}
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  <span>{step.error}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
