import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// ── Redis Client (lazy singleton) ──────────────────────────
let redisInstance: Redis | null = null

export const getRedis = (): Redis => {
  if (redisInstance) return redisInstance
  redisInstance = Redis.fromEnv()
  return redisInstance
}

/**
 * Check whether Upstash env vars are available.
 * When missing (e.g. local dev without Redis) the cache/rate-limit
 * layers degrade gracefully — callers should check this before
 * attempting Redis operations.
 */
export const isRedisConfigured = (): boolean => {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

// ── Cache Layer ────────────────────────────────────────────
const CACHE_PREFIX = 'tc:'
const DEFAULT_TTL = 300 // 5 minutes (seconds)

export type CachedCheckResult = {
  status: string
  platform: string
  metadata: Record<string, any> | null
}

export const getFromCache = async (url: string): Promise<CachedCheckResult | null> => {
  if (!isRedisConfigured()) return null
  try {
    const redis = getRedis()
    return await redis.get<CachedCheckResult>(`${CACHE_PREFIX}${url}`)
  } catch (err) {
    console.error('[Redis] Cache read failed:', err)
    return null
  }
}

export const setInCache = async (
  url: string,
  data: CachedCheckResult,
  ttl = DEFAULT_TTL
): Promise<void> => {
  if (!isRedisConfigured()) return
  try {
    const redis = getRedis()
    await redis.set(`${CACHE_PREFIX}${url}`, data, { ex: ttl })
  } catch (err) {
    console.error('[Redis] Cache write failed:', err)
  }
}

export const deleteFromCache = async (url: string): Promise<void> => {
  if (!isRedisConfigured()) return
  try {
    const redis = getRedis()
    await redis.del(`${CACHE_PREFIX}${url}`)
  } catch (err) {
    console.error('[Redis] Cache delete failed:', err)
  }
}

export const getCacheSize = async (): Promise<number> => {
  if (!isRedisConfigured()) return 0
  try {
    const redis = getRedis()
    // DBSIZE returns total keys in the Redis database
    return await redis.dbsize()
  } catch {
    return 0
  }
}

// ── Rate Limiters ──────────────────────────────────────────
let singleCheckLimiter: Ratelimit | null = null
let batchCheckLimiter: Ratelimit | null = null
let validateLimiter: Ratelimit | null = null

/**
 * Single link check: 30 requests / 1 minute per IP
 */
export const getSingleCheckLimiter = (): Ratelimit => {
  if (singleCheckLimiter) return singleCheckLimiter
  singleCheckLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'rl:single',
  })
  return singleCheckLimiter
}

/**
 * Batch link check: 10 requests / 1 minute per IP
 */
export const getBatchCheckLimiter = (): Ratelimit => {
  if (batchCheckLimiter) return batchCheckLimiter
  batchCheckLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: true,
    prefix: 'rl:batch',
  })
  return batchCheckLimiter
}

/**
 * Revalidation: 5 requests / 1 minute per IP (heavy operation)
 */
export const getValidateLimiter = (): Ratelimit => {
  if (validateLimiter) return validateLimiter
  validateLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    analytics: true,
    prefix: 'rl:validate',
  })
  return validateLimiter
}

/**
 * Apply rate limiting for a given identifier and limiter type.
 * Returns { allowed, headers } so the caller can set response headers.
 * Fails open — if Redis is down, requests are allowed through.
 */
export const checkRateLimit = async (
  identifier: string,
  type: 'single' | 'batch' | 'validate'
): Promise<{
  allowed: boolean
  limit: number
  remaining: number
  reset: number
}> => {
  if (!isRedisConfigured()) {
    return { allowed: true, limit: 0, remaining: 0, reset: 0 }
  }

  try {
    const limiter =
      type === 'batch'
        ? getBatchCheckLimiter()
        : type === 'validate'
          ? getValidateLimiter()
          : getSingleCheckLimiter()

    const { success, limit, remaining, reset } = await limiter.limit(identifier)
    return { allowed: success, limit, remaining, reset }
  } catch (err) {
    console.error('[RateLimit] Redis error, allowing request (fail-open):', err)
    return { allowed: true, limit: 0, remaining: 0, reset: 0 }
  }
}

