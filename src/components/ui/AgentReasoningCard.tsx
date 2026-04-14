/**
 * AgentReasoningCard — Layer 1 cognition pattern.
 * Section 11.1:
 *   Layer 1 (always visible): recommendation + confidence bar, key data, action button.
 *   Layer 2 (trace evidence): moved to the Trace Evidence collapsible section
 *   in ExceptionDetailPanel to avoid duplication.
 *
 * Verdict-specific behavior:
 *   GREEN  → standard review actions
 *   YELLOW → reviewer needs context, Approve/Reject/Escalate
 *   RED    → blocked by policy, primary CTA removed
 */
"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Zap, Check, AlertTriangle, ShieldX, MessageSquare } from "lucide-react";
import { Badge, verdictVariant } from "./Badge";
import { Button } from "./Button";
import type { ShadowVerdict } from "@/types/exceptions";

interface AgentReasoningCardProps {
  verdict: ShadowVerdict;
  intent?: string;
  confidence?: number;
  recipeName?: string;
  explanation?: string;
  policyHits?: string[];
  /** Called with reviewer comment when Approve is confirmed */
  onApprove?: (comment: string) => void;
  /** Called with reviewer comment when Reject is confirmed */
  onReject?: (comment: string) => void;
  onEscalate?: () => void;
  onOverride?: () => void;
  /** Whether an action is in progress (disables buttons) */
  actionLoading?: boolean;
  /** Whether user has admin role (enables Override on RED) */
  isAdmin?: boolean;
  style?: CSSProperties;
}

