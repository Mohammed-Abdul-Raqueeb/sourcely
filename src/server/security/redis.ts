import 'server-only'
import Redis from 'ioredis'

/**
 * Shared Redis connection.
 *
 * Absent `REDIS_URL` this returns null and every caller falls back to its
 * in-process behaviour. That is deliberate: a developer running `npm run dev`
 * should not need a Redis container, and a missing cache must never be the
 * reason the site is down.
 *
 * The client hangs off `globalThis` for the same reason the rate-limit buckets
 * do — Next's dev server re-evaluates modules on every save, and a new TCP
 * connection per save exhausts the server's connection limit within a session.
 */

declare global {
  var __sourcelyRedis: Redis | null | undefined
}

let warned = false

export function getRedis(): Redis | null {
  if (globalThis.__sourcelyRedis !== undefined) return globalThis.__sourcelyRedis

  const url = process.env.REDIS_URL
  if (!url) {
    globalThis.__sourcelyRedis = null
    return null
  }

  const client = new Redis(url, {
    // Fail fast rather than hanging. A rate-limit check that blocks for thirty
    // seconds has already caused the outage it was meant to prevent; these
    // three settings bound a call at roughly three seconds even when the host
    // is unreachable, after which the caller uses its in-process fallback.
    connectTimeout: 2_000,
    commandTimeout: 1_000,
    maxRetriesPerRequest: 1,

    // Left enabled deliberately. Connecting is asynchronous, so the first
    // requests after a deploy arrive before the socket is ready; with the
    // offline queue disabled every one of them is rejected outright and the
    // window immediately after a restart — exactly when a retry storm is most
    // likely — silently loses distributed limiting. Queued commands are still
    // bounded by the timeouts above.
    enableOfflineQueue: true,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
  })

  // ioredis emits `error` on every reconnection attempt. Without a listener
  // Node treats it as an unhandled exception and kills the process — so a
  // Redis restart would take the application down with it.
  client.on('error', (error: Error) => {
    if (!warned) {
      console.error('[redis] connection error — callers will use their fallback:', error.message)
      warned = true
    }
  })

  client.on('ready', () => {
    warned = false
  })

  globalThis.__sourcelyRedis = client
  return client
}

/** True when a distributed backend is configured, whatever its current health. */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL)
}

/** Test seam — drops the memoised client so the next call re-reads the env. */
export async function resetRedis(): Promise<void> {
  const existing = globalThis.__sourcelyRedis
  globalThis.__sourcelyRedis = undefined
  if (existing) await existing.quit().catch(() => {})
}
