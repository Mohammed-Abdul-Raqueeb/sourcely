import 'server-only'
import { headers } from 'next/headers'
import { getRedis, isRedisConfigured } from './redis'

/**
 * Token-bucket rate limiting with two backends.
 *
 *   memory  in-process map — correct for one instance, useless behind a load
 *           balancer, and the default so a developer needs no infrastructure.
 *   redis   one shared bucket per identity across every instance, updated by
 *           an atomic Lua script.
 *
 * The backend is chosen by `REDIS_URL` alone; no call site knows which is in
 * use. When Redis is configured but unreachable the limiter falls back to the
 * in-process bucket rather than failing open — a degraded limit still stops a
 * password-guessing script, and an unreachable cache must not be able to
 * remove the protection entirely.
 *
 * Why a token bucket rather than a fixed window: a fixed window lets an
 * attacker spend the whole quota in the last second of one window and the
 * whole quota in the first second of the next, so the real short-term limit is
 * double the configured one. A bucket refills continuously and has no edge.
 */

interface Bucket {
  tokens: number
  updatedAt: number
}

declare global {
  var __sourcelyRateBuckets: Map<string, Bucket> | undefined
}

const buckets = (globalThis.__sourcelyRateBuckets ??= new Map<string, Bucket>())

export interface RateLimitResult {
  ok: boolean
  remaining: number
  /** Seconds until the next token is available. Zero when the call was allowed. */
  retryAfter: number
  /** Which backend answered. Surfaced in the admin settings page. */
  backend: 'memory' | 'redis'
}

/* -------------------------------------------------------------------------- */
/* In-process                                                                 */
/* -------------------------------------------------------------------------- */

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const refillRate = limit / windowMs

  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now }
  const elapsed = now - bucket.updatedAt
  const tokens = Math.min(limit, bucket.tokens + elapsed * refillRate)

  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now })
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((1 - tokens) / refillRate / 1000),
      backend: 'memory',
    }
  }

  buckets.set(key, { tokens: tokens - 1, updatedAt: now })

  // Opportunistic sweep so a long-running process does not accumulate a
  // bucket per IP address that ever visited.
  if (buckets.size > 5_000) {
    for (const [entryKey, entry] of buckets) {
      if (now - entry.updatedAt > windowMs * 4) buckets.delete(entryKey)
    }
  }

  return { ok: true, remaining: Math.floor(tokens - 1), retryAfter: 0, backend: 'memory' }
}

/* -------------------------------------------------------------------------- */
/* Redis                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Read, refill, spend and persist in one round trip.
 *
 * It has to be a script rather than a GET/SET pair: two instances checking the
 * same bucket concurrently would both read the same token count and both
 * decrement it, so a limit of ten would admit twenty. A Lua script runs
 * atomically on the server, which removes the race by construction.
 *
 * The clock comes from `redis.call('TIME')`, not from the caller. Application
 * instances disagree about the current time by whatever their NTP drift
 * happens to be, and a bucket refilled against a fast clock hands out free
 * tokens. Redis is one process, so its clock is authoritative for all of them.
 */
const BUCKET_SCRIPT = `
local key      = KEYS[1]
local limit    = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])

local time  = redis.call('TIME')
local nowMs = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)

local stored = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(stored[1])
local ts     = tonumber(stored[2])

if tokens == nil or ts == nil then
  tokens = limit
  ts = nowMs
end

local refillPerMs = limit / windowMs
tokens = math.min(limit, tokens + ((nowMs - ts) * refillPerMs))

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HSET', key, 'tokens', tostring(tokens), 'ts', tostring(nowMs))
-- A bucket nobody has touched for four windows is back at full quota anyway,
-- so expiring it frees the memory without changing any answer.
redis.call('PEXPIRE', key, math.ceil(windowMs * 4))

local retryAfterMs = 0
if allowed == 0 then
  retryAfterMs = math.ceil((1 - tokens) / refillPerMs)
end

return { allowed, math.floor(tokens), retryAfterMs }
`

/** Cached SHA so the common path is EVALSHA rather than shipping the script. */
let scriptSha: string | null = null

async function redisLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  const client = getRedis()
  if (!client) return null

  try {
    const args = [`sourcely:rl:${key}`, String(limit), String(windowMs)]

    let raw: unknown
    if (scriptSha) {
      try {
        raw = await client.evalsha(scriptSha, 1, ...args)
      } catch (error) {
        // Redis was restarted or its script cache flushed. Reload and retry
        // once; anything else is a real error and propagates.
        if (!String(error).includes('NOSCRIPT')) throw error
        scriptSha = null
      }
    }

    if (!scriptSha) {
      scriptSha = await client.script('LOAD', BUCKET_SCRIPT) as string
      raw = await client.evalsha(scriptSha, 1, ...args)
    }

    const [allowed, remaining, retryAfterMs] = raw as [number, number, number]

    return {
      ok: allowed === 1,
      remaining: Math.max(0, remaining),
      retryAfter: Math.ceil(retryAfterMs / 1000),
      backend: 'redis',
    }
  } catch (error) {
    console.error('[rate-limit] redis unavailable, falling back to in-process:', error)
    return null
  }
}

/* -------------------------------------------------------------------------- */

/**
 * @param key      identity being limited, e.g. `login:203.0.113.4`
 * @param limit    tokens per window
 * @param windowMs refill window
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (isRedisConfigured()) {
    const distributed = await redisLimit(key, limit, windowMs)
    if (distributed) return distributed
  }
  return memoryLimit(key, limit, windowMs)
}

/** Which backend the next call will try. For the admin settings page. */
export function rateLimitBackend(): 'memory' | 'redis' {
  return isRedisConfigured() ? 'redis' : 'memory'
}

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is trivially spoofable unless a trusted proxy sets it, so
 * this is a mitigation against casual abuse and not an authentication signal.
 * Never use it for authorisation.
 */
export async function clientIdentifier(): Promise<string> {
  const headerList = await headers()
  const forwarded = headerList.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown'
  return headerList.get('x-real-ip') ?? 'local'
}

function envLimit(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const LIMITS = {
  /** Login attempts per IP. Deliberately tight — this is the brute-force surface. */
  login: { limit: 10, windowMs: 10 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  get assistant() {
    return { limit: envLimit('RATE_LIMIT_AI_PER_MINUTE', 20), windowMs: 60_000 }
  },
  get api() {
    return { limit: envLimit('RATE_LIMIT_API_PER_MINUTE', 120), windowMs: 60_000 }
  },
  get upload() {
    return { limit: envLimit('RATE_LIMIT_UPLOAD_PER_HOUR', 40), windowMs: 60 * 60_000 }
  },
} as const
