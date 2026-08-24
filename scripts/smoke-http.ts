/**
 * End-to-end checks over real HTTP against a running server.
 *
 * The other smoke suites call the services directly, which is fast and covers
 * logic but cannot see anything the framework does: response headers, the CSP
 * nonce, route guards in middleware, cache directives, content types, download
 * dispositions. Those only exist once a request has gone through Next.
 *
 *   npm run build && npm start
 *   npm run smoke:http
 *
 * Sessions are minted with `scripts/mint-session.ts` and passed in:
 *
 *   SMOKE_CUSTOMER_COOKIE=... SMOKE_ADMIN_COOKIE=... npm run smoke:http
 *
 * Signed-in checks are skipped, not failed, when no cookie is supplied — so
 * the suite is still useful without one.
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3111'
const CUSTOMER = process.env.SMOKE_CUSTOMER_COOKIE ?? ''
const ADMIN = process.env.SMOKE_ADMIN_COOKIE ?? ''

let passed = 0
let failed = 0
let skipped = 0

function section(title: string): void {
  console.log(`\n${'─'.repeat(74)}\n${title}\n${'─'.repeat(74)}`)
}

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1
    console.log(`  PASS  ${label}${detail ? `  — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${label}${detail ? `  — ${detail}` : ''}`)
  }
}

function skip(label: string, why: string): void {
  skipped += 1
  console.log(`  SKIP  ${label}  — ${why}`)
}

interface FetchOptions {
  cookie?: string
  method?: string
  body?: BodyInit
  headers?: Record<string, string>
  redirect?: RequestRedirect
}

async function request(path: string, options: FetchOptions = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    // Never follow: a 307 to /login is the assertion in half these checks, and
    // following it would turn a working guard into an indistinguishable 200.
    redirect: options.redirect ?? 'manual',
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: options.body } : {}),
  })

  return {
    status: response.status,
    headers: response.headers,
    text: async () => response.text(),
    bytes: async () => new Uint8Array(await response.arrayBuffer()),
    json: async () => response.json() as Promise<Record<string, unknown>>,
  }
}

async function main(): Promise<void> {
  console.log(`\nHTTP smoke — ${BASE}\n`)

  /* --------------------------------------------------------- availability */
  section('AVAILABILITY')

  const home = await request('/')
  check('the homepage responds', home.status === 200, `${home.status}`)

  if (home.status !== 200) {
    console.error('\nServer is not answering. Run `npm run build && npm start` first.\n')
    process.exit(1)
  }

  for (const path of [
    '/products',
    '/products?q=mccb',
    '/categories',
    '/categories/valves',
    '/compare',
    '/assistant',
    '/login',
    '/register',
    '/forgot-password',
    '/about',
    '/pricing',
    '/contact',
  ]) {
    const response = await request(path)
    check(`GET ${path}`, response.status === 200, `${response.status}`)
  }

  const missing = await request('/products/no-such-product-slug')
  check('an unknown product is a 404, not a 500', missing.status === 404, `${missing.status}`)

  /* ----------------------------------------------------------- csp/nonce */
  section('CONTENT-SECURITY-POLICY')

  const staticCsp = home.headers.get('content-security-policy') ?? ''
  check('the homepage carries a CSP', staticCsp.length > 0)
  check("a prerendered page keeps 'unsafe-inline' for Next's flight scripts",
    staticCsp.includes("script-src 'self' 'unsafe-inline'"))
  check("'unsafe-eval' is not shipped to production", !staticCsp.includes('unsafe-eval'))
  check("framing is denied", staticCsp.includes("frame-ancestors 'none'"))
  check("object-src is none", staticCsp.includes("object-src 'none'"))

  const login = await request('/login')
  const loginCsp = login.headers.get('content-security-policy') ?? ''
  const nonce = /'nonce-([^']+)'/.exec(loginCsp)?.[1]

  check('a dynamic route is served with a nonce', Boolean(nonce))
  // Only script-src must drop it. style-src keeps 'unsafe-inline' deliberately:
  // Next injects inline <style> for font metrics and React inlines styles while
  // streaming, and neither has a nonce path.
  const scriptSrc = /script-src ([^;]+)/.exec(loginCsp)?.[1] ?? ''
  check("the nonce policy drops 'unsafe-inline' from script-src", !scriptSrc.includes("'unsafe-inline'"), scriptSrc)

  // The check that matters: a nonce in the header with unnonced scripts in the
  // body is a broken page, not a hardened one.
  if (nonce) {
    for (const path of ['/login', '/register', '/assistant', '/compare']) {
      const response = await request(path)
      const policy = response.headers.get('content-security-policy') ?? ''
      const pageNonce = /'nonce-([^']+)'/.exec(policy)?.[1]
      const html = await response.text()

      const tags = html.match(/<script[^>]*>/g) ?? []
      // Every inline script must be nonced. The one external script is the
      // theme bootstrap, covered by script-src 'self'.
      const unnonced = tags.filter((tag) => !tag.includes('nonce='))
      const external = unnonced.filter((tag) => tag.includes('src="/'))

      check(
        `${path}: every script is nonced or same-origin`,
        unnonced.length === external.length,
        `${tags.length} scripts, ${unnonced.length - external.length} unaccounted`
      )
      check(
        `${path}: the body nonce matches its header`,
        Boolean(pageNonce) && html.includes(`nonce="${pageNonce}"`)
      )
    }

    const second = await request('/login')
    const secondNonce = /'nonce-([^']+)'/.exec(
      second.headers.get('content-security-policy') ?? ''
    )?.[1]
    // A reused nonce is no better than 'unsafe-inline'.
    check('the nonce is fresh on every request', Boolean(secondNonce) && secondNonce !== nonce)
  }

  /* ------------------------------------------------------ static headers */
  section('SECURITY HEADERS')

  check('X-Content-Type-Options', home.headers.get('x-content-type-options') === 'nosniff')
  check('X-Frame-Options', (home.headers.get('x-frame-options') ?? '').length > 0)
  check('Referrer-Policy', (home.headers.get('referrer-policy') ?? '').length > 0)

  const themeScript = await request('/theme-init.js')
  check('the theme bootstrap is served', themeScript.status === 200, `${themeScript.status}`)

  /* -------------------------------------------------------------- guards */
  section('ROUTE GUARDS')

  for (const path of ['/account', '/account/rfq', '/account/settings', '/admin']) {
    const response = await request(path)
    const location = response.headers.get('location') ?? ''
    check(
      `anonymous ${path} redirects to sign-in`,
      response.status === 307 && location.includes('/login'),
      `${response.status} ${location.slice(0, 40)}`
    )
  }

  if (CUSTOMER) {
    const account = await request('/account', { cookie: CUSTOMER })
    check('a signed-in buyer reaches their dashboard', account.status === 200, `${account.status}`)

    const admin = await request('/admin', { cookie: CUSTOMER })
    check(
      'a buyer gets 404 for the admin area, never 403',
      admin.status === 404,
      `${admin.status}`
    )

    const html = await account.text()
    check('the dashboard renders real seeded data', html.includes('Rajesh'))
  } else {
    skip('signed-in buyer checks', 'set SMOKE_CUSTOMER_COOKIE')
  }

  if (ADMIN) {
    for (const path of ['/admin', '/admin/products', '/admin/rfq', '/admin/audit', '/admin/reports']) {
      const response = await request(path, { cookie: ADMIN })
      check(`admin reaches ${path}`, response.status === 200, `${response.status}`)
    }
  } else {
    skip('admin area checks', 'set SMOKE_ADMIN_COOKIE')
  }

  /* --------------------------------------------------- session identity */
  section('SESSION IDENTITY')

  // The endpoint behind the header's signed-in state on static pages. It must
  // identify the caller to themselves and no one else, and never be cached.
  const anonIdentity = await request('/api/account/shortlist')
  const anonPayload = await anonIdentity.json()
  check(
    'anonymous identity is null, not an error',
    anonIdentity.status === 200 && anonPayload.user === null && anonPayload.saved === null,
    `${anonIdentity.status}`
  )
  check(
    'identity response is never cacheable',
    (anonIdentity.headers.get('cache-control') ?? '').includes('no-store')
  )

  if (CUSTOMER) {
    const identity = await request('/api/account/shortlist', { cookie: CUSTOMER })
    const payload = await identity.json()
    const user = payload.user as { name?: string; role?: string } | null
    check(
      'a signed-in buyer sees their own name and role',
      identity.status === 200 && !!user?.name && user.role === 'customer',
      `${user?.name ?? 'null'} (${user?.role ?? '—'})`
    )
  } else {
    skip('buyer identity check', 'set SMOKE_CUSTOMER_COOKIE')
  }

  if (ADMIN) {
    const identity = await request('/api/account/shortlist', { cookie: ADMIN })
    const payload = await identity.json()
    const user = payload.user as { role?: string } | null
    check(
      'an admin session reports a staff-or-above role',
      identity.status === 200 && (user?.role === 'staff' || user?.role === 'admin'),
      user?.role ?? 'null'
    )
  } else {
    skip('admin identity check', 'set SMOKE_ADMIN_COOKIE')
  }

  /* ------------------------------------------------------------ exports */
  section('CSV EXPORTS')

  const anonExport = await request('/api/admin/export/products')
  check(
    'an anonymous export is 404, disclosing nothing',
    anonExport.status === 404,
    `${anonExport.status}`
  )

  if (CUSTOMER) {
    const buyerExport = await request('/api/admin/export/products', { cookie: CUSTOMER })
    check('a buyer cannot export the catalogue', buyerExport.status === 404, `${buyerExport.status}`)
  }

  if (ADMIN) {
    for (const kind of ['products', 'quotations', 'searches', 'customers']) {
      const response = await request(`/api/admin/export/${kind}`, { cookie: ADMIN })
      const raw = await response.bytes()
      // Read as bytes, not text: `Response.text()` strips a leading BOM per
      // spec, so decoding first would hide whether one was ever sent.
      const body = new TextDecoder('utf-8').decode(raw)
      const disposition = response.headers.get('content-disposition') ?? ''

      check(`export ${kind} responds`, response.status === 200, `${response.status}`)
      check(
        `export ${kind} downloads rather than renders`,
        disposition.includes('attachment') && disposition.includes('.csv')
      )
      check(
        `export ${kind} is uncacheable`,
        (response.headers.get('cache-control') ?? '').includes('no-store')
      )
      check(
        `export ${kind} starts with a UTF-8 BOM, so Excel reads it as UTF-8`,
        raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
      )
      check(`export ${kind} has a header row`, body.split('\r\n')[0]!.includes(','))
    }

    const products = await (await request('/api/admin/export/products', { cookie: ADMIN })).text()
    check(
      'the catalogue export carries every product',
      products.trimEnd().split('\r\n').length > 60,
      `${products.trimEnd().split('\r\n').length - 1} rows`
    )
    check('the catalogue export contains no password material', !/passwordHash|\$2[aby]\$/.test(products))

    const customers = await (await request('/api/admin/export/customers', { cookie: ADMIN })).text()
    check('the customer export contains no password material', !/passwordHash|\$2[aby]\$/.test(customers))

    const unknown = await request('/api/admin/export/everything', { cookie: ADMIN })
    check('an unknown export kind is 404', unknown.status === 404, `${unknown.status}`)
  } else {
    skip('admin export checks', 'set SMOKE_ADMIN_COOKIE')
  }

  /* ------------------------------------------------------------ uploads */
  section('UPLOADS')

  const anonUpload = await request('/api/admin/upload', { method: 'POST' })
  check('an anonymous upload is 404', anonUpload.status === 404, `${anonUpload.status}`)

  if (CUSTOMER) {
    const buyerUpload = await request('/api/admin/upload', { method: 'POST', cookie: CUSTOMER })
    check('a buyer cannot upload', buyerUpload.status === 404, `${buyerUpload.status}`)
  }

  if (ADMIN) {
    // A PNG that is really a script — the classic upload bypass.
    const disguised = new FormData()
    disguised.append(
      'file',
      new File([new TextEncoder().encode('<?php system($_GET["c"]); ?>')], 'shell.png', {
        type: 'image/png',
      })
    )
    disguised.append('alt', 'nope')

    const rejected = await fetch(`${BASE}/api/admin/upload`, {
      method: 'POST',
      headers: { cookie: ADMIN },
      body: disguised,
    })
    check(
      'a script named .png is rejected on its bytes',
      rejected.status === 422,
      `${rejected.status}`
    )

    // A real image, produced here rather than kept as a fixture.
    const sharp = (await import('sharp')).default
    const png = await sharp({
      create: { width: 120, height: 90, channels: 3, background: '#b46a05' },
    })
      .png()
      .toBuffer()

    const good = new FormData()
    good.append('file', new File([new Uint8Array(png)], 'valve.png', { type: 'image/png' }))
    good.append('alt', 'A ball valve')

    const accepted = await fetch(`${BASE}/api/admin/upload`, {
      method: 'POST',
      headers: { cookie: ADMIN },
      body: good,
    })
    check('a real image is accepted', accepted.status === 200, `${accepted.status}`)

    if (accepted.ok) {
      const payload = (await accepted.json()) as { image?: { url: string; width: number } }
      const url = payload.image?.url ?? ''

      check('the stored URL is a content-addressed media path',
        /^\/api\/media\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{36}\.webp$/.test(url), url)

      const served = await request(url)
      check('the uploaded image is served back', served.status === 200, `${served.status}`)
      check('it is served as WebP whatever went in',
        served.headers.get('content-type') === 'image/webp')
      check('it is served with nosniff',
        served.headers.get('x-content-type-options') === 'nosniff')
      check('it is immutably cacheable, since the key is a content hash',
        (served.headers.get('cache-control') ?? '').includes('immutable'))
    }

    for (const path of [
      '/api/media/../../package.json',
      '/api/media/ab/cd/short.webp',
      `/api/media/ab/cd/${'0'.repeat(36)}.svg`,
    ]) {
      const response = await request(path)
      check(`traversal rejected: ${path.slice(11, 46)}`, response.status === 404, `${response.status}`)
    }
  } else {
    skip('admin upload checks', 'set SMOKE_ADMIN_COOKIE')
  }

  /* ---------------------------------------------------------- assistant */
  section('ASSISTANT API')

  const query = await request('/api/assistant/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({
      kind: 'ask',
      query: 'stainless steel threaded ball valve for HVAC under 5000',
    }),
  })
  check('the assistant answers', query.status === 200, `${query.status}`)

  if (query.status === 200) {
    const payload = (await query.json()) as {
      conversationId?: string
      assistantMessage?: {
        content?: string
        results?: unknown[]
        totalMatches?: number
        intent?: { confidence?: number }
      }
      chips?: unknown[]
      provider?: string
      providerConfigured?: boolean
    }

    const reply = payload.assistantMessage

    check('it opens a conversation', typeof payload.conversationId === 'string')
    check(
      'it returns ranked results',
      Array.isArray(reply?.results) && reply.results.length > 0,
      `${reply?.results?.length ?? 0} results`
    )
    check(
      'the total is the match count, not the page size',
      typeof reply?.totalMatches === 'number' &&
        reply.totalMatches >= (reply.results?.length ?? 0),
      `${reply?.totalMatches} matched, ${reply?.results?.length} shown`
    )
    check('it reports a parse confidence', typeof reply?.intent?.confidence === 'number')
    check('it says which provider answered', typeof payload.provider === 'string', payload.provider)
    // `providerConfigured` reports whether the provider that answered is the
    // one that was configured — false means it silently fell back, which the
    // interface has to surface rather than hide.
    check(
      'it reports whether the configured provider is the one that answered',
      payload.providerConfigured === true,
      `${payload.provider} answered`
    )
    check('it offers refinement chips', Array.isArray(payload.chips))
  }

  const crossOrigin = await request('/api/assistant/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ kind: 'ask', query: 'valve' }),
  })
  check(
    'a cross-origin assistant call is refused',
    crossOrigin.status === 403 || crossOrigin.status === 400,
    `${crossOrigin.status}`
  )

  /* ------------------------------------------------------------ cookies */
  section('VISITOR COOKIE')

  const cookie = home.headers.get('set-cookie') ?? ''
  check('a visitor id is issued', cookie.includes('sourcely_visitor'))
  check('it is httpOnly', cookie.toLowerCase().includes('httponly'))
  check('it is SameSite=Lax or stricter', /samesite=(lax|strict)/i.test(cookie))

  /* ------------------------------------------------------------- report */
  console.log(`\n${'='.repeat(74)}`)
  if (failed === 0) {
    console.log(`ALL ${passed} CHECKS PASSED${skipped > 0 ? ` (${skipped} skipped)` : ''}`)
  } else {
    console.log(`${failed} OF ${passed + failed} CHECKS FAILED${skipped > 0 ? ` (${skipped} skipped)` : ''}`)
  }
  console.log('='.repeat(74))

  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nSmoke run crashed:\n', error)
  process.exit(1)
})
