/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // md-to-pdf uses Puppeteer which spawns a real Chrome process.
    // Must run as plain Node — cannot be bundled by webpack.
    serverComponentsExternalPackages: ['md-to-pdf', 'puppeteer', 'puppeteer-core'],
  },
};

export default nextConfig;
