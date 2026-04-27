import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authApi } from "./api";

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
  ],
  callbacks: {
    async jwt({ token, user }) {
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
      (session as unknown as Record<string, unknown>).accessToken =
        token.accessToken;
      return session;
    },
  },
};
