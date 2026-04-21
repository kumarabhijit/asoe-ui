# ASOE UI — Agent-First Control Tower

Frontend for the **ASOE (Agentic System of Engagement)** platform — a deterministic, compliance-first orchestration system for resolving Order-to-Cash exceptions in CPG supply chains.

The UI is a **control tower where the system is the primary actor**. Agents classify, audit, and resolve exceptions autonomously. Humans intervene at decision points — approvals, overrides, escalations.

---

## Quick Start

```bash
npm install
npm run dev
# Navigate to http://localhost:3000/exceptions
# Login: jane@acme.com / password
```

---

## Demo flows (mock mode)

The mock API (`src/lib/api.ts`) is seeded so you can exercise every governance flow locally without a backend:

- **Approve / Reject (1-click):** any YELLOW exception — e.g. `exc-002`, `exc-007`, `exc-013`. Analyst role sees `Approve` + `Reject` + `Escalate`.
- **Override… (override chooser):** sign in as a manager or admin (e.g. `sarah.chen@acme-corp.com`, `jane@acme.com`) and click `Override…` on any YELLOW or RED record. The chooser sources its resolution-action and reason-category vocabularies from `GET /api/v1/health`. Notes are mandatory.
- **Four-eyes cosign:** exception IDs `exc-001` and `exc-010` are seeded in `MOCK_FINANCIAL_IMPACT_USD` above the cosign threshold ($25K and $42.5K respectively). Sign in as one manager, click `Override…` and submit an override — the record transitions to `PENDING_COSIGN` and the cosign banner appears. Sign in as a **different** manager/admin (via the `UserSwitcher` in the nav) to see `[Approve cosign]` / `[Reject cosign]`. The initiator sees a read-only "Awaiting cosign" message (segregation of duties).
- **Escalate:** available to analyst+ via the `exceptions:escalate` permission; wired to `exceptionsApi.escalate()`.
- **Re-analyze:** YELLOW / RED / FAILED records show a `Re-analyze` button (manager+). Mandatory reason. Capped at 3 attempts.

Every mutating call sends a client-generated `Idempotency-Key` (UUID v4) so repeated clicks are safe.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS + CSS custom properties (`design-tokens.css`) + CVA (class-variance-authority) |
| Components | Shadcn/ui (Select, DropdownMenu, Dialog) + 15 custom agent-first components |
| Dark Mode | System-default via `next-themes` (`prefers-color-scheme`) |
| Layout | react-resizable-panels (three-pane Outlook master-detail) |
| Icons | Lucide React (16/20/24px — never emoji) |
| Auth | NextAuth.js → FastAPI auth endpoints (`asoe2`) |
| Validation | Zod |
| Backend | FastAPI (`asoe2` repository) |

---

## Repository Structure

```
asoe-ui/
├── src/
│   ├── app/                      # Pages (Next.js App Router)
│   │   ├── layout.tsx            # Root layout (skip-to-main, Providers wrapper)
│   │   ├── providers.tsx         # Client-side providers (SessionProvider + ToastProvider)
│   │   ├── exceptions/           # Exception Queue (three-pane Outlook) + 13 decomposed detail sub-components
│   │   ├── dashboard/            # Analytics dashboard + recent activity feed
│   │   ├── inbox/                # Customer Inbox (AI email triage, two-pane)
│   │   ├── settings/             # Settings page (Phase 9 stub — admin, SSO, agent config)
│   │   ├── login/                # Multi-step login (email → password → SSO)
│   │   └── auth/callback/        # SSO callback handler
│   ├── components/ui/            # 15 reusable components (Section 11.2)
│   ├── hooks/                    # useAuth, useHealth, useWebSocket
│   ├── lib/                      # API client, auth config, RBAC
│   ├── types/                    # TypeScript types (mirrors asoe2 + UI display types)
│   └── styles/                   # design-tokens.css (45+ CSS custom properties)
├── docs/
│   └── AUDITOR_GUIDE.md          # Frontend compliance controls (SOX/SOC2)
├── prompts/
│   ├── asoe-ui-design-system.md  # Reproducible design system generation prompt
│   ├── update_docs.md            # Documentation maintenance protocol
│   ├── pre_code_session.md       # Pre-session checklist
│   └── full_project_sequence.md  # Master phase index
├── skills/
│   └── asoe-ui-design/           # Design system skill + references
├── samples/
│   └── asoe-sample-screen.jsx    # Reference implementation
├── CLAUDE.md                     # Engineering guardrails
├── DESIGN.md                     # Code-to-architecture map
├── tasks.md                      # Phase-based progress tracker
├── consol_arch.md                # Platform architecture (shared reference)
└── plan.md                       # Historical login plan (superseded by tasks.md)
```

