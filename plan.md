# ASOE Login Screen — Implementation Plan

## Context

ASOE is currently a **design system documentation repository** (tokens, component specs, sample JSX). There is no running application yet. We are building the ASOE frontend as a **Next.js** app with a **FastAPI** backend.

This plan covers the login screen implementation — the first screen users see.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | **Next.js 14+** (App Router, React 18, TypeScript) |
| Backend | **FastAPI** (Python, to be built separately) |
| Styling | CSS custom properties (design-tokens.css) + Tailwind CSS |
| Icons | Lucide React |
| Fonts | Inter (Google Fonts) + SF Mono (system) |
| Auth | NextAuth.js (frontend) → FastAPI auth endpoints (backend) |

---

## Architecture Decisions

### Enterprise Authentication Strategy

ASOE is an enterprise platform used by order management analysts, trade managers, and supply chain operators. The auth architecture must support:

#### 1. SSO via SAML 2.0 / OIDC (Primary)

Users authenticate through their corporate Identity Provider (Okta, Azure AD, Ping Identity, etc.):

```
User clicks "Sign in with SSO"
  → Next.js calls FastAPI /api/auth/sso/init
  → FastAPI returns IdP redirect URL
  → User authenticates at IdP
  → IdP redirects to /api/auth/sso/callback on FastAPI
  → FastAPI validates SAML assertion / OIDC token
  → FastAPI issues JWT (access + refresh tokens)
  → FastAPI redirects to Next.js /auth/callback with auth code
  → Next.js stores session via NextAuth.js
  → User lands on the main dashboard
```

#### 2. Email/Password with MFA (Fallback)

For external partners, contractors, or orgs without SSO:

```
User enters email + password
  → Next.js calls FastAPI POST /api/auth/login
  → FastAPI validates credentials, checks MFA requirement
  → If MFA required: returns { mfaRequired: true, mfaToken }
  → User enters TOTP code → FastAPI POST /api/auth/mfa/verify
  → FastAPI issues JWT tokens
  → Next.js stores session
```

#### 3. RBAC (Role-Based Access Control)

Roles are assigned in the backend and included in the JWT token payload:

| Role | Description | Access |
|------|-------------|--------|
| `analyst` | Order Management Analyst | Queue view, approve/override individual orders, view agent reasoning |
| `manager` | Trade/Pricing Manager | All analyst access + bulk actions, rule config, escalation targets |
| `admin` | System Administrator | All access + user management, SSO config, agent settings, audit logs |
| `viewer` | Read-Only Stakeholder | View queues and dashboards, no action buttons |
| `partner` | External Partner | Scoped view of their own orders only |

**Token payload:**
```json
{
  "sub": "user-uuid",
  "email": "jane@acme.com",
  "name": "Jane Doe",
  "roles": ["analyst", "manager"],
  "org": "acme-corp",
  "permissions": ["orders:read", "orders:approve", "orders:override", "rules:read", "rules:write"],
  "exp": 1712000000
}
```

#### 4. Session Management

- **Access token**: Short-lived (15 min), stored in memory / httpOnly cookie
- **Refresh token**: Long-lived (7 days), httpOnly cookie, rotated on use
- **NextAuth.js** manages the frontend session, calling FastAPI for token refresh
- **Middleware** (`middleware.ts`) protects routes server-side before rendering

---

## Login Screen Design

### Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  background: var(--color-surface-page)                                 │
│                                                                        │
│               ┌────────────────────────────────┐                       │
│               │  shadow-lg · radius-lg          │                       │
│               │                                │                       │
│               │  [■] ASOE                      │  ← logo mark (brand) │
│               │  Agentic System of Engagement  │  ← tagline (tertiary)│
│               │                                │                       │
│               │  ────────────────────────────── │                       │
│               │                                │                       │
│               │  [ 🏢  Sign in with SSO    ]   │  ← brand CTA (blue)  │
│               │                                │                       │
│               │  ─────── or ─────────────────  │  ← divider (tertiary)│
│               │                                │                       │
│               │  Email address                 │  ← label (tertiary)  │
│               │  ┌────────────────────────┐    │                       │
│               │  │ jane@acme.com          │    │  ← input             │
│               │  └────────────────────────┘    │                       │
│               │  Password                      │                       │
│               │  ┌────────────────────────┐    │                       │
│               │  │ ••••••••         [👁]  │    │  ← input + toggle    │
│               │  └────────────────────────┘    │                       │
│               │                                │                       │
│               │  [ Sign In                 ]   │  ← neutral button    │
│               │                                │                       │
│               │  Forgot password?              │  ← tertiary text     │
│               │                                │                       │
│               └────────────────────────────────┘                       │
│                                                                        │
│   ● 12 agents active · 847 exceptions resolved today                  │
│     ↑ pulse dot   ↑ activity stats (caption, tertiary)                │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Design System Compliance