const VERDICT_CONFIG: Record<ShadowVerdict, {
  label: string;
  icon: ReactNode;
}> = {
  GREEN: {
    label: "Auto-resolved",
    icon: <Check size={14} />,
  },
  YELLOW: {
    label: "Review Required",
    icon: <AlertTriangle size={14} />,
  },
  RED: {
    label: "Blocked by Policy",
    icon: <ShieldX size={14} />,
  },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", flex: 1 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "var(--color-surface-tertiary)",
          borderRadius: "var(--radius-full)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct >= 80 ? "var(--color-success)" : pct >= 50 ? "var(--color-warning)" : "var(--color-error)",
            borderRadius: "var(--radius-full)",
            transition: "width var(--dur-normal) var(--ease-out)",
          }}
        />
      </div>
      <span
        className="mono-sm"
        style={{
          fontSize: "var(--font-size-label)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-text-tertiary)",
          fontWeight: 600,
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

export function AgentReasoningCard({
  verdict,
  intent,
  confidence,
  recipeName,
  explanation,
  policyHits,
  onApprove,
  onReject,
  onEscalate,
  onOverride,
  actionLoading = false,
  isAdmin = false,
  style,
}: AgentReasoningCardProps) {
  const config = VERDICT_CONFIG[verdict];
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");

  function confirmAction() {
    if (pendingAction === "approve" && onApprove) {
      onApprove(comment);
    } else if (pendingAction === "reject" && onReject) {
      onReject(comment);
    }
    setPendingAction(null);
    setComment("");
  }

  function cancelAction() {
    setPendingAction(null);
    setComment("");
  }

  return (
    <div
      style={{
        background: "var(--color-surface-primary)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* ── Layer 1: Always visible ─────────────────────────────────── */}
      <div style={{ padding: "var(--space-16) var(--space-20)" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
            <Zap size={16} color="var(--color-brand)" />
            <span
              style={{
                fontSize: "var(--font-size-subhead)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              Agent Analysis
            </span>
          </div>
          <Badge variant={verdictVariant(verdict)} icon={config.icon}>
            {config.label}
          </Badge>
        </div>

        {/* Confidence bar */}
        {confidence !== undefined && (
          <div style={{ marginBottom: "var(--space-12)" }}>
            <span
              className="label"
              style={{
                display: "block",
                fontSize: "var(--font-size-label)",
                color: "var(--color-text-tertiary)",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: "var(--space-4)",
              }}
            >
              Confidence
            </span>
            <ConfidenceBar value={confidence} />
          </div>
        )}

        {/* Key data points (2-3 max per Section 11.1) */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-16)",
            marginBottom: "var(--space-12)",
            flexWrap: "wrap",
          }}
        >
          {intent && (
            <div>
              <span className="label" style={{ fontSize: "var(--font-size-label)", color: "var(--color-text-quaternary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                Intent
              </span>
              <div style={{ fontSize: "var(--font-size-body)", fontWeight: 600, color: "var(--color-text-primary)", marginTop: 2 }}>
                {intent.replace(/_/g, " ")}
              </div>
            </div>
          )}
          {recipeName && (
            <div>
              <span className="label" style={{ fontSize: "var(--font-size-label)", color: "var(--color-text-quaternary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                Recipe
              </span>
              <div style={{ fontSize: "var(--font-size-body)", fontWeight: 500, color: "var(--color-text-primary)", marginTop: 2 }}>
                {recipeName.replace(".py", "")}
              </div>
            </div>
          )}
        </div>

        {/* Explanation / recommendation */}
        {explanation && (
          <p
            style={{
              fontSize: "var(--font-size-body)",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
              margin: 0,
              marginBottom: "var(--space-12)",
            }}
          >
            {explanation}
          </p>
        )}

        {/* Policy hits for RED */}
        {verdict === "RED" && policyHits && policyHits.length > 0 && (
          <div
            style={{
              padding: "var(--space-8) var(--space-12)",
              background: "var(--color-error-subtle)",
              borderRadius: "var(--radius-sm)",
              marginBottom: "var(--space-12)",
            }}
          >
            <span className="label" style={{ fontSize: "var(--font-size-label)", color: "var(--color-error)", fontWeight: 600 }}>
              Blocking Policy Rules
            </span>
            <ul style={{ margin: "var(--space-4) 0 0", paddingLeft: "var(--space-16)", fontSize: "var(--font-size-caption)", color: "var(--color-error)" }}>
              {policyHits.map((hit) => (
                <li key={hit}>{hit}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons — verdict-specific per Section 11.1 */}
        {!pendingAction && (
          <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
            {verdict === "YELLOW" && (
              <>
                {onApprove && <Button variant="brand" size="sm" disabled={actionLoading} onClick={() => setPendingAction("approve")}>Approve</Button>}
                {onReject && <Button variant="neutral" size="sm" disabled={actionLoading} onClick={() => setPendingAction("reject")}>Reject</Button>}
                {onEscalate && <Button variant="ghost" size="sm" disabled={actionLoading} onClick={onEscalate}>Escalate</Button>}
              </>
            )}
            {verdict === "RED" && (
              <>
                <Button variant="neutral" size="sm" disabled={actionLoading} onClick={() => setPendingAction("approve")}>Acknowledge</Button>
                {isAdmin && onOverride && (
                  <Button variant="destructive" size="sm" disabled={actionLoading} onClick={onOverride}>Override</Button>
                )}
                {onEscalate && <Button variant="ghost" size="sm" disabled={actionLoading} onClick={onEscalate}>Escalate</Button>}
              </>
            )}
          </div>
        )}

        {/* Comment input — shown when Approve or Reject is clicked */}
        {pendingAction && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-8)",
            padding: "var(--space-12)",
            background: "var(--color-surface-secondary)",
            borderRadius: "var(--radius-sm)",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-6)",
              fontSize: "var(--font-size-caption)",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
            }}>
              <MessageSquare size={14} />
              {pendingAction === "approve" ? "Approval" : "Rejection"} Comment
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={pendingAction === "approve"
                ? "Add approval notes (optional)..."
                : "Provide rejection reason..."
              }
              autoFocus
              rows={3}
              style={{
                width: "100%",
                padding: "var(--space-8) var(--space-12)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--font-size-caption)",
                fontFamily: "var(--font-sans)",
                color: "var(--color-text-primary)",
                background: "var(--color-surface-primary)",
                resize: "vertical",
                outline: "none",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--color-brand)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--color-border-default)"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) confirmAction(); }}
            />
            <div style={{ display: "flex", gap: "var(--space-8)", justifyContent: "flex-end" }}>
              <Button variant="ghost" size="sm" onClick={cancelAction}>Cancel</Button>
              <Button
                variant={pendingAction === "approve" ? "brand" : "neutral"}
                size="sm"
                disabled={actionLoading}
                onClick={confirmAction}
              >
                {actionLoading ? "Processing..." : pendingAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

