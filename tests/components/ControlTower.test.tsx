/**
 * ControlTower — Modern /dashboard surface (sign-off 2026-06-10).
 *
 * Locks the dumb-projector behaviour over the backend-composed
 * ControlTowerResponse: structural omission of null/empty surfaces
 * (RBAC-stripped dollars → tower without money, never zeroed amounts),
 * governed labels for raw tokens, live SLA labels from timestamps, and
 * the tri-state load handling (error + retry, no skeleton-forever).
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ControlTower } from "@/app/dashboard/ControlTower";
import type { ControlTowerResponse } from "@/types/api";

const controlTowerMock = vi.fn();

vi.mock("@/lib/api", () => ({
  exceptionsApi: {
    controlTower: (...args: unknown[]) => controlTowerMock(...args),
  },
}));
vi.mock("@/hooks/useWebSocket", () => ({ useWebSocket: () => undefined }));
vi.mock("@/hooks/useHealth", () => ({ useHealth: () => ({ health: null }) }));
vi.mock("@/hooks/useErpProfile", () => ({ useErpProfile: () => null }));

beforeEach(() => controlTowerMock.mockReset());
afterEach(() => vi.clearAllMocks());

const HOUR_MS = 3_600_000;

function fullPayload(): ControlTowerResponse {
  return {
    kpis: {
      auto_resolved_pct: 86.4,
      open_needs_human: 5,
      avg_resolution_time_seconds: 186,
      dollar_at_risk: { amount_cents: 21_400_00, currency: "USD" },
    },
    throughput: [
      { hour_start: new Date(Date.now() - HOUR_MS).toISOString(), by_agents: 12, by_humans: 2 },
      { hour_start: new Date().toISOString(), by_agents: 9, by_humans: 1 },
    ],
    mix_by_intent: [
      { intent: "CREDIT_BLOCK", dollar_at_risk: { amount_cents: 9_000_00, currency: "USD" } },
      { intent: "DUPLICATE_PO", dollar_at_risk: { amount_cents: 3_400_00, currency: "USD" } },
    ],
    agent_activity: [
      { domain: "SG_BLOCK_PRICING", resolving_now: 3, resolved_today: 41 },
      { domain: "SG_BLOCK_CREDIT", resolving_now: 0, resolved_today: 7 },
    ],
    sla_risk: [
      {
        case_id: "case-1",
        customer_name: "Kroger",
        intent: "CREDIT_BLOCK",
        sla_due_at: new Date(Date.now() + HOUR_MS).toISOString(),
        dollar_impact: { amount_cents: 12_100_00, currency: "USD" },
      },
    ],
    generated_at: new Date().toISOString(),
  };
}

describe("ControlTower — full payload", () => {
  it("projects the KPI band, $ mix, agent roster, and SLA queue", async () => {
    controlTowerMock.mockResolvedValue(fullPayload());
    render(<ControlTower />);

    expect(await screen.findByText("86.4%")).toBeInTheDocument();
    expect(screen.getByText("Open · needs you")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("$ at risk now")).toBeInTheDocument();
    expect(screen.getByText("$21,400.00")).toBeInTheDocument();

    // $ mix renders amounts (decision value = money, not counts).
    expect(screen.getByText("$9,000.00")).toBeInTheDocument();

    // Agent roster: dot never alone — explicit working/idle text
    // (WCAG 1.4.1), and counts in plain language.
    expect(screen.getByText("working")).toBeInTheDocument();
    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(screen.getByText(/Resolving 3 · 41 resolved today/)).toBeInTheDocument();

    // SLA queue: deep-link to the case + a LIVE relative label derived
    // from the timestamp (never a backend-prerendered string).
    const link = screen.getByRole("link", { name: "Kroger" });
    expect(link).toHaveAttribute("href", "/cases/case-1");
    expect(screen.getByText(/^Due in /)).toBeInTheDocument();
    expect(screen.getByText("$12,100.00")).toBeInTheDocument();

    // Throughput bars carry a text alternative (not color/size-only).
    expect(
      screen.getByRole("img", { name: /12 resolved by agents, 2 routed to humans/ }),
    ).toBeInTheDocument();
  });
});

describe("ControlTower — structural omission (RBAC-stripped dollars)", () => {
  it("renders the tower without money when the backend strips $", async () => {
    const stripped = fullPayload();
    stripped.kpis.dollar_at_risk = null;
    stripped.mix_by_intent = [];
    stripped.sla_risk = stripped.sla_risk.map((r) => ({
      ...r,
      dollar_impact: null,
    }));
    controlTowerMock.mockResolvedValue(stripped);
    const { container } = render(<ControlTower />);

    await screen.findByText("Open · needs you");
    expect(screen.queryByText("$ at risk now")).not.toBeInTheDocument();
    expect(screen.queryByText("Exception mix")).not.toBeInTheDocument();
    // The SLA table drops its $ column entirely — no empty-cell
    // partial-truth, no zeroed amounts.
    expect(screen.queryByText("$ at risk")).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("$");
  });

  it("omits None KPIs instead of fabricating zeros", async () => {
    const sparse = fullPayload();
    sparse.kpis.auto_resolved_pct = null;
    sparse.kpis.avg_resolution_time_seconds = null;
    controlTowerMock.mockResolvedValue(sparse);
    render(<ControlTower />);
    await screen.findByText("Open · needs you");
    expect(screen.queryByText("Auto-resolved by agents")).not.toBeInTheDocument();
    expect(screen.queryByText("Avg time to resolve")).not.toBeInTheDocument();
  });
});

describe("ControlTower — load failure", () => {
  it("surfaces an error with retry instead of a skeleton forever", async () => {
    controlTowerMock.mockRejectedValue(new Error("boom"));
    render(<ControlTower />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't load the control tower/i,
    );
    controlTowerMock.mockResolvedValue(fullPayload());
    screen.getByRole("button", { name: /retry/i }).click();
    await waitFor(() =>
      expect(screen.getByText("Open · needs you")).toBeInTheDocument(),
    );
  });
});