- **Brand blue** on exactly 2 elements: SSO button (primary CTA) + logo mark
- **Sign In** button: `neutral` variant (gray text, bordered) — NOT blue
- **"Forgot password?"**: `var(--color-text-tertiary)`, not a blue link
- **Error messages**: `var(--color-error-subtle)` bg + `var(--color-error)` text
- **Inputs**: `var(--color-surface-primary)` bg, `var(--color-border-default)` border, focus ring `2px solid var(--color-brand)`
- **Card**: `var(--shadow-lg)`, `var(--radius-lg)`, `var(--color-surface-primary)` bg
- **Footer**: `.agent-active-dot` pulse + caption text — system appears alive
- **Typography**: Inter, max 3 weights (400/600/700), min 10px
- **Icons**: Lucide only (Building2 for SSO, Eye/EyeOff for password, Layers for logo)
- **Zero hardcoded hex** — all CSS custom properties
- **Accessible**: WCAG AA contrast, keyboard nav, focus visible, `aria-live` on errors

### States

| State | Behavior |
|-------|----------|
| Default | SSO button + email/password form visible |
| SSO Loading | SSO button shows spinner, form disabled, "Redirecting to your identity provider..." |
| Credential Loading | Sign In button shows spinner, inputs disabled |
| Error | Red error banner slides in above form: "Invalid email or password" |
| MFA Required | Form transitions to TOTP input (6-digit code) |
| Success | Brief "Welcome, Jane" → redirect to `/` |

---

## Implementation Steps

### Step 1: Scaffold Next.js Application

Initialize the project in the repo root:

```
asoe-ui/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── .env.local.example          # NEXTAUTH_SECRET, FASTAPI_URL, SSO config
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout: fonts, design-tokens.css import
│   │   ├── page.tsx            # Redirect to /dashboard (protected)
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── page.tsx    # SSO callback handler
│   │   └── globals.css         # Imports design-tokens.css + Tailwind directives
│   ├── components/
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       └── Logo.tsx
│   ├── lib/
│   │   ├── auth.ts             # NextAuth.js config (credentials + SSO providers)
│   │   ├── api.ts              # FastAPI client (fetch wrapper with base URL + token)
│   │   └── roles.ts            # Role/permission constants and helpers
│   ├── types/
│   │   └── auth.ts             # AuthUser, Role, Permission, LoginResponse types
│   ├── hooks/
│   │   └── useAuth.ts          # Client-side auth hook (wraps useSession)
│   ├── middleware.ts            # Next.js middleware: protect routes, check roles
│   └── styles/
│       └── design-tokens.css   # Copied from skills/references/
├── skills/                     # Existing design system docs (unchanged)
├── samples/                    # Existing sample (unchanged)
└── prompts/                    # Existing prompts (unchanged)
```

**Dependencies:**
- `next`, `react`, `react-dom` — framework
- `typescript`, `@types/react`, `@types/node` — types
- `tailwindcss`, `postcss`, `autoprefixer` — styling (utility supplement to tokens)
- `next-auth` — auth session management
- `lucide-react` — icons
- `zod` — form validation

### Step 2: Design Tokens + Global Styles

- Copy `skills/asoe-ui-design/references/design-tokens.css` → `src/styles/design-tokens.css`
- In `src/app/globals.css`: import Tailwind directives + design tokens
- In `src/app/layout.tsx`: import `globals.css`, set Inter font via `next/font/google`
- Configure Tailwind to extend with ASOE token values where useful (e.g., `colors.brand`)

### Step 3: Shared UI Components

Build the 4 primitives needed for the login screen:

**Button.tsx**
- Props: `variant` (brand/neutral/success/ghost/destructive), `size` (sm/md/lg), `loading`, `disabled`, `fullWidth`
- Loading state: 16px spinner replaces label, maintains width
- Follows component-patterns.md Button spec exactly

**Card.tsx**
- Props: `elevated` (boolean), `title`, `noPad`, `children`
- Login uses elevated variant (`shadow-lg`, `radius-lg`)

**Input.tsx**
- Props: `label`, `type`, `error`, `icon` (right side, for password toggle)
- Label: `.label` class (10px, uppercase, tracked, tertiary)
- Error: red text below input, linked via `aria-describedby`
- Focus: `outline: 2px solid var(--color-brand)`, `outline-offset: 2px`

**Logo.tsx**
- 40×40 rounded square, `var(--color-brand)` background, white Layers icon
- "ASOE" text: 20px, weight 700, `var(--color-text-primary)`
- Tagline: 12px, weight 400, `var(--color-text-tertiary)`

### Step 4: Auth Types & Roles

**types/auth.ts:**
```typescript
type Role = 'analyst' | 'manager' | 'admin' | 'viewer' | 'partner';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  roles: Role[];
  org: string;
  permissions: string[];
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  mfaRequired?: boolean;
  mfaToken?: string;
}
```

**lib/roles.ts:**
- Permission constants: `ORDERS_READ`, `ORDERS_APPROVE`, `ORDERS_OVERRIDE`, `RULES_WRITE`, `ADMIN_USERS`, etc.
- `hasRole(user, role)` / `hasPermission(user, permission)` helpers
- Role → permissions mapping

### Step 5: NextAuth.js Configuration

