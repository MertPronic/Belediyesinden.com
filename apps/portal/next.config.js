//@ts-check

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output -> Docker image'da sadece gerekli node_modules (küçük lean image).
  // Next.js 16 monorepo root'u pnpm-workspace lockfile'dan otomatik algılar.
  output: 'standalone',
};

module.exports = nextConfig;