---

## Documentation

| Document | Audience | Purpose |
|---|---|---|
| `CLAUDE.md` | Developers | Engineering guardrails (Guardrail #2, design tokens, types, agent-first) |
| `DESIGN.md` | Engineers | Code-to-architecture map (components, pages, types, API client) |
| `ui_architecture.md` | Engineers / Architects | UI architecture extraction — alignment, drift register, proposed backend changes |
| `docs/AUDITOR_GUIDE.md` | Auditors | 10 frontend compliance controls (RBAC, session, trace, tenancy) |
| `tasks.md` | Team | Phase-based progress (Phases 0-8.10 complete, 9-11 pending) |
| `consol_arch.md` | All | Platform architecture — Section 11 is a stub pointer to `ui_architecture.md` |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth base URL |
| `NEXTAUTH_SECRET` | — | JWT signing secret (required) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI backend URL |
| `NEXT_PUBLIC_SHOW_PREVIEW_FEATURES` | `true` | Show preview/upcoming feature tabs (SAP Data, Change Analysis). Set to `"false"` for production to hide. |
| `NEXT_PUBLIC_ASOE_ERP_VENDOR` | `SAP` (committed default in `next.config.mjs`) | ERP vocabulary used for intent / sub_type display labels. Allowed values: `SAP`, `ORACLE`, `SALESFORCE`, `GENERIC`. Invalid / missing values fall back to `GENERIC`. See `src/config/erp-label-map.ts` for the per-vendor maps and `src/hooks/useErpProfile.ts` for the resolver. Canonical backend codes (intent enum, recipe names) are unaffected. |
| `SSO_CLIENT_ID` | — | OIDC client ID (per IdP) |
| `SSO_CLIENT_SECRET` | — | OIDC client secret (per IdP) |
| `SSO_ISSUER_URL` | — | OIDC issuer URL (per IdP) |

See `.env.local.example` for the full template.

---

## Design System

The visual design system is defined in `skills/asoe-ui-design/`:

- **`SKILL.md`** — Design philosophy, token architecture, component library, anti-patterns, quality gates
- **`references/design-tokens.css`** — CSS custom properties (colors, spacing, shadows, motion)
- **`references/component-patterns.md`** — Component anatomy and spacing specs
- **`references/layout-templates.md`** — Page layouts and grid specifications
- **`references/anti-patterns.md`** — 13 "never do this" patterns with corrections

**Key principles:**
- **Agent-first** — system is alive, humans intervene at decision points
- **Brand restraint** — brand purple (`#5A4BD6`) in exactly 3 places: primary CTA, nav logo, active tab underline
- **Two-layer cognition** — Layer 1 (scannable recommendation) + Layer 2 (expandable evidence)

---

## Architecture

The UI implements the architecture defined in `ui_architecture.md`. Key patterns:

- **18 components** (15 custom + 3 Shadcn) — agent-first components are custom; Shadcn/ui for interactive primitives (Select, DropdownMenu, Dialog). All styled with Tailwind CSS via design token mapping.
- **Health-driven enums** — filter dropdowns source values from `GET /api/v1/health` at runtime (Guardrail #2 — no hardcoded intents or lifecycle states)
- **WebSocket real-time** — pipeline progress via `useWebSocket` hook (Section 8 protocol with reconnection backoff)
- **Types mirror backend** — `src/types/` matches `asoe2` Pydantic models field-for-field

See `DESIGN.md` for the full code-to-architecture mapping.
