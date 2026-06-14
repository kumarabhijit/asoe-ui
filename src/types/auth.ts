/**
 * Auth types — aligned with asoe2/api/deps.py and api/schemas.py
 */

export type Role = "analyst" | "manager" | "admin" | "viewer" | "partner";

/**
 * The session user assembled by the NextAuth callbacks (`src/lib/auth.ts`).
 * It is NOT a 1:1 mirror of a single backend model — it merges three sources:
 *
 *   1. `UserProfile` (asoe2/api/schemas.py) — the `/me` + login response:
 *      sub, email, name, title, avatar_initials, roles, org, permissions,
 *      assigned_accounts, visible_tabs.
 *   2. JWT access-token claims (asoe2/api/deps.py::AuthenticatedUser),
 *      carried in the token rather than the profile body: `env`,
 *      `retailer_id`. Optional — only populated once the NextAuth `jwt` /
 *      `session` callbacks propagate them.
 *   3. NextAuth-only session fields: `id` (session id mapped from `sub`),
 *      `avatarUrl`, `auth_method`.
 *
 * Keep this in sync with the callback assignments in `src/lib/auth.ts`.
 */
export interface AuthUser {
  id: string; // (3) NextAuth session identifier (mapped from JWT sub)
  sub: string; // (1) JWT subject claim — backend UserProfile.sub
  email: string; // (1)
  name: string; // (1)
  title?: string; // (1) Job title (e.g., "CS Manager")
  avatar_initials?: string; // (1) For avatar display (e.g., "SC")
  avatarUrl?: string; // (3) NextAuth session only
  roles: Role[]; // (1)
  org: string; // (1) tenant_id from JWT org claim
  permissions: string[]; // (1)
  assigned_accounts: string[]; // (1) Customer scope — empty = all customers
  visible_tabs: string[]; // (1) Computed from permissions by backend
  env?: "sandbox" | "production"; // (2) JWT claim
  auth_method?: "password+mfa" | "sso" | "switch"; // (3) NextAuth session only
  retailer_id?: string; // (2) JWT claim — partner-role scoping
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Mirrors AuthTokenResponse in asoe2/api/schemas.py */
export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user?: AuthUser;
  mfa_required: boolean;
  mfa_token?: string;
}

export interface MFAVerifyRequest {
  mfa_token: string;
  code: string;
}

export interface SSOInitResponse {
  redirect_url: string;
}
