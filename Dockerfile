# syntax=docker/dockerfile:1

FROM node:24-alpine AS base

# Required by some npm packages
RUN apk add --no-cache libc6-compat

WORKDIR /app

# ---------------------------------------------------
# Dependencies
# ---------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------
# Builder
# ---------------------------------------------------
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------------------------------------------------
# Production
# ---------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Standalone server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]

