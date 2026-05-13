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
  },
  // S15a (PR #153) made /cases/[id]?record=<id> the canonical action
  // surface. ADR-041 retires the duplicate `/exceptions` queue route —
  // `/cases` is the single canonical surface now. The `/exceptions/[id]`
  // route is already gone; this redirect catches bookmarks, runbook
  // deep-links, and notification URLs that still point at the old
  // queue. Permanent: false during the P2 → P3 transition; will flip
  // to permanent once /exceptions/page.tsx is deleted in P3.
  async redirects() {
    return [
      { source: '/exceptions', destination: '/cases', permanent: false },
      { source: '/exceptions/:path*', destination: '/cases', permanent: false },
    ];
  },
};

export default nextConfig;
