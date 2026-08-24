import { NextResponse, type NextRequest } from 'next/server'
import {
  ANON_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySessionToken,
} from '@/server/auth/tokens'
import { ROLE_RANK } from '@/lib/domain/account'

/**
 * Edge middleware.
 *
 * Does exactly three things, and deliberately not a fourth:
 *
 *   1. Cheap route gating — bounce a request with no valid token away from a
 *      protected area before it costs a render.
 *   2. Issue a visitor id so anonymous search history and recently-viewed
 *      products can be attributed before sign-in.
 *   3. Set the Content-Security-Policy with a per-request nonce.
 *
 * What it does NOT do is authorise. The token here is unverified against the
 * session store — this runtime has no database access — so a revoked session
 * still carries a signature-valid token until it expires. Every protected page
 * and action re-checks through `requireUser` / `requireRole`, which consult
 * the store. Middleware is a fast path, not the security boundary.
 * See ARCHITECTURE.md §7.
 */

const PROTECTED_PREFIXES = ['/account', '/admin'] as const
const ADMIN_PREFIXES = ['/admin'] as const
/** Signed-in users have no reason to see these. */
const AUTH_PAGES = ['/login', '/register', '/forgot-password'] as const

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  const nonce = nonceFor(pathname)
  // upgrade-insecure-requests only makes sense when the site is actually
  // served over TLS. Over plain HTTP (local `next start`, a bare container
  // before its proxy) the browser upgrades subresource fetches to https and
  // they fail with ERR_SSL_PROTOCOL_ERROR — breaking link prefetch.
  const isHttps =
    request.nextUrl.protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https'
  const policy = contentSecurityPolicy(nonce, isHttps)

  /**
   * Next stamps its own hydration scripts with the nonce it finds in the
   * *request* Content-Security-Policy header. Setting the header only on the
   * response would leave those scripts unnonced, and the browser would block
   * every one of them.
   */
  const forwarded = new Headers(request.headers)
  if (nonce) {
    forwarded.set('Content-Security-Policy', policy)
    forwarded.set('x-nonce', nonce)
  }
  const pass = { request: { headers: forwarded } }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const claims = token ? await verifySessionToken(token) : null

  /* --- Route gating ------------------------------------------------------ */

  if (!claims && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = `?next=${encodeURIComponent(pathname + search)}`
    // A redirect carries no document, so it needs no nonce.
    return decorate(request, NextResponse.redirect(url), policy)
  }

  if (claims && matchesPrefix(pathname, ADMIN_PREFIXES)) {
    if (ROLE_RANK[claims.role] < ROLE_RANK.staff) {
      // 404 rather than 403: confirming the admin area exists is a hint.
      return decorate(request, NextResponse.rewrite(new URL('/404', request.url), pass), policy)
    }
  }

  if (claims && matchesPrefix(pathname, AUTH_PAGES)) {
    const url = request.nextUrl.clone()
    url.pathname = '/account'
    url.search = ''
    return decorate(request, NextResponse.redirect(url), policy)
  }

  return decorate(request, NextResponse.next(pass), policy)
}

/* -------------------------------------------------------------------------- */
/* Content-Security-Policy                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Routes that carry a per-request script nonce.
 *
 * A nonce and static prerendering are mutually exclusive: the nonce differs on
 * every request, while a prerendered page is one cached HTML file whose script
 * tags were stamped at build time. Sending a nonce policy to a prerendered
 * page blocks every script on it.
 *
 * So the list is not a guess about which pages happen to be dynamic today. It
 * is the set of routes that *cannot* be prerendered by construction — each one
 * either requires a session or renders from the query string, both of which
 * are dynamic APIs. A new page under any of these prefixes inherits the same
 * constraint, so the list does not rot as the app grows.
 *
 * Everything else — the homepage, the catalogue, category and product pages —
 * stays prerendered and keeps `unsafe-inline`, which Next's inline flight-data
 * scripts require. Those pages hold no credentials, run no privileged action
 * and render no user-submitted content, so the exposure is a fraction of the
 * cost of making 84 pages dynamic. The trade is recorded in ARCHITECTURE.md §7.
 */
const NONCE_PREFIXES = [
  '/account',
  '/admin',
  '/assistant',
  '/compare',
  '/login',
  '/register',
  '/reset-password',
  '/api',
] as const

const IS_DEV = process.env.NODE_ENV === 'development'

function contentSecurityPolicy(nonce: string | null, isHttps: boolean): string {
  const script = nonce
    ? [`'nonce-${nonce}'`, "'self'"]
    : ["'self'", "'unsafe-inline'"]

  // React Refresh compiles modules with eval. Development only — shipping it
  // to production would undo most of what the rest of this policy buys.
  if (IS_DEV) script.push("'unsafe-eval'")

  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    // Tailwind emits a static stylesheet, but Next injects inline <style> for
    // font fallback metrics and React inlines styles during streaming. There
    // is no nonce path for those, and style injection is not a script-execution
    // primitive.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://images.unsplash.com",
    `connect-src 'self'${IS_DEV ? ' ws: wss:' : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Nothing here is ever framed, and no plugin content is served.
    ...(isHttps ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

/**
 * Attaches the visitor cookie and the security headers that need a
 * per-response value. The static headers live in `next.config.ts`.
 */
function decorate(
  request: NextRequest,
  response: NextResponse,
  policy: string
): NextResponse {
  if (!request.cookies.get(ANON_COOKIE)) {
    response.cookies.set(
      ANON_COOKIE,
      `v_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
      {
        ...sessionCookieOptions(365 * 24 * 3600),
        // Readable by nothing in the browser; it is only ever used server-side.
        httpOnly: true,
      }
    )
  }

  response.headers.set('Content-Security-Policy', policy)
  return response
}

function nonceFor(pathname: string): string | null {
  if (!matchesPrefix(pathname, NONCE_PREFIXES)) return null
  // 128 bits, base64. `crypto` is the Web Crypto global — the Edge runtime has
  // no Node `crypto` module.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation. Running
     * middleware on every image request is pure latency.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml)$).*)',
  ],
}
