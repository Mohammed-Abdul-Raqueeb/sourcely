import { notFound } from 'next/navigation'

/**
 * A real route at /404.
 *
 * Two security paths point here on purpose: middleware rewrites an
 * unauthorised /admin request to this path, and `requireRole` redirects to it.
 * Before this route existed, both targeted a URL with no page behind it —
 * a full navigation got Next's unstyled fallback, and a client-side (RSC)
 * navigation got no usable payload at all, which is exactly the blank white
 * screen customers reported when opening /admin.
 *
 * Calling `notFound()` renders the styled app/not-found.tsx with a genuine
 * 404 status, for both navigation modes.
 */
export default function NotFoundRoute(): never {
  notFound()
}
