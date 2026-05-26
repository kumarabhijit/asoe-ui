# Auth modes — seed vs Entra ID (PARITY-3a)

This document is the matrix Playwright fixtures and human operators
both reference when reasoning about authentication in this repo.

## Mode contract

`ASOE_AUTH_MODE` (server-only env, read in
`src/lib/auth.ts`) selects how a sign-in attempt resolves:

| Mode | Provider exercised at sign-in | Token shape | Use |
|---|---|---|---|
| `seed` (default) | `CredentialsProvider` → POST asoe2 `/auth/login` | HS256 JWT minted by asoe2 | Local dev, Vercel mock previews, CI |
| `entra` | `azure-ad` (Entra ID) → OAuth code flow | RS256 id_token issued by Entra, JWKS-validated by asoe2 (PARITY-3b) | Azure preprod, future GA |

`NEXT_PUBLIC_ASOE_AUTH_MODE` mirrors the value into the client bundle so
`PreprodIdentityBanner` can render correctly in the browser.

**Both providers are always mounted in `authOptions.providers`.**
NextAuth freezes the provider list at process startup; trying to flip
the mount based on a runtime env read causes a silent provider-id
mismatch on `/api/auth/callback/{id}`. The env decides which provider
is meaningfully usable; the mount itself is unconditional.

## Environment matrix

| Surface | `ASOE_AUTH_MODE` | Redirect URI on the App Registration | Notes |
|---|---|---|---|
| Local dev | `seed` (default) | `http://localhost:3000/api/auth/callback/azure-ad` (registered but unused) | Sign-in via seed users (any-password against asoe2). |
| Playwright local | `seed` | `http://localhost:3100/api/auth/callback/azure-ad` | Browser tests mint seed JWTs via `tests/browser/_helpers.ts`. |
| Vercel preview | `seed` (defaults) or `entra` (per-PR override) | `https://<vercel-preview-domain>/api/auth/callback/azure-ad` | Preview deploys default to mock data; switching `ASOE_AUTH_MODE=entra` on a preview lets us exercise the Entra path against the preprod App Registration. |
| Azure preprod | `entra` | `https://<asoe-ui-preprod>.azurecontainerapps.io/api/auth/callback/azure-ad` | The PARITY-3b backend JWKS-validates `aud`/`iss`/`kid`. |
| GA (future) | `entra` (multi-tenant) | (added per customer) | Single App Registration; new envs add URIs, not new registrations. |

## App Registration (Decision Q8)

One App Registration named `asoe-ui` with the following URIs
registered up front:

* `http://localhost:3000/api/auth/callback/azure-ad`
* `http://localhost:3100/api/auth/callback/azure-ad`
* `https://<vercel-preview-domain>/api/auth/callback/azure-ad`
* `https://<asoe-ui-preprod>.azurecontainerapps.io/api/auth/callback/azure-ad`

Per Decision Q1, the App Registration is `signInAudience: AzureADMyOrg`
(single-tenant) for preprod. The backend rejects cross-tenant `iss`
values regardless — see `tests/architectural/auth_dual_provider_scaffold.test.ts`
(UI side) and the asoe2 PARITY-3b JWKS regression test (backend side).

## Required env vars

### Seed mode

* `NEXTAUTH_SECRET` — NextAuth session signing key (persisted in
  Container App secrets so revision restarts don't invalidate sessions).
* `NEXT_PUBLIC_API_URL` — asoe2 backend URL.
* `NEXT_PUBLIC_USE_REAL_API=1` to hit the live backend (otherwise mocks).

### Entra mode

All of the above plus:

* `ASOE_AUTH_MODE=entra`
* `NEXT_PUBLIC_ASOE_AUTH_MODE=entra` (client-readable mirror)
* `ASOE_CLIENT_ID` — App Registration client id.
* `ASOE_CLIENT_SECRET` — App Registration client secret (Key Vault secretref).
* `ASOE_TENANT_ID` — Entra tenant id.

Backend (asoe2, PARITY-3b):

* `ASOE_CLIENT_ID` — same value, used for `aud` pinning.
* `ASOE_ISSUER_URL` — full Entra issuer URL, used for `iss` pinning.

## Middleware auth-failure branches

`src/middleware.ts` distinguishes three failure modes:

| Branch | Trigger | Redirect |
|---|---|---|
| token-missing | No session cookie | `/login` |
| token-invalid | Session cookie present but undecodable / expired | `/login?reason=session_expired` |
| no-role-for-tenant | Valid token, empty `roles` claim | `/403?from=<original-path>` |

The `/403` page does NOT force a sign-out — the audit trail of "which
valid identity hit the wall" is more useful intact.

## Playwright fixture strategy

* **seed mode** (current): `tests/browser/_helpers.ts::createSession`
  mints a seed JWT via the asoe2 `create_test_token` helper and sets
  the NextAuth session cookie directly. No real OAuth flow.
* **entra mode** (PARITY-3a follow-up): a fixture stubs the Entra
  authorize / token / userinfo endpoints with a fake JWKS so the
  OAuth code flow completes deterministically against a recorded
  Azure response. Both code paths converge on the same `useSession`
  shape — tests can assert `session.authMode` to verify the right
  branch ran.

When adding a new browser test that exercises an authenticated route,
default to seed mode unless you're specifically validating an Entra
behaviour (callback handling, refresh, group → role mapping).
