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
          return {
            id: res.user.id,
            email: res.user.email,
            name: res.user.name,
            roles: res.user.roles,
            org: res.user.org,
            permissions: res.user.permissions,
            accessToken: res.accessToken,
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
      }
      return session;
    },
  },
};
