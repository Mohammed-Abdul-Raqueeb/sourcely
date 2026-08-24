import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  checkPassword,
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
} from '@/server/auth/password'
import {
  AuthConfigurationError,
  sessionCookieOptions,
  sessionTtlHours,
  signSessionToken,
  verifySessionToken,
} from '@/server/auth/tokens'
import { rateLimit } from '@/server/security/rate-limit'
import {
  emailSchema,
  gstinSchema,
  loginSchema,
  registerSchema,
  toFieldErrors,
} from '@/lib/validation/auth'
import { productSchema, skuSchema } from '@/lib/validation/admin'

describe('password hashing', () => {
  it('produces a bcrypt digest at cost 12', async () => {
    const hash = await hashPassword('Sourcely2026')
    expect(hash).toMatch(/^\$2[aby]\$12\$/)
  })

  it('salts — the same password hashes differently every time', async () => {
    expect(await hashPassword('Sourcely2026')).not.toBe(await hashPassword('Sourcely2026'))
  })

  it('verifies the correct password and rejects everything else', async () => {
    const hash = await hashPassword('Sourcely2026')
    expect(await verifyPassword('Sourcely2026', hash)).toBe(true)
    expect(await verifyPassword('sourcely2026', hash)).toBe(false)
    expect(await verifyPassword('', hash)).toBe(false)
  })

  it('returns false for a malformed hash instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('anything', '')).toBe(false)
  })

  it('ships a real dummy hash so an unknown email costs the same time', () => {
    // If this were a fake string, bcrypt would reject it instantly and login
    // latency would become a user-enumeration oracle.
    expect(DUMMY_HASH).toMatch(/^\$2[aby]\$12\$/)
  })
})

describe('password policy', () => {
  it('rejects short, common and email-derived passwords', () => {
    expect(checkPassword('Abc123').ok).toBe(false)
    expect(checkPassword('password123').ok).toBe(false)
    expect(checkPassword('rajeshkumar1', 'rajesh@deccan.in').ok).toBe(false)
  })

  it('accepts a reasonable password', () => {
    expect(checkPassword('Sourcely2026', 'a@b.in').ok).toBe(true)
  })

  it('always explains why it refused', () => {
    const result = checkPassword('abc')
    expect(result.ok).toBe(false)
    expect(result.problems.length).toBeGreaterThan(0)
    expect(result.problems[0]).toBeTruthy()
  })

  it('scores strength within 0..4 and labels it', () => {
    for (const password of ['a', 'abcdefgh', 'Abcdefgh1', 'Abcdefgh1!xyz']) {
      const result = checkPassword(password)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(4)
      expect(result.label).toBeTruthy()
    }
  })
})

describe('session tokens', () => {
  const claims = {
    sid: 'sess_1',
    sub: 'user_1',
    role: 'customer' as const,
    name: 'Test Buyer',
    email: 'test@example.in',
  }

  it('round-trips every claim', async () => {
    const verified = await verifySessionToken(await signSessionToken(claims))
    expect(verified).toEqual(claims)
  })

  it('rejects a tampered payload', async () => {
    const token = await signSessionToken(claims)
    expect(await verifySessionToken(`${token}x`)).toBeNull()
  })

  it('rejects a forged signature', async () => {
    const [header, payload, signature] = (await signSessionToken(claims)).split('.')
    const forged = `${header}.${payload}.${'A'.repeat((signature ?? '').length)}`
    expect(await verifySessionToken(forged)).toBeNull()
  })

  it('rejects garbage without throwing', async () => {
    for (const value of ['', 'not.a.token', 'a.b', '...']) {
      expect(await verifySessionToken(value)).toBeNull()
    }
  })

  it('exposes a configuration error class distinct from a bad token', () => {
    // A missing AUTH_SECRET must not read as "invalid token" — that would show
    // a login form that silently never works.
    expect(new AuthConfigurationError('x')).toBeInstanceOf(Error)
    expect(new AuthConfigurationError('x').name).toBe('AuthConfigurationError')
  })

  it('defaults the session lifetime sensibly', () => {
    expect(sessionTtlHours()).toBeGreaterThan(0)
  })

  it('writes an HttpOnly, SameSite=Lax cookie', () => {
    const options = sessionCookieOptions(3600)
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
    expect(options.maxAge).toBe(3600)
  })
})

