import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authApi } from "./api";
import { buildAzureADProvider } from "@/auth/azure-ad";

/**
 * ASOE_AUTH_MODE env contract — Decision Q1 + Q8.
 *
 *   "seed"  → CredentialsProvider against the asoe2 /auth/login seed users.
 *             HS256, no Entra. Default for dev + Vercel mock previews.
 *   "entra" → Azure AD OAuth code flow against the preprod App
 *             Registration. Backend (PARITY-3b) JWKS-validates the
 *             resulting token; UI continues to read `user.roles` unchanged.
 *
 * IMPORTANT: both providers are ALWAYS mounted in `authOptions.providers`.
 * NextAuth freezes the provider list at process startup, so trying to
 * flip the mount based on a runtime env read causes a silent route /
 * callback mismatch. The env decides which provider is meaningfully
 * usable at sign-in time; the mount itself is unconditional.
 */
const AUTH_MODE = (process.env.ASOE_AUTH_MODE ?? "seed").toLowerCase();

export const ASOE_AUTH_MODE: "seed" | "entra" =
  AUTH_MODE === "entra" ? "entra" : "seed";

export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await authApi.login({
            email: credentials.email,
            password: credentials.password,
          });
          const user = res.user;
          if (!user) return null;
          // Backend's UserProfile (asoe2/api/schemas.py) only carries `sub`,
          // not `id`. NextAuth needs a non-empty `id` on the returned user
          // object or it will assign undefined and fail the session.
          return {
            id: user.sub,
            email: user.email,
            name: user.name,
            title: user.title,
            avatar_initials: user.avatar_initials,
            roles: user.roles,
            org: user.org,
            permissions: user.permissions,
            assigned_accounts: user.assigned_accounts,
            visible_tabs: user.visible_tabs,
            accessToken: res.access_token,
          };
        } catch {
          return null;
        }
      },
    }),
    buildAzureADProvider(),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token.roles = u.roles;
        token.org = u.org;
        token.permissions = u.permissions;
        token.accessToken = u.accessToken;
        token.title = u.title;
        token.avatar_initials = u.avatar_initials;
        token.assigned_accounts = u.assigned_accounts;
        token.visible_tabs = u.visible_tabs;
      }
      // When Azure AD is the provider, NextAuth surfaces the IdP-issued
      // access_token / id_token on `account` once at sign-in. Stash the
      // id_token as the upstream access token so the api client keeps
      // the same `Authorization: Bearer ...` contract — backend
      // PARITY-3b will JWKS-validate it.
      if (account?.provider === "azure-ad") {
        const a = account as unknown as Record<string, unknown>;
        if (typeof a.id_token === "string") {
          token.accessToken = a.id_token;
        }
        token.authMode = "entra";
      } else if (user) {
        token.authMode = "seed";
      } else if (!token.authMode) {
        // Token-refresh callback: `account` is unset on every renew,
        // and `user` is unset after the initial sign-in. Default to
        // "seed" so an old session predating PARITY-3a doesn't carry
        // an undefined authMode forward indefinitely.
        token.authMode = "seed";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.id = token.sub;
        u.roles = token.roles;
        u.org = token.org;
        u.permissions = token.permissions;
        u.title = token.title;
        u.avatar_initials = token.avatar_initials;
        u.assigned_accounts = token.assigned_accounts;
        u.visible_tabs = token.visible_tabs;
      }
      // Expose the backend-issued JWT on the session root so client code
      // (src/lib/api.ts::getAuthToken) can attach it as the
      // Authorization: Bearer header on outgoing fetch() calls. Without
      // this the api client sees no token, every authenticated call
      // goes unauthenticated, and asoe2 returns empty list / 404 detail.
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = token.accessToken;
      s.authMode = token.authMode ?? "seed";
      return session;
    },
  },
};
