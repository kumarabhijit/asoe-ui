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

import { useState, type ReactNode } from "react";
import { Zap, Check, AlertTriangle, ShieldX, MessageSquare } from "lucide-react";
import { Badge, verdictVariant } from "./Badge";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import type { ShadowVerdict } from "@/types/exceptions";

interface AgentReasoningCardProps {
  verdict: ShadowVerdict;
  intent?: string;
  confidence?: number;
  recipeName?: string;
  explanation?: string;
  policyHits?: string[];
  onApprove?: (comment: string) => void;
  onReject?: (comment: string) => void;
  onEscalate?: () => void;
  onOverride?: () => void;
  actionLoading?: boolean;
  isAdmin?: boolean;
  className?: string;
}

const VERDICT_CONFIG: Record<ShadowVerdict, { label: string; icon: ReactNode }> = {
  GREEN: { label: "Auto-resolved", icon: <Check size={14} /> },
  YELLOW: { label: "Review Required", icon: <AlertTriangle size={14} /> },
  RED: { label: "Blocked by Policy", icon: <ShieldX size={14} /> },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-8 flex-1">
      <div className="flex-1 h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-normal ease-out",
            pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-error",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-label font-mono text-text-tertiary font-semibold min-w-[32px] text-right">
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
  className,
}: AgentReasoningCardProps) {
  const config = VERDICT_CONFIG[verdict];
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");

  function confirmAction() {
    if (pendingAction === "approve" && onApprove) onApprove(comment);
    else if (pendingAction === "reject" && onReject) onReject(comment);
    setPendingAction(null);
    setComment("");
  }

  function cancelAction() {
    setPendingAction(null);
    setComment("");
  }

  return (
    <div className={cn("bg-surface-primary rounded-md shadow-sm overflow-hidden", className)}>
      {/* ── Layer 1: Always visible ─────────────────────────────────── */}
      <div className="px-20 py-16">
        {/* Header row */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-8">
            <Zap size={16} className="text-brand" />
            <span className="text-subhead font-semibold text-text-primary">Agent Analysis</span>
          </div>
          <Badge variant={verdictVariant(verdict)} icon={config.icon}>
            {config.label}
          </Badge>
        </div>

        {/* Confidence bar */}
        {confidence !== undefined && (
          <div className="mb-12">
            <span className="block text-label text-text-tertiary font-semibold tracking-wider uppercase mb-4">
              Confidence
            </span>
            <ConfidenceBar value={confidence} />
          </div>
        )}

        {/* Key data points */}
        <div className="flex gap-16 mb-12 flex-wrap">
          {intent && (
            <div>
              <span className="text-label text-text-quaternary uppercase tracking-wider font-semibold">Intent</span>
              <div className="text-body font-semibold text-text-primary mt-px">{intent.replace(/_/g, " ")}</div>
            </div>
          )}
          {recipeName && (
            <div>
              <span className="text-label text-text-quaternary uppercase tracking-wider font-semibold">Recipe</span>
              <div className="text-body font-medium text-text-primary mt-px">{recipeName.replace(".py", "")}</div>
            </div>
          )}
        </div>

        {/* Explanation */}
        {explanation && (
          <p className="text-body text-text-secondary leading-normal m-0 mb-12">
            {explanation}
          </p>
        )}

        {/* Policy hits for RED */}
        {verdict === "RED" && policyHits && policyHits.length > 0 && (
          <div className="px-12 py-8 bg-error-subtle rounded-sm mb-12">
            <span className="text-label text-error font-semibold">Blocking Policy Rules</span>
            <ul className="mt-4 mb-0 pl-16 text-caption text-error">
              {policyHits.map((hit) => (
                <li key={hit}>{hit}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        {!pendingAction && (
          <div className="flex gap-8 flex-wrap">
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
                {isAdmin && onOverride && <Button variant="destructive" size="sm" disabled={actionLoading} onClick={onOverride}>Override</Button>}
                {onEscalate && <Button variant="ghost" size="sm" disabled={actionLoading} onClick={onEscalate}>Escalate</Button>}
              </>
            )}
          </div>
        )}

        {/* Comment input */}
        {pendingAction && (
          <div className="flex flex-col gap-8 p-12 bg-surface-secondary rounded-sm">
            <div className="flex items-center gap-6 text-caption font-semibold text-text-secondary">
              <MessageSquare size={14} />
              {pendingAction === "approve" ? "Approval" : "Rejection"} Comment
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={pendingAction === "approve" ? "Add approval notes (optional)..." : "Provide rejection reason..."}
              autoFocus
              rows={3}
              className="w-full px-12 py-8 border border-border rounded-sm text-caption font-sans text-text-primary bg-surface-primary resize-y outline-none focus:border-brand"
              onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) confirmAction(); }}
            />
            <div className="flex gap-8 justify-end">
              <Button variant="ghost" size="sm" onClick={cancelAction}>Cancel</Button>
              <Button variant={pendingAction === "approve" ? "brand" : "neutral"} size="sm" disabled={actionLoading} onClick={confirmAction}>
                {actionLoading ? "Processing..." : pendingAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