**lib/auth.ts:**
- `CredentialsProvider`: calls FastAPI `POST /api/auth/login`, returns user + tokens
- Custom SSO provider: initiates OIDC/SAML flow via FastAPI
- `jwt` callback: embeds roles/permissions in the JWT
- `session` callback: exposes roles/permissions to the client
- Token refresh: calls FastAPI `POST /api/auth/refresh` when access token expires

### Step 6: API Client

**lib/api.ts:**
- `apiClient` — fetch wrapper with `FASTAPI_URL` base, JSON headers, token injection
- `authApi.login(credentials)` → `POST /api/auth/login`
- `authApi.ssoInit(provider?)` → `POST /api/auth/sso/init`
- `authApi.refresh(refreshToken)` → `POST /api/auth/refresh`
- `authApi.me()` → `GET /api/auth/me`
- Mock responses for development (no FastAPI needed to see the UI)

### Step 7: Login Page

**src/app/login/page.tsx:**

This is the main deliverable. A `"use client"` page component:

1. Check session on mount — if authenticated, redirect to `/`
2. Render centered card with:
   - Logo component
   - SSO button (calls `signIn('sso')` or redirects via API)
   - Divider
   - Email + password form (client-side validation with Zod)
   - Sign In button (calls `signIn('credentials', { email, password })`)
   - Forgot password link
   - Error display region
3. Agent activity footer below card (pulse dot + stats)
4. Keyboard: Enter submits, Tab order correct, focus management on error

### Step 8: Middleware (Route Protection)

**src/middleware.ts:**
- Runs on every request server-side
- Public paths: `/login`, `/auth/callback`, `/api/auth/*`, `/_next/*`, `/favicon.ico`
- All other paths: check for valid session token, redirect to `/login` if missing
- Optional role-based route restrictions (e.g., `/admin/*` requires `admin` role)

### Step 9: SSO Callback Page

**src/app/auth/callback/page.tsx:**
- Receives auth code from IdP redirect
- Exchanges code for tokens via FastAPI
- Creates NextAuth session
- Redirects to `/`
- Shows loading state during exchange: "Completing sign-in..." with skeleton

---

## Design System Compliance Checklist

- [ ] Brand blue only on: SSO button (primary CTA) + logo mark — **2 elements**
- [ ] Sign In button uses `neutral` variant (gray text, white bg, bordered)
- [ ] "Forgot password?" is `var(--color-text-tertiary)`, NOT blue
- [ ] Error banner uses `var(--color-error-subtle)` bg + `var(--color-error)` text
- [ ] Card: `var(--shadow-lg)` + `var(--radius-lg)` (modal-level elevation)
- [ ] Input focus ring: `2px solid var(--color-brand)` with `outline-offset: 2px`
- [ ] All colors from CSS custom properties — zero hardcoded hex in components
- [ ] Typography: Inter via `next/font/google`, max 3 weights (400, 600, 700)
- [ ] Minimum 10px font size
- [ ] Icons: Lucide React only (Building2, Eye, EyeOff, Layers, Loader2)
- [ ] Agent activity footer: `.agent-active-dot` pulse animation
- [ ] `prefers-reduced-motion` respected (design-tokens.css handles this)
- [ ] WCAG AA contrast on all text elements
- [ ] Full keyboard navigability + visible focus rings
- [ ] No emoji anywhere

---

## File Creation Summary

| # | File | Purpose | New/Modified |
|---|------|---------|-------------|
| 1 | `package.json` | Next.js + dependencies | New |
| 2 | `next.config.ts` | Next.js configuration | New |
| 3 | `tsconfig.json` | TypeScript config | New |
| 4 | `tailwind.config.ts` | Tailwind + ASOE token extensions | New |
| 5 | `postcss.config.js` | PostCSS for Tailwind | New |
| 6 | `.env.local.example` | Environment variables template | New |
| 7 | `src/app/layout.tsx` | Root layout (fonts, globals) | New |
| 8 | `src/app/globals.css` | Tailwind directives + token import | New |
| 9 | `src/app/page.tsx` | Root redirect to dashboard | New |
| 10 | `src/app/login/page.tsx` | **Login screen** | New |
| 11 | `src/app/auth/callback/page.tsx` | SSO callback handler | New |
| 12 | `src/styles/design-tokens.css` | Design system tokens | Copied |
| 13 | `src/components/ui/Button.tsx` | Button component | New |
| 14 | `src/components/ui/Card.tsx` | Card component | New |
| 15 | `src/components/ui/Input.tsx` | Input component | New |
| 16 | `src/components/ui/Logo.tsx` | Logo component | New |
| 17 | `src/types/auth.ts` | Auth type definitions | New |
| 18 | `src/lib/roles.ts` | Roles + permissions | New |
| 19 | `src/lib/auth.ts` | NextAuth.js config | New |
| 20 | `src/lib/api.ts` | FastAPI client + mock stubs | New |
| 21 | `src/hooks/useAuth.ts` | Client auth hook | New |
| 22 | `src/middleware.ts` | Route protection middleware | New |

**Total: 22 files.** The login page itself is 1 component, supported by 4 UI primitives and auth infrastructure that will be reused across the entire app.