describe('rate limiting', () => {
  /**
   * Pinned to the in-process backend for the whole block.
   *
   * These assert the bucket arithmetic, and that has to be hermetic: with an
   * ambient `REDIS_URL` pointing anywhere — including somewhere unreachable —
   * each call would take seconds to time out, the bucket would refill in real
   * time between them, and a limit of ten would admit more than ten. The
   * distributed backend is covered against a real Redis in
   * tests/integration/rate-limit.test.ts.
   */
  let ambientRedis: string | undefined

  beforeAll(async () => {
    const { resetRedis } = await import('@/server/security/redis')
    ambientRedis = process.env.REDIS_URL
    delete process.env.REDIS_URL
    await resetRedis()
  })

  afterAll(async () => {
    const { resetRedis } = await import('@/server/security/redis')
    if (ambientRedis) process.env.REDIS_URL = ambientRedis
    await resetRedis()
  })

  it('caps at the configured limit', async () => {
    const key = `test-cap-${Math.random()}`
    let allowed = 0
    for (let i = 0; i < 15; i++) if ((await rateLimit(key, 10, 60_000)).ok) allowed++
    expect(allowed).toBe(10)
  })

  it('reports a retry-after once blocked', async () => {
    const key = `test-retry-${Math.random()}`
    for (let i = 0; i < 10; i++) await rateLimit(key, 10, 60_000)
    const blocked = await rateLimit(key, 10, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('gives each key its own bucket', async () => {
    const base = Math.random()
    for (let i = 0; i < 10; i++) await rateLimit(`a-${base}`, 10, 60_000)
    expect((await rateLimit(`b-${base}`, 10, 60_000)).ok).toBe(true)
  })

  it('reports the in-process backend when no REDIS_URL is configured', async () => {
    const { rateLimitBackend } = await import('@/server/security/rate-limit')
    expect(rateLimitBackend()).toBe('memory')
    expect((await rateLimit(`backend-${Math.random()}`, 5, 60_000)).backend).toBe('memory')
  })
})

describe('validation schemas', () => {
  it('normalises email to lowercase and trims it', () => {
    expect(emailSchema.parse('  Rajesh@Example.IN ')).toBe('rajesh@example.in')
  })

  it('rejects a malformed email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
  })

  it('accepts a valid GSTIN and rejects a malformed one', () => {
    expect(gstinSchema.safeParse('36AAGCD1129R1ZP').success).toBe(true)
    expect(gstinSchema.safeParse('').success).toBe(true)
    expect(gstinSchema.safeParse('NOTAGSTIN').success).toBe(false)
  })

  it('requires matching passwords on registration', () => {
    const base = {
      name: 'Rajesh Kumar',
      email: 'rajesh@example.in',
      password: 'Sourcely2026',
      confirmPassword: 'Different2026',
      terms: 'on' as const,
    }
    const result = registerSchema.safeParse(base)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(toFieldErrors(result.error).confirmPassword).toMatch(/do not match/i)
    }
  })

  it('requires the terms checkbox', () => {
    const result = registerSchema.safeParse({
      name: 'Rajesh Kumar',
      email: 'rajesh@example.in',
      password: 'Sourcely2026',
      confirmPassword: 'Sourcely2026',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a minimal valid login', () => {
    expect(loginSchema.safeParse({ email: 'a@b.in', password: 'x' }).success).toBe(true)
  })
})

describe('admin validation', () => {
  it('upper-cases a SKU and rejects unsafe characters', () => {
    expect(skuSchema.parse(' vtk-bv2s-050 ')).toBe('VTK-BV2S-050')
    expect(skuSchema.safeParse('VTK/BV 050').success).toBe(false)
    expect(skuSchema.safeParse('-LEADING').success).toBe(false)
  })

  it('rejects a negative or fractional price', () => {
    const base = {
      sku: 'TEST-1',
      name: 'A reasonably long product name',
      shortDescription: 'A short description that is long enough to pass.',
      description: 'A full description that comfortably exceeds the sixty character minimum for this field.',
      categoryKey: 'valves',
      subcategoryKey: 'ball-valves',
      brandKey: 'vantek',
      sellerKey: 'metro-industrial',
      priceUnit: 'per unit',
      taxRatePercent: 18,
      status: 'draft' as const,
      availabilityState: 'in_stock' as const,
      minOrderQuantity: 1,
      unit: 'unit',
      artwork: 'ball-valve',
    }

    expect(productSchema.safeParse({ ...base, price: -1 }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, price: 1.5 }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, price: 4000 }).success).toBe(true)
  })

  it('rejects an unknown product status', () => {
    expect(
      productSchema.safeParse({ status: 'published' } as unknown as never).success
    ).toBe(false)
  })
})
