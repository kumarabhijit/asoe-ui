# Production image for asoe-ui (Next.js 16 standalone).
#
# Used by the Azure Container Apps pre-prod deploy at
# asoe2/scripts/deploy-azure.sh. Vercel does not use this Dockerfile —
# Vercel builds via its own Next.js pipeline against package.json.
#
# Build-time NEXT_PUBLIC_* values are inlined into the JS bundle by
# `next build`. Pass them as --build-arg from the deploy script so the
# image is bound to a specific API origin and feature-flag set:
#
#   docker build \
#     --build-arg NEXT_PUBLIC_API_URL=https://asoepreprodapi.<env>.azurecontainerapps.io \
#     --build-arg NEXT_PUBLIC_USE_REAL_API=1 \
#     -t asoe-ui:<sha> .
#
# Server-only secrets (NEXTAUTH_SECRET, AUTH_TRUST_HOST, NEXTAUTH_URL)
# stay out of the image and are set as Container App env vars at run
# time so we can rotate without rebuilding.

# ---------------------------------------------------------------------------
# Stage 1: deps — install once, leverage layer cache.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 2: builder — produce the standalone bundle.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* must be present *during* `next build`; Next inlines them
# into the client bundle. Defaults are placeholders that fail loudly if
# the deploy script forgot to pass --build-arg.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_USE_REAL_API=0
ARG NEXT_PUBLIC_ASOE_ERP_VENDOR=SAP
ARG NEXT_PUBLIC_SHOW_PREVIEW_FEATURES=false
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_USE_REAL_API=${NEXT_PUBLIC_USE_REAL_API}
ENV NEXT_PUBLIC_ASOE_ERP_VENDOR=${NEXT_PUBLIC_ASOE_ERP_VENDOR}
ENV NEXT_PUBLIC_SHOW_PREVIEW_FEATURES=${NEXT_PUBLIC_SHOW_PREVIEW_FEATURES}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runner — minimal runtime, non-root, healthcheck.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Drop root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output bundles a minimal runtime; static + public copied
# alongside as Next expects.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# wget is the smallest healthcheck client present in node:22-alpine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/ || exit 1

# server.js is what `next build` emits in standalone mode.
CMD ["node", "server.js"]
