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
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co https://maps.googleapis.com https://places.googleapis.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  experimental: {
    // md-to-pdf uses Puppeteer which spawns a real Chrome process.
    // Must run as plain Node — cannot be bundled by webpack.
    serverComponentsExternalPackages: ['md-to-pdf', 'puppeteer', 'puppeteer-core', '@sparticuz/chromium-min'],
    optimizePackageImports: ['lucide-react', 'framer-motion', 'gsap'],
  },
};

export default nextConfig;
