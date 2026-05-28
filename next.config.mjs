/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    // ERP vocabulary used for intent / sub_type display labels.
    // See src/config/erp-label-map.ts for the supported vendors and
    // src/hooks/useErpProfile.ts for the resolver.
    //
    // Resolution precedence (highest to lowest):
    //   1. Vercel Project Settings → Environment Variables (per-environment)
    //   2. .env.local (developer workstation)
    //   3. The default below
    //
    // Default is SAP so production deployments — and any preview build
    // that hasn't been individually configured — render with SAP-native
    // terminology rather than the GENERIC fallback.
    NEXT_PUBLIC_ASOE_ERP_VENDOR:
      process.env.NEXT_PUBLIC_ASOE_ERP_VENDOR ?? 'SAP',
    // ADR-041 P3e Phase 3 — expose Vercel deploy environment to
    // the client bundle so feature-flag helpers
    // (`src/lib/flags.ts`) can default the V2 cases row ON in
    // preview deploys while keeping production gated. Server-only
    // `VERCEL_ENV` is converted to a build-baked
    // `NEXT_PUBLIC_VERCEL_ENV` here. Falls through to undefined
    // on non-Vercel builds (local dev, CI).
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? '',
  },
  // S15a (PR #153) made /cases/[id]?record=<id> the canonical action
  // surface. ADR-041 P4 retires the duplicate `/exceptions` queue
  // route entirely — the route files (`page.tsx`, `error.tsx`,
  // `loading.tsx`, `CaseListPane.tsx`, `SavedViewsMenu.tsx`,
  // `searchParser.ts`) are deleted. `/cases` is the single
  // canonical queue surface. `permanent: true` because the route
  // no longer exists — bookmarks and notification URLs land on
  // `/cases` and browsers cache the redirect.
  async redirects() {
    return [
      { source: '/exceptions', destination: '/cases', permanent: true },
      { source: '/exceptions/:path*', destination: '/cases', permanent: true },
    ];
  },
};

export default nextConfig;