// ── Singleflight (in-process request deduplication) ────────
// Prevents duplicate concurrent fetches for the same URL within
// a single serverless instance. Cross-instance dedup is handled
// by the Redis cache layer (first instance to finish caches the
// result, subsequent instances get a cache hit).
const inflight = new Map<string, Promise<any>>()

export const singleflight = async <T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> => {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>

  const promise = fn().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, promise)
  return promise
}

// ── Redis Stats Helpers ────────────────────────────────────
// Fast atomic counters in Redis. These complement (not replace)
// the Postgres stats — use for real-time dashboards or to reduce
// Postgres write pressure by batching.
const STATS_HASH = 'tc:stats:all'

export const incrementRedisStat = async (key: string, amount = 1): Promise<void> => {
  if (!isRedisConfigured()) return
  try {
    const redis = getRedis()
    await redis.hincrby(STATS_HASH, key, amount)
  } catch (err) {
    console.error('[Redis] Stats INCR failed:', err)
  }
}

/**
 * Check if a URL has already been counted for stats in the last 24 hours.
 * Uses a Redis key per URL with a 24-hour TTL (86400 seconds).
 * Returns true if this is a NEW (unique) URL in the last 24h, false if already counted.
 */
export const isUniqueCheck24h = async (url: string): Promise<boolean> => {
  if (!isRedisConfigured()) return true // If no Redis, always count (fallback)
  try {
    const redis = getRedis()
    const key = `tc:dedup:24h:${url}`
    // SET with NX (only set if not exists) and EX 86400 (24 hours)
    // returns "OK" if set successfully (unique), null if already existed
    const result = await redis.set(key, '1', { nx: true, ex: 86400 })
    return result === 'OK'
  } catch {
    return true // Fail open — count it if Redis errors
  }
}

export const getRedisStats = async (): Promise<Record<string, number>> => {
  if (!isRedisConfigured()) return {}
  try {
    const redis = getRedis()
    const data = await redis.hgetall<Record<string, string>>(STATS_HASH)
    if (!data) return {}
    const result: Record<string, number> = {}
    for (const [k, v] of Object.entries(data)) {
      result[k] = parseInt(v, 10) || 0
    }
    return result
  } catch (err) {
    console.error('[Redis] Stats GET failed:', err)
    return {}
  }
}

// ── QStash Async Messaging ─────────────────────────────────
import { Client as QStashClient } from '@upstash/qstash'

let qstashInstance: QStashClient | null = null

export const getQStash = (): QStashClient | null => {
  if (qstashInstance) return qstashInstance
  const token = process.env.QSTASH_TOKEN
  if (!token) return null
  qstashInstance = new QStashClient({ token })
  return qstashInstance
}

export const isQStashConfigured = (): boolean => {
  return !!process.env.QSTASH_TOKEN
}

export type QStashBatchMessage = {
  jobId: string
  links: string[]
  contributorId: number | null
}

export const publishBatchJob = async (
  jobId: string,
  linksChunk: string[],
  contributorId: number | null,
  reqUrl: string
): Promise<boolean> => {
  const qstash = getQStash()
  if (!qstash) return false

  try {
    // Construct absolute URL for the worker webhook
    const urlObj = new URL(reqUrl)
    const workerUrl = `${urlObj.protocol}//${urlObj.host}/api/worker/batch`

    await qstash.publishJSON({
      url: workerUrl,
      body: {
        jobId,
        links: linksChunk,
        contributorId,
      } satisfies QStashBatchMessage,
    })
    return true
  } catch (err) {
    console.error('[QStash] Publish failed:', err)
    return false
  }
}
