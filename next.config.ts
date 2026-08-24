import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * Build output location.
   *
   * Defaults to `.next`. Override with `NEXT_DIST_DIR` when the project lives
   * inside a synced folder — OneDrive turns build artefacts into cloud
   * placeholders mid-build, which surfaces as
   * `EINVAL: invalid argument, readlink '.next/app-build-manifest.json'`.
   * Pointing the output at an unsynced directory removes the whole class of
   * failure. See the README.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  images: {
    // The on-demand optimizer is bypassed deliberately. When a browser aborts
    // an image request mid-generation (lazy-load scroll-away, navigation,
    // prefetch cancellation), the optimizer's in-flight entry for that exact
    // url+width+quality wedges permanently — every later request for it hangs
    // until the server restarts, leaving cards stuck on blur placeholders.
    // Catalogue images are already optimized by scripts/ingest-product-images.ts
    // (WebP, 1600px cap, blur placeholders), so serving them as static files
    // costs a few tens of KB per image and removes the failure class entirely.
    unoptimized: true,
    formats: ['image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
