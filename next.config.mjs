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
};

export default nextConfig;
