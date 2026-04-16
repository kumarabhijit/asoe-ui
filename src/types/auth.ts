/**
 * Auth types — aligned with asoe2/api/deps.py and api/schemas.py
 */

export type Role = "analyst" | "manager" | "admin" | "viewer" | "partner";

/** Mirrors UserProfile in asoe2/api/schemas.py */
export interface AuthUser {
  id: string; // NextAuth session identifier (mapped from JWT sub)
  sub: string; // JWT subject claim — backend UserProfile.sub
  email: string;
  name: string;
  avatarUrl?: string;
  roles: Role[];
  org: string; // tenant_id from JWT org claim
  permissions: string[];
  env?: "sandbox" | "production";
  auth_method?: "password+mfa" | "sso";
  retailer_id?: string; // partner-role scoping
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

// ---------------------------------------------------------------------------
// Persona system — mirrors asoe2/api/schemas.py Persona models
// ---------------------------------------------------------------------------

/** 8 permission flags per persona. */
export interface PersonaPermissions {
  can_run_agents: boolean;
  can_run_all: boolean;
  can_edit_rules: boolean;
  can_edit_autonomy: boolean;
  can_view_billing: boolean;
  can_configure_personas: boolean;
  can_upload_data: boolean;
  can_export_audit: boolean;
}

/** A predefined user persona with role, permissions, tab visibility, and customer scope. */
export interface Persona {
  id: string;
  name: string;
  title: string;
  email: string;
  role: Role;
  avatar_initials: string;
  permissions: PersonaPermissions;
  tabs: string[];
  customer_scope: "all" | "assigned" | "region";
  assigned_customers: string[];
}

/** Response from GET /api/v1/personas */
export interface PersonaListResponse {
  data: Persona[];
}
