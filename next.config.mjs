/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fails the production build on a type error instead of shipping it — the whole
  // point of strict TypeScript is undermined if the build tolerates errors.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverActions: {
      // Explicit allowed origins for server actions, set from env at deploy time.
      // Left empty here deliberately — filled in per-environment, never wildcarded.
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') ?? undefined,
    },
  },
};

export default nextConfig;
