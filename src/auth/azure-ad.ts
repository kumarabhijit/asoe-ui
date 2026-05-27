/**
 * Azure AD (Entra ID) NextAuth provider — PARITY-3a.
 *
 * Mounted alongside the seed CredentialsProvider in
 * src/lib/auth.ts::authOptions.providers. NextAuth freezes the
 * provider list at startup, so this provider is ALWAYS mounted
 * — what changes between modes is whether the runtime env (and
 * NextAuth callback selection) actually allows the OAuth flow
 * to complete.
 *
 * Build-time inputs (Container App env / Vercel preview env):
 *   ASOE_CLIENT_ID      — Azure App Registration client id (one
 *                          App Registration, multiple redirect URIs
 *                          per Decision Q8).
 *   ASOE_CLIENT_SECRET  — App Registration client secret.
 *   ASOE_TENANT_ID      — Entra tenant id (single-tenant
 *                          AzureADMyOrg per Decision Q1; the
 *                          backend pins iss against the matching
 *                          ASOE_ISSUER_URL).
 *
 * In seed mode the env vars may be unset — the provider still
 * mounts (so the providers list shape is stable) but is
 * effectively unusable without the OAuth credentials.
 */

import AzureADProvider from "next-auth/providers/azure-ad";

export function buildAzureADProvider() {
  return AzureADProvider({
    clientId: process.env.ASOE_CLIENT_ID ?? "",
    clientSecret: process.env.ASOE_CLIENT_SECRET ?? "",
    tenantId: process.env.ASOE_TENANT_ID ?? "common",
    authorization: {
      params: {
        scope: "openid profile email offline_access",
      },
    },
  });
}
