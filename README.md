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

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript) |
| Styling | CSS custom properties (`design-tokens.css`) + Tailwind CSS |
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
│   │   ├── exceptions/           # Exception Queue (three-pane Outlook layout) + polymorphic detail
│   │   ├── dashboard/            # Analytics dashboard + recent activity feed
│   │   ├── inbox/                # Customer Inbox (AI email triage, two-pane)
│   │   ├── settings/             # Settings page (Phase 9 stub — admin, SSO, agent config)
│   │   ├── login/                # Multi-step login (email → password → SSO)
│   │   └── auth/callback/        # SSO callback handler
│   ├── components/ui/            # 14 reusable components (Section 11.2)
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
| `tasks.md` | Team | Phase-based progress (Phases 0-8.7 complete, 9-11 pending) |
| `consol_arch.md` | All | Platform architecture — Section 11 is a stub pointer to `ui_architecture.md` |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth base URL |
| `NEXTAUTH_SECRET` | — | JWT signing secret (required) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI backend URL |
| `NEXT_PUBLIC_SHOW_PREVIEW_FEATURES` | `true` | Show preview/upcoming feature tabs (SAP Data, Change Analysis). Set to `"false"` for production to hide. |
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

- **14 custom components** — agent-first components (NavBar, WaterfallStepper, AgentReasoningCard, PricingWaterfall) are custom; Shadcn adopted only for non-agent primitives (Section 11.2)
- **Health-driven enums** — filter dropdowns source values from `GET /api/v1/health` at runtime (Guardrail #2 — no hardcoded intents or lifecycle states)
- **WebSocket real-time** — pipeline progress via `useWebSocket` hook (Section 8 protocol with reconnection backoff)
- **Types mirror backend** — `src/types/` matches `asoe2` Pydantic models field-for-field

See `DESIGN.md` for the full code-to-architecture mapping.
