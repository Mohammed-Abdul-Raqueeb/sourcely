import { jwtVerify, SignJWT } from 'jose'
import type { Role } from '@/lib/domain/account'

/**
 * Session tokens.
 *
 * Deliberately Edge-runtime safe — no `server-only`, no Node built-ins — so
 * middleware can verify a token without importing the data layer. `jose` runs
 * on WebCrypto in both runtimes.
 *
 * The token is a *hint*, not an authority. It proves the bearer authenticated
 * at some point and carries an opaque session id. Whether that session is
 * still valid is decided by the service layer against the session store, which
 * is what makes logout and "sign out everywhere" actually work. Middleware can
 * only cheaply reject requests that have no plausible token at all.
 */

export const SESSION_COOKIE = 'sourcely_session'
export const ANON_COOKIE = 'sourcely_visitor'

const ISSUER = 'sourcely'
const AUDIENCE = 'sourcely:web'

export interface SessionClaims {
  /** Session id, matched against the session store. */
  sid: string
  /** User id. */
  sub: string
  role: Role
  name: string
  email: string
}

let cachedKey: Uint8Array | null = null

/**
 * Raised when `AUTH_SECRET` is missing or too short in production.
 *
 * Distinguished from an invalid token on purpose: `verifySessionToken` swallows
 * token errors and returns null, which is right for a tampered cookie and
 * catastrophic for a configuration fault — every sign-in would fail with no
 * diagnostic, and the login form would simply never work. This propagates.
 */
export class AuthConfigurationError extends Error {
  override readonly name = 'AuthConfigurationError'
}

/**
 * In development a missing AUTH_SECRET falls back to a fixed development key
 * so the project runs with no configuration. In production it throws — a
 * predictable signing key is a total authentication bypass, and failing to
 * boot is far better than pretending to be secure.
 */
function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey

  const configured = process.env.AUTH_SECRET

  if (!configured || configured.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new AuthConfigurationError(
        'AUTH_SECRET must be set to at least 32 characters in production. ' +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      )
    }
    cachedKey = new TextEncoder().encode('sourcely-development-only-key-do-not-ship-32')
    return cachedKey
  }

  cachedKey = new TextEncoder().encode(configured)
  return cachedKey
}

export function sessionTtlHours(): number {
  const configured = Number.parseInt(process.env.AUTH_SESSION_TTL_HOURS ?? '', 10)
  return Number.isFinite(configured) && configured > 0 ? configured : 72
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    sid: claims.sid,
    role: claims.role,
    name: claims.name,
    email: claims.email,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${sessionTtlHours()}h`)
    .sign(secretKey())
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    })

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      return null
    }

    return {
      sub: payload.sub,
      sid: payload.sid,
      role: payload.role as Role,
      name: payload.name,
      email: payload.email,
    }
  } catch (error) {
    // A configuration fault is not a bad token. Swallowing it here would mean
    // a deploy with no AUTH_SECRET shows a login form that silently never
    // works, which is far harder to diagnose than a 500 that names the cause.
    if (error instanceof AuthConfigurationError) throw error
    // Expired, tampered, wrong key, malformed — all the same answer.
    return null
  }
}

/**
 * Cookie options shared by every place that writes the session cookie.
 *
 * `httpOnly` puts it out of reach of any script, `sameSite: lax` blocks
 * cross-site POSTs while still surviving a normal inbound link, and `secure`
 * is on everywhere except local development over plain HTTP.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}
