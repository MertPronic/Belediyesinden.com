# Belediyesinden tenant-web (Next.js standalone) — monorepo root context.
# Container içinde build (Linux symlink tracing düzgün; Next.js webpack-cli spawn
# sorunu yok). NEXT_PUBLIC_* build arg'leri browser'a inline.

# ---- builder ----
FROM node:22-slim AS builder
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps apps
COPY libs libs
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3000/ws
ARG NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
ARG NEXT_PUBLIC_KEYCLOAK_REALM=belediyesinden
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=tenant-web
ARG NEXT_PUBLIC_TENANT_SLUG=talas
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
    NEXT_PUBLIC_TENANT_SLUG=$NEXT_PUBLIC_TENANT_SLUG
RUN pnpm install --frozen-lockfile
RUN npx nx build tenant-web

# ---- runner (standalone lean) ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=4200
COPY --from=builder /repo/apps/tenant-web/.next/standalone ./
COPY --from=builder /repo/apps/tenant-web/.next/static ./apps/tenant-web/.next/static
COPY --from=builder /repo/apps/tenant-web/public ./apps/tenant-web/public
EXPOSE 4200
CMD ["node", "apps/tenant-web/server.js"]
