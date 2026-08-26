import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Role, SessionUser } from '@/lib/domain/account'
import { ROLE_RANK } from '@/lib/domain/account'
import { getAccountRepository } from '@/server/repositories'
import {
  ANON_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionTtlHours,
  signSessionToken,
  verifySessionToken,
} from './tokens'

/**
 * Server-side session resolution.
 *
 * The signed token proves the bearer authenticated; the session store decides
 * whether that is *still* true. Both checks run here, which is why logout and
 * "sign out everywhere" take effect immediately rather than whenever the JWT
 * happens to expire.
 *
 * Wrapped in `React.cache` so a page that reads the session in a layout, a
 * header and three components pays for one lookup per request.
 */

export interface ActiveSession {
  user: SessionUser
  sessionId: string
}

export const getSession = cache(async (): Promise<ActiveSession | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const claims = await verifySessionToken(token)
  if (!claims) return null

  const accounts = getAccountRepository()
  // The user is read rather than trusted from the token's copy of name and
  // role: a role change or a rename must take effect on the next request, not
  // when the token expires three days later. Both ids come from the verified
  // token, so the two lookups are independent — issued in parallel they cost
  // one database round-trip of latency instead of two, on every single
  // authenticated request. Both results are still validated below; nothing
  // about the check itself is relaxed.
  const [session, user] = await Promise.all([
    accounts.findActiveSession(claims.sid),
    accounts.findUserById(claims.sub),
  ])
  if (!session || session.userId !== claims.sub) return null
  if (!user) return null

  // Activity tracking needs "active this week", not "active this second" — so
  // the write is skipped while the stored timestamp is fresh, sparing a
  // database write on almost every request.
  if (Date.now() - new Date(user.lastActiveAt).getTime() > 5 * 60_000) {
    void accounts.touchUser(user.id)
  }

  return {
    sessionId: session.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  }
})

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null
}

/**
 * Guards a page. Redirects to sign-in with a `next` parameter so the buyer
 * lands where they were going rather than on a dashboard they did not ask for.
 */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const session = await getSession()
  if (session) return session.user

  const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : ''
  redirect(`/login${target}`)
}

export async function requireRole(minimum: Role, returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(returnTo)
  if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) {
    // Deliberately a 404, not a 403: confirming that a page exists but is
    // forbidden tells an attacker the admin area is worth attacking.
    redirect('/404')
  }
  return user
}

/**
 * Role guard for route handlers.
 *
 * Returns null instead of redirecting. A redirect is the right answer for a
 * page — the visitor gets a sign-in form — but the wrong one for an endpoint
 * that returns a file: the browser would follow it and hand the caller an HTML
 * login page with a 200, which is indistinguishable from success until someone
 * opens the downloaded "CSV".
 */
export async function requireRoleForApi(minimum: Role): Promise<SessionUser | null> {
  const session = await getSession()
  if (!session) return null
  if (ROLE_RANK[session.user.role] < ROLE_RANK[minimum]) return null
  return session.user
}

/* -------------------------------------------------------------------------- */
/* Mutations — Server Actions and Route Handlers only                          */
/* -------------------------------------------------------------------------- */

/**
 * Issues a session and writes the cookie.
 *
 * Callable only from a Server Action or Route Handler; Next forbids setting
 * cookies while rendering, which is the correct constraint — a GET that
 * mutates auth state is a bug.
 */
export async function startSession(user: {
  id: string
  name: string
  email: string
  role: Role
}): Promise<void> {
  const headerList = await headers()
  const userAgent = headerList.get('user-agent') ?? 'unknown'

  const session = await getAccountRepository().createSession(user.id, userAgent)

  const token = await signSessionToken({
    sid: session.id,
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  })

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(sessionTtlHours() * 3600))
}

export async function endSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value

  if (token) {
    const claims = await verifySessionToken(token)
    if (claims) await getAccountRepository().revokeSession(claims.sid)
  }

  jar.delete(SESSION_COOKIE)
}

/**
 * Rotates the session after a privilege-relevant change (password reset,
 * role change). The old token stops working immediately.
 */
export async function rotateSession(user: {
  id: string
  name: string
  email: string
  role: Role
}): Promise<void> {
  const current = await getSession()
  await getAccountRepository().revokeAllSessions(user.id, undefined)
  void current
  await startSession(user)
}

/* -------------------------------------------------------------------------- */
/* Anonymous visitors                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Stable id for a signed-out visitor, set by middleware.
 *
 * Used to attribute search events and recently-viewed products before sign-in,
 * so the history is not empty the moment someone creates an account. Read-only
 * here: server components cannot set cookies.
 */
export async function getVisitorId(): Promise<string> {
  const jar = await cookies()
  return jar.get(ANON_COOKIE)?.value ?? 'anonymous'
}
