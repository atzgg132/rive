# syntax=docker/dockerfile:1.7
FROM --platform=$BUILDPLATFORM node:24-alpine AS build-dependencies
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM --platform=$BUILDPLATFORM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
ARG DEPLOYMENT_VERSION=local
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV SESSION_SECRET=build-only-session-secret
ENV CALENDAR_ENCRYPTION_KEY=build-only-calendar-key
ENV CRON_SECRET=build-only-cron-secret
ENV APP_URL=http://127.0.0.1:3000
COPY --from=build-dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime-dependencies
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:24-alpine AS migrator
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/aws-rds-global-bundle.pem
ADD --chmod=0444 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/aws-rds-global-bundle.pem
COPY --from=runtime-dependencies /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/aws-rds-global-bundle.pem
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
ADD --chmod=0444 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/certs/aws-rds-global-bundle.pem
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=runtime-dependencies --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=runtime-dependencies --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img
COPY --from=runtime-dependencies --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=runtime-dependencies --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
