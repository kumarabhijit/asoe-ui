# UX/UI Review — Global Chrome, Left Navigation & Entry/Auth Pages

This slice covers the persistent application chrome (left navigation pane / `Sidebar`, top `NavBar`), the root layout and provider tree, and the entry/auth surfaces (`/`, `/home`, `/login`, `/403`, `/auth/callback`). Overall the chrome is mature and accessibility-conscious — anchor-based tab nav, dialog semantics on the Sidebar, a skip-to-main link, and consistent icon+text status patterns are all present. The weakest area is the auth/entry flow, where the `/login` and `/auth/callback` pages carry hardcoded demo data and credentials that read as production-fragile, and a real skip-link-target bug exists on `/home`.

---

### Left Navigation Pane (`src/components/ui/Sidebar.tsx`)

**Context**
- Card/Pane Name: Left Navigation Pane (implemented as a right-sliding 480px intervention/detail dialog — see note below)
- Primary Goal: Render the Layer-2 exception-detail surface as a focus-trapped modal panel with header (title, optional expand-to-full-page, close) and scrollable content.
- Target Audience: O2C exception operators drilling into a case from a master/detail list.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- Naming/role mismatch vs. this slice's brief: the file is named `Sidebar` and the header comment (`Sidebar.tsx:1-3`) describes a "480px intervention panel, slides right." It is functionally a **right-hand detail dialog**, not a left navigation pane. The actual left-edge navigation lives in `NavBar` tabs. Worth confirming the brief's "left navigation" expectation maps to NavBar, not this component. No code bug, but a labeling/IA clarity concern.
- Focus is moved into the panel on open (`Sidebar.tsx:32-34`) and ESC closes it (`Sidebar.tsx:25-30`), but there is **no focus trap** — Tab can leave the `role="dialog" aria-modal="true"` panel and reach background content behind the overlay. `aria-modal="true"` (`Sidebar.tsx:50`) asserts a trap that isn't enforced for keyboard users. (Screen readers that honor `aria-modal` will hide the background, but Tab order is not constrained.)
- Focus is not restored to the triggering element on close. After ESC/close, focus is lost to `<body>`, which is disorienting for keyboard users returning to the list. (`Sidebar.tsx:23-34` — no stored `previousActiveElement`.)
- When `title` is undefined, the entire header — including the close button — is not rendered (`Sidebar.tsx:60-85`). A titleless panel then has **no visible close affordance**; the user must know to press ESC or click the overlay. Edge case worth guarding.

**Usability Issues**
- The overlay uses `bg-black/15` (`Sidebar.tsx:42`) — a very light scrim. Needs visual/manual verification, but 15% dim may not sufficiently signal modality or separate the panel from busy background content.
- Expand and close buttons (`Sidebar.tsx:67-82`) are icon-only at `p-4`; the resulting hit target is well under the 44px WCAG 2.5.5 / pointer-target guidance. They have `aria-label`s (good), but touch/low-precision users get small targets.
- Good: ESC handling, `role="dialog"`, `aria-modal`, `aria-label` fallback to "Detail panel", and transform-based slide animation tied to design-token durations.

**Simplicity Opportunities**
- The two header buttons duplicate styling strings verbatim (`Sidebar.tsx:69` and `78`). Minor; an internal `IconButton` would DRY this, but not load-bearing.

**Top 3 Actionable Recommendations**
1. Add a focus trap (cycle Tab/Shift+Tab within the panel) to make `aria-modal="true"` truthful, and restore focus to the opener on close.
2. Ensure a close affordance always exists even when `title` is absent (render a minimal header or a floating close button).
3. Clarify naming/IA: rename to `DetailPanel`/`InterventionPanel` or document that the "left navigation" is NavBar, so the component's role isn't misread.

---

### NavBar (`src/components/ui/NavBar.tsx`)

