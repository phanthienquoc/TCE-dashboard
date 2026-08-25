import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(appDir, '../..'),
  reactStrictMode: true,

  // Keep /api working even when the outer VPS ingress sends a request to the
  // frontend service. The production ingress still routes /api directly to
  // NestJS; this is a safe in-cluster fallback for stale/misrouted ingress.
  async rewrites() {
    const backend = process.env.TCE_API_INTERNAL_URL || 'http://tce-service:8210';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
