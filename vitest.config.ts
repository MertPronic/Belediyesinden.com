import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * `libs/*-core` testleri `@belediyesinden/*` alias'larıyla birbirini import edebiliyor
 * (örn. `ilan-core` → `shared`). Bu alias'lar `tsconfig.base.json`'daki `paths` ile
 * birebir aynı tutulmalı — biri değişirse diğeri de güncellenir.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@belediyesinden/shared': fileURLToPath(new URL('./libs/shared/src/index.ts', import.meta.url)),
      '@belediyesinden/db': fileURLToPath(new URL('./libs/db/src/index.ts', import.meta.url)),
      '@belediyesinden/tenancy': fileURLToPath(new URL('./libs/tenancy/src/index.ts', import.meta.url)),
      '@belediyesinden/audit': fileURLToPath(new URL('./libs/audit/src/index.ts', import.meta.url)),
      '@belediyesinden/auth': fileURLToPath(new URL('./libs/auth/src/index.ts', import.meta.url)),
      '@belediyesinden/ui': fileURLToPath(new URL('./libs/ui/src/index.ts', import.meta.url)),
      '@belediyesinden/rule-engine': fileURLToPath(new URL('./libs/rule-engine/src/index.ts', import.meta.url)),
      '@belediyesinden/auction-core': fileURLToPath(new URL('./libs/auction-core/src/index.ts', import.meta.url)),
      '@belediyesinden/ilan-core': fileURLToPath(new URL('./libs/ilan-core/src/index.ts', import.meta.url)),
    },
  },
});