**Context**
- Card/Pane Name: Top Navigation Bar (global chrome)
- Primary Goal: Persistent 56px glass bar — logo→/home, role-filtered tab links, live agent-count badge, theme toggle, and user menu with sign-out.
- Target Audience: All authenticated operators/analysts/managers across every route.

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- The agent-count badge label is potentially misleading depending on what callers pass. The component renders `{agentCount} Agent{...} Live` (`NavBar.tsx:111-115`). On `/home` the prop is wired to `health?.allowed_intents?.length` (`home/page.tsx:157`) — i.e. the number of **allowed intents**, not live agents. If that's the intended proxy it should be relabeled; as written the chrome asserts a count of "live agents" that is actually an enum cardinality. Flag for product/data correctness.
- Active-tab logic compares `activeTab === tab.id` (`NavBar.tsx:77`); `activeTab` is passed as the literal `"home"` from `home/page.tsx:153`. This is fine as a page-supplied current-route marker (not a hardcoded enum in the Guardrail-#2 sense), but it is brittle — any tab-id rename in `config/nav-tabs` must be mirrored in each page's `activeTab` string. Consider deriving from `usePathname()`.

**Usability Issues**
- The user-menu trigger is a 32×32 initials button (`NavBar.tsx:123-128`) — below the 44px target guidance, though it has `aria-label="User menu"`.
- Strong accessibility execution otherwise: tab links are real `<Link>` anchors with `aria-current="page"` (`NavBar.tsx:83`), visible `focus-visible:ring-2 focus-visible:ring-brand-ring` (`NavBar.tsx:89`), and the inline comments (`NavBar.tsx:90-97`) document a deliberate contrast choice (text-secondary 8.46:1 vs. text-tertiary 3.92:1). Credit this.
- The agent badge uses a pulse dot **plus** text ("N Agents Live"), satisfying WCAG 1.4.1 (not color/motion alone). Good.
- The active-tab underline (`NavBar.tsx:101-103`) reinforces the font-weight delta, so active state isn't weight-only. Good.

**Simplicity Opportunities**
- `onTabChange` is an optional analytics-only side-effect hook with a documented "do not also router.push" contract (`NavBar.tsx:66-74`, `82`). Well-scoped; no change needed — calling out as a clean pattern.

**Top 3 Actionable Recommendations**
1. Resolve the agent-count semantics: either feed a true live-agent count or relabel the badge so the chrome doesn't misstate a SOX-relevant operational signal.
2. Derive `activeTab` from the current pathname instead of per-page string literals to remove rename drift.
3. Bump the user-menu and (cross-ref) Sidebar icon-button hit areas toward 44px for touch/low-precision users.

---

### Root Layout (`src/app/layout.tsx`)

**Context**
- Card/Pane Name: Root HTML shell
- Primary Goal: Set metadata, mount skip-to-main link, wrap all routes in `Providers`, render the pre-prod identity banner.
- Target Audience: Every user (infrastructure-level).

**Overall Verdict:** Pass

**Correctness Issues**
- None blocking. `suppressHydrationWarning` on `<html>` (`layout.tsx:17`) is correct given `next-themes` writes the class attribute pre-hydration.
- Minor: the skip link target `#main-content` (`layout.tsx:19`) is reliable only if every route renders that id. It does on most pages, but on `/home` the target is an empty placeholder div placed before content (see Home review) — a real plumbing gap surfaced by this otherwise-correct layout.

**Usability Issues**
- Skip-to-main link is the first focusable element and is visually hidden until focus (per `globals.css .skip-to-main`). Correct WCAG 2.4.1 pattern.

**Simplicity Opportunities**
- None. The file is appropriately minimal.

**Top 3 Actionable Recommendations**
1. Keep as-is. Optionally add an architectural assertion that the skip target wraps actual content (not an empty node) — see Home finding.

---

### Providers (`src/app/providers.tsx`)

**Context**
- Card/Pane Name: Client provider tree
- Primary Goal: Compose ThemeProvider → SessionProvider → StatusAnnouncer → ToastProvider so theme, auth session, the single aria-live region, and toasts are available on every route.
- Target Audience: Infrastructure-level.

**Overall Verdict:** Pass

**Correctness Issues**
- Provider ordering is sound: theme/session outermost, StatusAnnouncer above ToastProvider so the canonical `aria-live` region exists on every route including `/login` and error pages (documented at `providers.tsx:9-18`). `defaultTheme="system" enableSystem disableTransitionOnChange` (`providers.tsx:21`) matches the CLAUDE.md system-preference requirement (no manual toggle mandated — though NavBar does add an optional `ThemeToggle`, which is allowed).

**Usability Issues**
- None at this layer.

**Simplicity Opportunities**
- None. Clean, well-commented, single responsibility.

**Top 3 Actionable Recommendations**
1. No changes. Reference-quality provider composition.

---

### Root Page (`src/app/page.tsx`)

**Context**
- Card/Pane Name: Root route redirector
- Primary Goal: Server-redirect `/` → `/home` (operational landing); `/dashboard` reserved for analytics.
- Target Audience: Any authenticated user hitting the bare domain.

**Overall Verdict:** Pass

**Correctness Issues**
- `redirect("/home")` (`page.tsx:7`) is correct and the comment notes middleware guards auth before this point. No `callbackUrl` is preserved here, but as the root entry that's expected — deep links route through middleware → `/login?callbackUrl=...`, not through this file.

**Usability Issues / Simplicity Opportunities**
- None. Three lines, single responsibility.

**Top 3 Actionable Recommendations**
1. No changes.

---

### Home Page (`src/app/home/page.tsx`)

**Context**
- Card/Pane Name: Home — operational landing surface
- Primary Goal: Pure projector of `useCases()` + `slaSnapshot()` — four KPI tiles (SLA breached / at risk / awaiting review / awaiting buyer) and an SLA-sorted "Top of queue" list, with WS-driven refresh.
- Target Audience: O2C operators triaging "what needs me now."

**Overall Verdict:** Needs Minor Tweaks

**Correctness Issues**
- **Skip-link target is an empty placeholder placed before the content.** `<div id="main-content" />` (`home/page.tsx:191`) is self-closing and sits *between* the page header and the KPI tiles — it wraps nothing. Activating "Skip to main content" lands focus on an empty zero-height div, not on the KPI/queue region. Every other page in the repo (`cases`, `dashboard`, `settings`, `403`) wraps real content in `<main id="main-content">`. This is the genuine bug of the slice. The architectural lock at `tests/architectural/ux_clutter_invariants.test.ts:143-153` only greps for the id's presence, so it passes despite the broken UX. (file:line — `home/page.tsx:191`)
- The page has no `<main>` landmark at all — content sits in bare `<div>`s (`home/page.tsx:150`, `194`, `228`). Other pages use `<main>`; this breaks landmark consistency for AT users.
- `agentCount={health?.allowed_intents?.length || 0}` (`home/page.tsx:157`) feeds intent-count into a badge labeled "Agents Live" — see NavBar finding; the mislabel originates here.
- Origin badge keys on `case_.origin as Origin` (`home/page.tsx:278`) with a `?? ORIGIN_ICON.default` fallback. The fallback is on the **icon map**, which is acceptable (visual mapping with default, Guardrail-#1-compliant), not a partial-truth data fallback. Fine.

**Usability Issues**
- Solid empty/loading/error triad on the queue: `role="status"` loading (`home/page.tsx:249-253`), `role="alert"` error (`254-256`), and a positive empty state with `CheckCircle2` icon+text (`257-262`). Credit this — icon+text, not color alone.
- KPI tiles use semantic tint tokens (`var(--color-error)`, `--color-warning`, `--color-cat-blue/teal`) (`home/page.tsx:201-222`) with text labels and subtitles, so they don't rely on color alone. Good.
- SLA band badges combine a `Clock` icon, `sla.label` text, and an `aria-label="SLA: ..."` (`home/page.tsx:284-291`) — WCAG 1.4.1 compliant.
- Responsive truncation: order ref and status are `hidden ... sm:block` (`home/page.tsx:292-297`), so on narrow viewports a queue row collapses to two badges + chevron with **no order reference visible** — the row becomes hard to identify. The `aria-label="Open case {orderRef}"` (`275`) preserves it for AT, but sighted mobile users lose the identifier. Needs visual verification.
- The header "Refresh" button (`home/page.tsx:182-185`) coexists with WS-driven auto-refresh (`101-107`). Per CLAUDE.md Guardrail #4 ("no static screens requiring manual refresh"), a manual refresh is acceptable as a supplement here since auto-refresh is wired, but ensure it doesn't imply the screen is otherwise static.

**Simplicity Opportunities**
- `urgent` is capped at 8 (`home/page.tsx:147`) but there's no "+N more" affordance beyond the "All cases" link in the section header (`241-246`). Fine, but a count of hidden urgent cases would aid triage.
- The `userInitials`/`userTitle` derivation uses `as { ... }` casts (`home/page.tsx:111-113`) to read fields off `user`; if these belong on the auth contract they should be typed there rather than cast at the call site.

**Top 3 Actionable Recommendations**
1. Fix the skip target: wrap the actual content in `<main id="main-content">` (KPI tiles + queue) and remove the empty placeholder div at `home/page.tsx:191`. Strengthen the architectural lock to assert the id is on a content-bearing element.
2. Resolve the "Agents Live" mislabel sourced at `home/page.tsx:157`.
3. Ensure the order reference stays visible (or is otherwise surfaced) on narrow viewports so queue rows remain identifiable to sighted mobile users.

---

### Login Page (`src/app/login/page.tsx`)

**Context**
- Card/Pane Name: Sign-in card (two-step email → password, with SSO-domain detection)
- Primary Goal: Authenticate operators via credentials; detect SSO domains and (in demo) fall back to password.
- Target Audience: All operators at session start.

**Overall Verdict:** Needs Rework

**Correctness Issues**
- **Hardcoded SSO domain allow-list in UI:** `const SSO_DOMAINS = ["acme.com", "walmart.com", "kroger.com"]` (`login/page.tsx:27`). Tenant/SSO routing is policy that should come from config/backend, not a literal array in a page component. Adding a tenant requires a UI code change — exactly the coupling the project's Guardrail #2 philosophy resists (and a maintenance/security concern for an auth surface).
- **Demo behavior shipped in the auth path:** the SSO branch sleeps 2s then sets an error telling the user "SSO is not configured in this demo. Enter any password to continue." (`login/page.tsx:46-48`), and `handleNext` uses artificial `setTimeout` delays (`42`, `46`). This is fragile for production and leaks demo language into a SOX-relevant entry point.
- `callbackUrl` defaults to `/` (`login/page.tsx:17`) and is forwarded to `signIn` (`68`); on success it navigates via `window.location.href = result.url` (`72-73`). Functional, but a full page nav (vs. router) loses SPA state — acceptable post-auth, noting for completeness.
- The "Remember me" switch (`login/page.tsx:151-167`) and the Forgot/Help links (`174-184`, `230-235`) are **non-functional** — `rememberMe` is never read by `signIn`, and the help buttons have no handlers. These present affordances that do nothing.

**Usability Issues**
- The email step uses `role="switch"` with `aria-checked` for Remember me (`login/page.tsx:153-154`) — correct switch semantics. But the switch lacks an associated label element (the adjacent `<span>` at `168-170` is not programmatically tied via `aria-labelledby`/`id`), so AT may announce the switch without its name. Needs verification.
- The password-step email "chip" uses `bg-black/[0.03]` (`login/page.tsx:194`) — a near-invisible raw black alpha rather than a surface token; very low contrast container. Needs visual verification but reads as a token-bypass.
- Good: error banner is `role="alert" aria-live="polite"` with `AlertCircle` icon + text (`login/page.tsx:111-119`); password show/hide toggle has dynamic `aria-label` (`213`); inputs have proper `autoComplete` and `autoFocus`.
- The SSO redirect state (`login/page.tsx:240-250`) shows a pulse dot + "Redirecting..." text — icon+text, accessible.
- The footer stats "12 agents active" and "847 exceptions resolved today" (`login/page.tsx:272-280`) are **hardcoded fabricated numbers** on the public login screen — misleading and stale-by-design.

**Simplicity Opportunities**
- The `@keyframes spin` block (`login/page.tsx:283-288`) is defined but no spinner using it appears in this file (the brand uses `agent-active-dot`). Dead CSS — removable.
- The two help-link buttons are generated from an array (`login/page.tsx:175`) but lead nowhere; if they aren't wired, removing them reduces noise on the primary CTA path.

**Top 3 Actionable Recommendations**
1. Remove demo artifacts from the auth path: the hardcoded `SSO_DOMAINS` list, the "enter any password" demo message, artificial timeouts, and the fabricated footer counts. Source SSO routing from config/backend.
2. Either wire or remove the non-functional Remember-me switch and Forgot/Help links so every affordance does something.
3. Associate the Remember-me switch with its visible label, and replace `bg-black/[0.03]` and the dead `@keyframes spin` with token-based styling / deletion.

---

### 403 / No-Tenant-Access Page (`src/app/403/page.tsx`)

**Context**
- Card/Pane Name: No-access-to-tenant landing
- Primary Goal: Explain that a valid identity has no ASOE role for the active tenant; show the requested path; offer Go-home and Sign-out — deliberately preserving the identity for audit (`403/page.tsx:5-12`).
- Target Audience: Authenticated users blocked by RBAC; tenant admins triaging access tickets.

**Overall Verdict:** Pass

**Correctness Issues**
- `<main id="main-content">` correctly wraps content (`403/page.tsx:33-36`) — the right pattern that `/home` is missing.
- `from` defaults to `/` and is shown in a `<code>` for ticket pasting (`403/page.tsx:25`, `47-49`) — matches the documented intent.
- Email is read via a double-cast `(session?.user as unknown as { email?: string })` with an "your account" fallback (`403/page.tsx:28-30`). The cast is a typing smell (the auth contract should expose `email`), but the fallback is a sensible empty-state, not a partial-truth data hide.

**Usability Issues**
- `ShieldAlert` icon + heading "No access to this tenant" + explanatory body (`403/page.tsx:38-46`) — clear, icon+text, no color-only signaling. Uses `text-warning` for the icon; the page reads as an access-state explanation rather than a hard error, which is appropriate.
- Two clear actions with sensible variants: neutral "Go home", ghost "Sign out" (`403/page.tsx:50-60`). Good hierarchy.

**Simplicity Opportunities**
- None significant. Concise and purpose-built.

**Top 3 Actionable Recommendations**
1. Type `email` on the auth/session contract to drop the `as unknown as` double cast (`403/page.tsx:28-30`).
2. Optionally surface a "Request access" affordance (mailto/admin link) so the user has an action beyond going home or signing out.
3. No further changes — this is the cleanest auth-state page in the slice.

---

### Auth Callback Page (`src/app/auth/callback/page.tsx`)

**Context**
- Card/Pane Name: SSO/OAuth callback handler
- Primary Goal: Read `code`/`error` from the OAuth redirect; on error route to `/login?error=...`, on code complete sign-in, else fall back to `/login`.
- Target Audience: Transient — users mid-SSO-redirect.

**Overall Verdict:** Needs Rework

**Correctness Issues**
- **Hardcoded credentials in the auth callback:** on receiving any `code`, the page calls `signIn("credentials", { email: "jane@acme.com", password: "password", ... })` (`auth/callback/page.tsx:21-27`). This ignores the actual OAuth `code` entirely and logs everyone in as a fixed demo identity — a correctness and security defect for a SOX-relevant system. The `code` is read (`12`) but never exchanged.
- `callbackUrl: "/"` (`auth/callback/page.tsx:26`) discards any originally-requested deep link that should have been threaded through the OAuth `state`/callbackUrl — post-login the user always lands at root.
- The `useEffect` dependency array omits `code`'s sibling guard ordering but includes `code, error, router` (`auth/callback/page.tsx:31`) — functionally fine, but the effect can re-fire if params change; acceptable for a one-shot callback.

**Usability Issues**
- Loading affordance is correct: `Loader2` spinner + "Completing sign-in..." text (`auth/callback/page.tsx:43-45`), with a `Suspense` fallback for the searchParams read (`64-72`). Icon+text, accessible enough for a transient state — though the spinner has no `aria-label`/`role="status"`, so AT may announce nothing during the wait.
- Uses inline `style` with design tokens (`auth/callback/page.tsx:35-46`) rather than Tailwind — allowed per CLAUDE.md (tokens via CSS vars), and tokens are used correctly (`var(--space-8)`, `var(--color-text-tertiary)`).

**Simplicity Opportunities**
- The `@keyframes spin` is inlined here (`auth/callback/page.tsx:73-78`) and again in `login/page.tsx`; a shared utility/token animation would remove the duplication (and login's copy is unused).

**Top 3 Actionable Recommendations**
1. Replace the hardcoded `jane@acme.com` / `password` sign-in with a real `code`-exchange against the IdP/backend before this ships anywhere non-demo — this is the highest-severity item in the slice.
2. Thread the original destination through `state`/`callbackUrl` instead of hardcoding `/`.
3. Add `role="status"` + an accessible name to the spinner so the in-progress state is announced.

---
