# Belediyesinden API · production Docker image
FROM node:24-slim AS builder
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json nx.json tsconfig.base.json tsconfig.json ./
COPY apps/ libs/
RUN pnpm install --frozen-lockfile
RUN pnpm nx build api

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist/apps/api ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
