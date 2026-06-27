# Belediyesinden API (NestJS) — monorepo root context.
# NOT: dist/apps/api/main.js host'ta `pnpm nx build api` ile önceden üretilmiş
# olmalı (webpack-cli NxAppWebpackPlugin + tsc; lib'ler main.js'e inline).
# Bu image sadece production bağımlılıkları + pre-built dist'i paketler.

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile
COPY dist/apps/api ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
