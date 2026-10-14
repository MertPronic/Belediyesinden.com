# Belediyesinden portal (Next.js standalone, merkezi) — monorepo root context.
# Container içinde build (Linux symlink tracing düzgün).

# ---- builder ----
FROM node:22-slim AS builder
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY apps apps
COPY libs libs
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ARG NEXT_PUBLIC_TENANT_BASE_DOMAIN=belediyesinden.com
ARG NEXT_PUBLIC_TENANT_PROTOCOL=
ARG NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
ARG NEXT_PUBLIC_KEYCLOAK_REALM=belediyesinden
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=portal
ARG NEXT_PUBLIC_PORTAL_URL=https://belediyesinden.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_TENANT_BASE_DOMAIN=$NEXT_PUBLIC_TENANT_BASE_DOMAIN \
    NEXT_PUBLIC_TENANT_PROTOCOL=$NEXT_PUBLIC_TENANT_PROTOCOL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
    NEXT_PUBLIC_PORTAL_URL=$NEXT_PUBLIC_PORTAL_URL
RUN pnpm install --frozen-lockfile
# Sürüm bilgisi (footer) — install'dan SONRA: her deploy'da değişir, bağımlılık
# katmanının cache'ini bozmasın.
ARG NEXT_PUBLIC_BUILD_SHA=
ARG NEXT_PUBLIC_BUILD_TIME=
ENV NEXT_PUBLIC_BUILD_SHA=$NEXT_PUBLIC_BUILD_SHA \
    NEXT_PUBLIC_BUILD_TIME=$NEXT_PUBLIC_BUILD_TIME
RUN npx nx build portal

# ---- runner (standalone lean) ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=4201
COPY --from=builder /repo/apps/portal/.next/standalone ./
COPY --from=builder /repo/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=builder /repo/apps/portal/public ./apps/portal/public
EXPOSE 4201
CMD ["node", "apps/portal/server.js"]
