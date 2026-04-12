/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // md-to-pdf uses Puppeteer which spawns a real Chrome process.
    // Must run as plain Node — cannot be bundled by webpack.
    serverComponentsExternalPackages: ['md-to-pdf', 'puppeteer', 'puppeteer-core'],
    optimizePackageImports: ['lucide-react', 'framer-motion', 'gsap'],
  },
};

export default nextConfig;
