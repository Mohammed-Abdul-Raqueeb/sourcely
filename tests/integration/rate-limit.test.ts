import { afterAll, describe, expect, it } from 'vitest'

/**
 * Distributed rate limiting against a real Redis.
 *
 * The interesting properties are the ones an in-process limiter cannot have:
 * that two independent callers draw on one bucket, and that concurrent spends
 * cannot oversubscribe it. Neither can be tested against a mock — a fake that
 * returns whatever the test expects would pass while the Lua script was
 * wrong — so this suite skips when no Redis is reachable rather than
 * substituting one.
 *
 *   docker compose up -d
 */

// Set in tests/setup.ts so it is present before any import runs.
const REDIS_URL = process.env.REDIS_URL!

const reachable = await (async () => {
  try {
    const { getRedis } = await import('@/server/security/redis')
    const client = getRedis()
    if (!client) return false
    await client.ping()
    return true
  } catch (error) {
    console.warn('[redis] not reachable — skipping distributed rate-limit tests', error)
    return false
  }
})()

afterAll(async () => {
  const { resetRedis } = await import('@/server/security/redis')
  await resetRedis()
})

const when = () => (reachable ? it : it.skip)

const key = (name: string) => `vitest:${name}:${process.pid}:${Math.random().toString(36).slice(2)}`

describe('distributed rate limiting', () => {
  when()('reports the redis backend when REDIS_URL is set', async () => {
    const { rateLimit, rateLimitBackend } = await import('@/server/security/rate-limit')
    expect(rateLimitBackend()).toBe('redis')
    expect((await rateLimit(key('backend'), 5, 60_000)).backend).toBe('redis')
  })

  when()('caps at the configured limit', async () => {
    const { rateLimit } = await import('@/server/security/rate-limit')
    const k = key('cap')

    let allowed = 0
    for (let i = 0; i < 15; i++) {
      if ((await rateLimit(k, 10, 60_000)).ok) allowed += 1
    }

    expect(allowed).toBe(10)
  })

  when()('counts down the remaining tokens', async () => {
    const { rateLimit } = await import('@/server/security/rate-limit')
    const k = key('remaining')

    const first = await rateLimit(k, 5, 60_000)
    const second = await rateLimit(k, 5, 60_000)

    expect(first.remaining).toBe(4)
    expect(second.remaining).toBe(3)
  })

  when()('reports a retry-after once the bucket is empty', async () => {
    const { rateLimit } = await import('@/server/security/rate-limit')
    const k = key('retry')

    for (let i = 0; i < 4; i++) await rateLimit(k, 4, 60_000)
    const blocked = await rateLimit(k, 4, 60_000)

    expect(blocked.ok).toBe(false)
    expect(blocked.remaining).toBe(0)
    // One token per fifteen seconds at four per minute.
    expect(blocked.retryAfter).toBeGreaterThan(0)
    expect(blocked.retryAfter).toBeLessThanOrEqual(15)
  })

  when()('gives each key its own bucket', async () => {
    const { rateLimit } = await import('@/server/security/rate-limit')
    const base = key('isolation')

    for (let i = 0; i < 5; i++) await rateLimit(`${base}:a`, 5, 60_000)

    expect((await rateLimit(`${base}:a`, 5, 60_000)).ok).toBe(false)
    expect((await rateLimit(`${base}:b`, 5, 60_000)).ok).toBe(true)
  })

  when()('shares one bucket across independent clients', async () => {
    // The whole point of the exercise: two connections, one quota. A separate
    // client stands in for a second application instance.
    const { default: Redis } = await import('ioredis')
    const { rateLimit } = await import('@/server/security/rate-limit')

    const k = key('shared')
    for (let i = 0; i < 6; i++) await rateLimit(k, 6, 60_000)

    const second = new Redis(REDIS_URL)
    try {
      const stored = await second.hget(`sourcely:rl:${k}`, 'tokens')
      expect(Number(stored)).toBeLessThan(1)
    } finally {
      await second.quit()
    }
  })

  when()('does not oversubscribe under concurrency', async () => {
    // Fifty simultaneous spends against a bucket of ten. A read-modify-write
    // pair would let several callers observe the same count and each decrement
    // it; the Lua script runs atomically, so exactly ten can succeed.
    const { rateLimit } = await import('@/server/security/rate-limit')
    const k = key('race')

    const results = await Promise.all(
      Array.from({ length: 50 }, () => rateLimit(k, 10, 60_000))
    )

    expect(results.filter((result) => result.ok)).toHaveLength(10)
  })

  when()('refills over time rather than resetting on a window edge', async () => {
    const { rateLimit } = await import('@/server/security/rate-limit')
    // Two per second: a token returns in roughly half a second.
    const k = key('refill')

    expect((await rateLimit(k, 2, 1_000)).ok).toBe(true)
    expect((await rateLimit(k, 2, 1_000)).ok).toBe(true)
    expect((await rateLimit(k, 2, 1_000)).ok).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 600))
    expect((await rateLimit(k, 2, 1_000)).ok).toBe(true)
  })

  when()('expires an untouched bucket instead of leaking a key per identity', async () => {
    const { rateLimit } = await import('@/server/security/rate-limit')
    const { getRedis } = await import('@/server/security/redis')

    const k = key('ttl')
    await rateLimit(k, 10, 60_000)

    const ttl = await getRedis()!.pttl(`sourcely:rl:${k}`)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(60_000 * 4)
  })

  when()('recovers when the script cache is flushed underneath it', async () => {
    // Redis restarts and managed-service failovers empty the script cache;
    // EVALSHA then returns NOSCRIPT. The limiter must reload rather than start
    // rejecting every request.
    const { rateLimit } = await import('@/server/security/rate-limit')
    const { getRedis } = await import('@/server/security/redis')

    const k = key('noscript')
    expect((await rateLimit(k, 5, 60_000)).ok).toBe(true)

    await getRedis()!.script('FLUSH')

    const after = await rateLimit(k, 5, 60_000)
    expect(after.ok).toBe(true)
    expect(after.backend).toBe('redis')
  })

  when()('falls back to the in-process bucket when Redis is unreachable', async () => {
    // Configured but broken is the dangerous case: failing open would remove
    // brute-force protection entirely at the exact moment infrastructure is
    // already degraded.
    const { resetRedis } = await import('@/server/security/redis')
    const { rateLimit } = await import('@/server/security/rate-limit')

    const original = process.env.REDIS_URL
    await resetRedis()
    // Reserved by RFC 5737 for documentation; nothing answers on it.
    process.env.REDIS_URL = 'redis://192.0.2.1:6379'

    try {
      const result = await rateLimit(key('unreachable'), 3, 60_000)
      expect(result.backend).toBe('memory')
      expect(result.ok).toBe(true)
    } finally {
      await resetRedis()
      process.env.REDIS_URL = original
    }
  }, 20_000)
})
