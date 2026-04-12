/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
  experimental: {
    // md-to-pdf uses Puppeteer which spawns a real Chrome process.
    // Must run as plain Node — cannot be bundled by webpack.
    serverComponentsExternalPackages: ['md-to-pdf', 'puppeteer', 'puppeteer-core'],
    optimizePackageImports: ['lucide-react', 'framer-motion', 'gsap'],
  },
};

export default nextConfig;
