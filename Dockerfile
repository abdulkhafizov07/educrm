# syntax=docker/dockerfile:1

FROM node:24-alpine AS base

# Required by some npm packages
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ---------------------------------------------------
# Dependencies (full install, shared by all stages)
# ---------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------
# Builder (Next.js standalone build)
# ---------------------------------------------------
FROM base AS builder

WORKDIR /app

# Baked into the client bundle at build time (NEXT_PUBLIC_*) and into the
# rewrite manifest (BACKEND_URL). Override via docker-compose build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG BACKEND_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------------------------------------------------
# Web (Next.js frontend, port 3000)
# ---------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Re-applied at runtime so the server-side rewrites can be overridden without
# rebuilding (the rewrite manifest still falls back to the build-time value).
ARG BACKEND_URL=http://localhost:4000
ENV BACKEND_URL=$BACKEND_URL

# Create non-root user
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Standalone server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

# ---------------------------------------------------
# API (Express backend, port 4000)
# ---------------------------------------------------
FROM base AS api

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server

# Writable uploads dir owned by the runtime user (also a volume mount point)
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs \
  && mkdir -p uploads/avatars \
  && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

CMD ["node", "server/index.js"]
