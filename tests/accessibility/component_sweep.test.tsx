/**
 * Component-level axe sweep (L2).
 *
 * docs/test-strategy/UX_ACCESSIBILITY.md Gap A. Extends the
 * existing status_components.test.tsx sweep to every top-level
 * interactive component. New components added under
 * `src/components/ui/` get a case in this file as a
 * Definition-of-Done step.
 *
 * Pattern: one parametrised describe-block per component, with
 * canonical render-state cases. Each case runs `axe(container)`
 * and asserts no violations.
 */
import * as React from "react";
import { render, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ThemeProvider } from "next-themes";

import { AgentReasoningCard } from "@/components/ui/AgentReasoningCard";
import { NavBar } from "@/components/ui/NavBar";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EvidenceBlock } from "@/components/ui/EvidenceBlock";
import { EventsTimeline } from "@/components/ui/EventsTimeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/DropdownMenu";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/Select";
import type { ExecutedNode } from "@/types/api";

// Components that read next-themes / useTheme need a ThemeProvider
// wrapper so the hook resolves to a concrete value. Without it the
// initial render emits an undefined-theme warning that, while not
// an axe violation, is noise in the test output.
function withTheme(node: React.ReactNode) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {node}
    </ThemeProvider>
  );
}

async function expectNoViolations(node: React.ReactElement) {
  const { container } = render(node);
  // Some components transition state in useEffect on mount
  // (ThemeToggle's `mounted` flag, Toast portal mount). Flush
  // microtasks so axe sees the settled DOM.
  await act(async () => {});
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

// ---------------------------------------------------------------------------
// AgentReasoningCard — Layer-1 cognition surface. Every verdict ×
// permission branch must be axe-clean.
// ---------------------------------------------------------------------------
describe("a11y sweep: AgentReasoningCard", () => {
  it("GREEN / privileged operator", async () =>
    expectNoViolations(
      <AgentReasoningCard
        verdict="GREEN"
        intent="PRICE_MISMATCH"
        confidence={0.92}
        recipeName="PriceAdjustmentRecipe"
        explanation="Auto-resolved within tolerance."
        canOverride
      />,
    ));

  it("YELLOW / analyst (Approve + Reject + Escalate)", async () =>
    expectNoViolations(
      <AgentReasoningCard
        verdict="YELLOW"
        intent="DUPLICATE_PO"
        confidence={0.55}
        recipeName="DuplicateBlockRecipe"
        explanation="Confidence below auto-resolve threshold."
        canApprove
        canEscalate
      />,
    ));

  it("RED / privileged (Override + Escalate)", async () =>
    expectNoViolations(
      <AgentReasoningCard
        verdict="RED"
        intent="CREDIT_BLOCK"
        confidence={0.88}
        recipeName="CreditHoldRecipe"
        explanation="Blocked by Compliance Shadow — PENALTY_MATRIX_VIOLATION."
        policyHits={["PENALTY_MATRIX"]}
        canOverride
        canEscalate
      />,
    ));

  it("execution-error surface", async () =>
    expectNoViolations(
      <AgentReasoningCard
        verdict="YELLOW"
        executionError={{
          node: "execute_recipe",
          message: "PriceAdjustmentRecipe timed out after 30s.",
        }}
        canEscalate
      />,
    ));
});

// ---------------------------------------------------------------------------
// NavBar — chrome surface. Every authenticated route mounts this;
// a violation here cascades to every page.
// ---------------------------------------------------------------------------
describe("a11y sweep: NavBar", () => {
  const tabs = [
    { id: "cases", label: "Cases", href: "/cases" },
    { id: "dashboard", label: "Dashboard", href: "/dashboard" },
    { id: "settings", label: "Settings", href: "/settings" },
  ];

  it("minimal (anonymous chrome)", async () =>
    expectNoViolations(withTheme(<NavBar tabs={tabs} />)));

  it("authenticated (user menu + agent count)", async () =>
    expectNoViolations(
      withTheme(
        <NavBar
          tabs={tabs}
          activeTab="cases"
          userName="Marcus Webb"
          userInitials="MW"
          userTitle="Manager"
          agentCount={4}
          onSignOut={() => {}}
        />,
      ),
    ));
});

// ---------------------------------------------------------------------------
// Toast — the live-region surface emitted on every disposition.
// Mount a harness that fires a toast on mount; axe inspects the
// rendered aria-live region.
// ---------------------------------------------------------------------------
describe("a11y sweep: Toast (in provider)", () => {
  function ToastFireOnMount({
    variant,
  }: {
    variant: "success" | "warning" | "error" | "info";
  }) {
    const { addToast } = useToast();
    React.useEffect(() => {
      addToast(variant, `${variant} message`);
    }, [addToast, variant]);
    return null;
  }

  for (const variant of ["success", "warning", "error", "info"] as const) {
    it(`${variant} variant`, async () =>
      expectNoViolations(
        <ToastProvider>
          <ToastFireOnMount variant={variant} />
        </ToastProvider>,
      ));
  }
});

// ---------------------------------------------------------------------------
// ThemeToggle — dropdown control mounted in the chrome.
// ---------------------------------------------------------------------------
describe("a11y sweep: ThemeToggle", () => {
  it("closed", async () =>
    expectNoViolations(withTheme(<ThemeToggle />)));
});

// ---------------------------------------------------------------------------
// EvidenceBlock — Guardrail #6: three legal presence states.
// ---------------------------------------------------------------------------
describe("a11y sweep: EvidenceBlock", () => {
  it("present (audit-bearing) — caller-rendered value", async () =>
    expectNoViolations(
      <dl>
        <EvidenceBlock tier="audit-bearing" value="$105.00">
          {(v) => (
            <div>
              <dt>PO Price</dt>
              <dd>{String(v)}</dd>
            </div>
          )}
        </EvidenceBlock>
      </dl>,
    ));

  // The CNRR placeholder renders a <div role="note">, not a
  // <dt>/<dd> pair, so it cannot legally be a direct child of a
  // <dl>. Render under a plain <section> for the axe sweep —
  // production composes it inside a section component (e.g.
  // PriceHoldSection) the same way.
  it("conditional + predicate fails → CNRR placeholder", async () =>
    expectNoViolations(
      <section aria-label="Test">
        <EvidenceBlock
          tier="conditional"
          predicateHolds={false}
          value={null}
        >
          {() => null}
        </EvidenceBlock>
      </section>,
    ));

  it("contextual + absent → structural omission (no DOM)", async () =>
    expectNoViolations(
      <section aria-label="Test">
        <EvidenceBlock tier="contextual" value={null}>
          {() => null}
        </EvidenceBlock>
      </section>,
    ));
});

// ---------------------------------------------------------------------------
// EventsTimeline — trace surface; status indicators must combine
// shape + colour (WCAG 1.4.1).
// ---------------------------------------------------------------------------
describe("a11y sweep: EventsTimeline", () => {
  it("empty state", async () =>
    expectNoViolations(<EventsTimeline executedNodes={[]} />));

  const populated: ExecutedNode[] = [
    {
      node: "classify_intent",
      entered_at: "2026-05-14T10:00:00Z",
      completed_at: "2026-05-14T10:00:01Z",
      duration_ms: 1000,
      timestamp: "2026-05-14T10:00:00Z",
      status: "completed",
      decision: { intent: "PRICE_MISMATCH", confidence: 0.92 },
      exit_verdict: null,
      policy_hits: [],
      sub_spans: [],
    },
    {
      node: "shadow_audit",
      entered_at: "2026-05-14T10:00:01Z",
      completed_at: "2026-05-14T10:00:02Z",
      duration_ms: 1000,
      timestamp: "2026-05-14T10:00:01Z",
      status: "completed",
      decision: { shadow_status: "GREEN" },
      exit_verdict: "GREEN",
      policy_hits: [],
      sub_spans: [],
    },
  ];

  it("populated trace", async () =>
    expectNoViolations(
      <EventsTimeline executedNodes={populated} finalStatus="COMPLETE" />,
    ));
});

// ---------------------------------------------------------------------------
// Dialog — overlay surface. The Radix primitive owns focus-trap
// and aria-modal; axe asserts the wiring stays consistent.
// ---------------------------------------------------------------------------
describe("a11y sweep: Dialog", () => {
  it("open with title + description", async () =>
    expectNoViolations(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm override</DialogTitle>
            <DialogDescription>
              This action is logged in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <button type="button">Confirm</button>
        </DialogContent>
      </Dialog>,
    ));
});

// ---------------------------------------------------------------------------
// DropdownMenu — primary chrome interaction surface (user menu,
// row-level action overflow). Trigger-only render covers the
// closed default which is the most common DOM state.
// ---------------------------------------------------------------------------
describe("a11y sweep: DropdownMenu", () => {
  it("trigger only (closed)", async () =>
    expectNoViolations(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Open menu">
          <span>Menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item one</DropdownMenuItem>
          <DropdownMenuItem>Item two</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    ));
});

// ---------------------------------------------------------------------------
// Select — primary filter surface (case status, source, etc.).
// ---------------------------------------------------------------------------
describe("a11y sweep: Select", () => {
  it("closed with aria-label", async () =>
    expectNoViolations(
      <Select>
        <SelectTrigger aria-label="Filter by status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>,
    ));
});
