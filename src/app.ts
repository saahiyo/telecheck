import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import {
  saveLink,
  getLinks,
  getLinkCount,
  incrementStat,
  getStats,
  get24hStats,
  deleteLinks,
  getOrCreateContributor,
  getContributorLeaderboard,
  getContributorCount,
  getContributorByIdentity,
  getContributorRankById,
  getContributorActiveLinkCount,
  updateLinkTags,
  getUniqueTags,
  initDB,
  getContributorByRecoveryKey,
  updateContributorIdentity,
  createJob,
  getJob,
  updateJobProgress,
  completeJob,
  getOrCreateFirebaseContributor,
  linkContributorToFirebaseByRecoveryKey,
} from './db.js'
import { observabilityMiddleware, getMetrics, logError } from './observability.js'
import { verifyFirebaseToken } from './auth.js'
import {
  getFromCache,
  getCacheSize,
  checkRateLimit,
  getRedisStats,
  isRedisConfigured,
  publishBatchJob,
  isQStashConfigured,
  isUniqueCheck24h,
  type QStashBatchMessage,
} from './redis.js'
import {
  httpCheck,
  normalize,
  getClientIp,
  getContributorIdentityInput,
  getIdentityValue,
  getRateLimitHeaders,
} from './checkers.js'
import type {
  BatchRequestBody,
  BatchResultItem,
  ContributorIdentityPayload,
  HttpCheckResult,
  RevalidationAction,
  RevalidationResultItem,
  LinkRow,
} from './types.js'

const app = new Hono()

let dbInitPromise: Promise<void> | null = null
const ensureDbReady = async () => {
  if (!dbInitPromise) {
    dbInitPromise = initDB().catch((error) => {
      dbInitPromise = null
      throw error
    })
  }
  await dbInitPromise
}

app.use('*', logger())
app.use('*', observabilityMiddleware)

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*'
      if (origin.startsWith('http://localhost')) return origin
      if (origin.startsWith('http://127.0.0.1')) return origin
      return '*'
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
    credentials: false,
  })
)

const getFirebaseUserFromRequest = async (c: any): Promise<{ uid: string; email: string | null } | null> => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  return verifyFirebaseToken(token)
}

const requireFirebaseUser = async (c: any) => {
  const firebaseUser = await getFirebaseUserFromRequest(c)
  if (!firebaseUser) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  return firebaseUser
}

const resolveContributor = async (c: any, body?: ContributorIdentityPayload) => {
  await ensureDbReady()
  const identity = await getContributorIdentityInput(c, body)

  const firebaseUser = await getFirebaseUserFromRequest(c)
  if (firebaseUser) {
    return getOrCreateFirebaseContributor(firebaseUser.uid, firebaseUser.email, identity)
  }

  return getOrCreateContributor(identity)
}

const resolveContributorId = async (c: any, body?: ContributorIdentityPayload): Promise<number | null> => {
  try {
    const contributor = await resolveContributor(c, body)
    return contributor.id as number
  } catch {
    return null
  }
}

const findContributorForRequest = async (c: any) => {
  await ensureDbReady()
  const identity = await getContributorIdentityInput(c)

  const firebaseUser = await getFirebaseUserFromRequest(c)
  if (firebaseUser) {
    return getOrCreateFirebaseContributor(firebaseUser.uid, firebaseUser.email, identity)
  }

  return getContributorByIdentity(identity)
}

app.onError((err, c) => {
  logError('app.error', {
    method: c.req.method,
    path: c.req.path,
    message: err.message,
  })
  return c.json(
    {
      error: err.message || 'Internal Server Error',
      path: c.req.path,
      timestamp: new Date().toISOString(),
    },
    500
  )
})

app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      path: c.req.path,
      availableEndpoints: ['/', '/links', '/links/stats', '/health', '/info', '/stats', '/normalize'],
    },
    404
  )
})

const startedAt = Date.now()
const getPositiveIntEnv = (name: string, fallback: number): number => {
  const value = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}
const QSTASH_CHUNK_SIZE = getPositiveIntEnv('QSTASH_CHUNK_SIZE', 50)
const QSTASH_PUBLISH_CONCURRENCY = getPositiveIntEnv('QSTASH_PUBLISH_CONCURRENCY', 8)
const QSTASH_WORKER_CONCURRENCY = getPositiveIntEnv('QSTASH_WORKER_CONCURRENCY', 8)
const QSTASH_WORKER_DELAY_MS = Math.max(0, Number.parseInt(process.env.QSTASH_WORKER_DELAY_MS || '50', 10) || 0)

const REVALIDATION_CONCURRENCY = 4
const REVALIDATION_RETRY_DELAY_MS = 800
const REVALIDATION_MAX_LINKS = 100
const REVALIDATION_DEADLINE_MS = 25_000

const runRevalidation = async (platform?: string, limitQuery: string = '50', offset: number = 0) => {
  const isAll = limitQuery.toLowerCase() === 'all'
  const parsedLimit = parseInt(limitQuery, 10)
  const numericLimit = Number.isNaN(parsedLimit) ? 50 : parsedLimit
  const limit = isAll ? REVALIDATION_MAX_LINKS : Math.min(Math.max(numericLimit, 1), REVALIDATION_MAX_LINKS)

  const links = await getLinks({ platform: platform || undefined, limit, offset })

  if (!links.length) {
    return { message: 'No links found to validate', processed: 0 }
  }

  const deadline = Date.now() + REVALIDATION_DEADLINE_MS
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const validateStoredLink = async (url: string): Promise<RevalidationResultItem> => {
    const res = await httpCheck(url, { skipCache: true })

    if (res.status === 'valid' || res.status === 'unknown') {
      return { url, action: 'kept' as RevalidationAction, status: res.status }
    }

    if (Date.now() + REVALIDATION_RETRY_DELAY_MS + 10000 < deadline) {
      await delay(REVALIDATION_RETRY_DELAY_MS)
      const retryRes = await httpCheck(url, { skipCache: true })

      if (retryRes.status === 'valid' || retryRes.status === 'unknown') {
        return { url, action: 'kept' as RevalidationAction, status: retryRes.status }
      }

      return { url, action: 'deleted' as RevalidationAction, status: retryRes.status }
    }

    return { url, action: 'deleted' as RevalidationAction, status: res.status }
  }

  const results: RevalidationResultItem[] = []
  let processedIndex = 0

  for (let i = 0; i < links.length; i += REVALIDATION_CONCURRENCY) {
    if (Date.now() >= deadline) break

    const chunk = links.slice(i, i + REVALIDATION_CONCURRENCY)
    const chunkResults = await Promise.all(chunk.map((link) => validateStoredLink((link as LinkRow).url)))
    results.push(...chunkResults)
    processedIndex = i + chunk.length
  }

  const invalidUrls = results.filter(r => r.action === 'deleted').map(r => r.url)

  if (invalidUrls.length > 0) {
    await deleteLinks(invalidUrls).catch(() => {})
  }

  const kept = results.filter(r => r.action === 'kept')
  const deleted = results.filter(r => r.action === 'deleted')
  const unknown = results.filter(r => r.status === 'unknown')
  const hasMore = processedIndex < links.length || (isAll && links.length === limit)

  return {
    processed: results.length,
    total_fetched: links.length,
    kept: kept.length,
    deleted: deleted.length,
    skipped: unknown.length,
    timed_out: processedIndex < links.length,
    ...(hasMore ? { nextOffset: offset + processedIndex } : {}),
    details: results,
  }
}

app.get('/', async (c) => {
  const start = Date.now()
  const link = c.req.query('link')

  if (!link) {
    return c.json({
      api: 'Link Checker API',
      supported: ['telegram', 'mega'],
      endpoints: {
        single: '/?link=<link>',
        multiple: 'POST / → { links: [] }',
        links: '/links?platform=<platform>&limit=<n>',
        linksStats: '/links/stats',
        contributors: '/contributors',
        myProfile: '/contributors/me',
        health: '/health',
        stats: '/stats',
        normalize: '/normalize?value=<input>',
        info: '/info',
      },
      credits: '@saahiyo',
      responseTime: Date.now() - start,
    })
  }

  const rl = await getRateLimitHeaders(c, 'single')
  if (!rl.allowed) {
    return c.json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
    }, 429)
  }

  const normalized = normalize(link)

  const cached = await getFromCache(normalized)
  if (cached) {
    incrementStat('cacheHits').catch(() => {})
    getRedisStats() // no-op to keep import used? no; not needed
    return c.json({
      input: link,
      normalized,
      ...cached,
      cached: true,
      credits: '@saahiyo',
      responseTime: Date.now() - start,
    })
  }

  incrementStat('cacheMisses').catch(() => {})

  const contributorIdPromise = resolveContributorId(c)

  const result = await httpCheck(normalized, {
    knownCacheMiss: true,
    removeInvalidStored: true,
    saveValidResult: false,
  })

  if (result.status === 'valid') {
    const contributorId = await contributorIdPromise
    saveLink(normalized, result.platform, result.status, result.metadata, contributorId).catch(() => {})
  }

  return c.json({
    input: link,
    normalized,
    ...result,
    credits: '@saahiyo',
    responseTime: Date.now() - start,
  })
})

app.post('/', async (c) => {
  const firebaseUser = await requireFirebaseUser(c)
  if (!firebaseUser || 'status' in firebaseUser) return firebaseUser

  const start = Date.now()
  let body: BatchRequestBody = {}

  try {
    body = await c.req.json<BatchRequestBody>()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const links = Array.isArray(body.links) ? body.links : []
  if (links.length === 0) {
    return c.json({ error: 'Provide { links: [...] }' }, 400)
  }

  const rl = await getRateLimitHeaders(c, 'batch')
  if (!rl.allowed) {
    return c.json({
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
    }, 429)
  }

  const contributorIdPromise = resolveContributorId(c, body)

  const normalized = Array.from(new Set(links.filter((value): value is string => typeof value === 'string').map(normalize).filter(Boolean)))

  const isAsyncRequested = c.req.query('async') === 'true'
  const isLargeBatch = normalized.length > 25

  if (isQStashConfigured() && (isLargeBatch || isAsyncRequested)) {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    await ensureDbReady()
    const [, contributorId] = await Promise.all([createJob(jobId, normalized.length), contributorIdPromise])

    const chunks: string[][] = []
    for (let i = 0; i < normalized.length; i += QSTASH_CHUNK_SIZE) {
      chunks.push(normalized.slice(i, i + QSTASH_CHUNK_SIZE))
    }

    let publishedCount = 0
    for (let i = 0; i < chunks.length; i += QSTASH_PUBLISH_CONCURRENCY) {
      const publishBatch = chunks.slice(i, i + QSTASH_PUBLISH_CONCURRENCY)
      const outcomes = await Promise.all(publishBatch.map((chunk) => publishBatchJob(jobId, chunk, contributorId, c.req.url)))
      publishedCount += outcomes.filter(Boolean).length
    }

    if (publishedCount === 0) {
      await completeJob(jobId, 'Failed to publish to QStash queue')
    } else {
      return c.json({
        jobId,
        status: 'queued',
        message: `Batch is processing asynchronously in ${publishedCount} chunks. Poll /jobs/${jobId} for results.`,
        total_links: normalized.length,
        credits: '@saahiyo',
        responseTime: Date.now() - start,
      }, 202)
    }
  }

  const contributorId = await contributorIdPromise
  const syncLinks = normalized.slice(0, 50)
  const truncated = normalized.length > 50

  const results: BatchResultItem[] = await Promise.all(
    syncLinks.map(async (url) => {
      const res = await httpCheck(url, {
        contributorId,
        removeInvalidStored: true,
      })
      return { url, ...res }
    })
  )

  const valid = results.filter(r => r.status === 'valid')
  const invalid = results.filter(r => r.status === 'invalid')
  const unknown = results.filter(r => r.status === 'unknown')

  return c.json({
    total: results.length,
    truncated,
    ...(truncated ? { warning: 'Batch truncated to 50 links to prevent serverless timeout. Configure QStash for unlimited async batching.' } : {}),
    groups: { valid, invalid, unknown },
    credits: '@saahiyo',
    responseTime: Date.now() - start,
  })
})

app.get('/jobs/:id', async (c) => {
  const id = c.req.param('id')
  await ensureDbReady()
  const job = await getJob(id)
  if (!job) {
    return c.json({ error: 'Job not found' }, 404)
  }
  return c.json(job)
})

app.post('/api/worker/batch', async (c) => {
  try {
    const { jobId, links, contributorId } = await c.req.json<QStashBatchMessage>()
    if (!jobId || !Array.isArray(links)) {
      return c.json({ error: 'Invalid worker payload' }, 400)
    }

    await ensureDbReady()
    const job = await getJob(jobId)
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return c.json({ message: 'Job already finished or invalid' })
    }

    const results: BatchResultItem[] = []
    let validCount = 0
    let invalidCount = 0
    let unknownCount = 0

    for (let i = 0; i < links.length; i += QSTASH_WORKER_CONCURRENCY) {
      const batch = links.slice(i, i + QSTASH_WORKER_CONCURRENCY)
      const batchResults = await Promise.all(
        batch.map(async (url) => {
          const res = await httpCheck(url, { contributorId, removeInvalidStored: true })
          return { url, ...res }
        })
      )

      for (const res of batchResults) {
        results.push(res)
        if (res.status === 'valid') validCount++
        else if (res.status === 'invalid') invalidCount++
        else unknownCount++
      }

      if (QSTASH_WORKER_DELAY_MS > 0 && i + QSTASH_WORKER_CONCURRENCY < links.length) {
        await new Promise(r => setTimeout(r, QSTASH_WORKER_DELAY_MS))
      }
    }

    await updateJobProgress(jobId, links.length, validCount, invalidCount, unknownCount, results)

    const updatedJob = await getJob(jobId)
    if (updatedJob && updatedJob.processed_links >= updatedJob.total_links) {
      await completeJob(jobId)
    }

    return c.json({ success: true, processed: links.length })
  } catch (err: any) {
    logError('worker.batch.failed', {
      jobId: c.req.header('x-request-id') || 'unknown',
      message: err.message || 'Worker failure',
    })
    return c.json({ error: err.message || 'Worker failure' }, 500)
  }
})

app.get('/health', (c) => {
  return c.json({ status: 'ok', uptime_ms: Date.now() - startedAt })
})

app.get('/metrics', (c) => {
  return c.json({
    ...getMetrics(),
    uptime_ms: Date.now() - startedAt,
  })
})

app.get('/info', (c) => {
  return c.json({
    name: 'Link Checker API',
    version: '2.0.0',
    supported: ['telegram', 'mega'],
    runtime: 'Vercel Edge',
    author: '@saahiyo',
    endpoints: {
      singleCheck: '/?link=<value>',
      batchCheck: 'POST / → { links: [] }',
      storedLinks: '/links?platform=<platform>&limit=<n>',
      linksStats: '/links/stats',
      revalidateLinks: 'POST /links/validate?limit=all',
      health: '/health',
      stats: '/stats',
      normalize: '/normalize?value=<input>',
    },
  })
})

app.get('/normalize', (c) => {
  const value = c.req.query('value')
  if (!value) return c.json({ error: 'Missing ?value=' })

  return c.json({
    input: value,
    normalized: normalize(value),
  })
})

app.get('/stats', async (c) => {
  const period = c.req.query('period')
  const dbStats = period === '24h' ? await get24hStats() : await getStats()
  const redisCacheSize = await getCacheSize()
  const redisStats = await getRedisStats()
  return c.json({
    uptime_ms: Date.now() - startedAt,
    ...dbStats,
    redis: {
      configured: isRedisConfigured(),
      cacheKeys: redisCacheSize,
      counters: redisStats,
    },
  })
})

app.get('/links', async (c) => {
  const platform = c.req.query('platform')
  const search = c.req.query('search')
  const tag = c.req.query('tag')
  const username = c.req.query('username') || c.req.query('user')
  const limitQuery = c.req.query('limit') || '50'
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0
  const validate = c.req.query('validate') !== undefined

  if (validate) {
    const rl = await getRateLimitHeaders(c, 'validate')
    if (!rl.allowed) {
      return c.json({
        error: 'Too many requests. Revalidation is a heavy operation.',
        retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
      }, 429)
    }

    const result = await runRevalidation(platform || undefined, limitQuery, offset)
    return c.json(result)
  }

  const isAll = limitQuery.toLowerCase() === 'all'
  const limit = isAll ? 100000 : (parseInt(limitQuery, 10) || 50)

  const links = await getLinks({
    platform: platform || undefined,
    search: search || undefined,
    tag: tag || undefined,
    username: username || undefined,
    limit,
    offset,
  })
  const total = await getLinkCount(platform || undefined, search || undefined, tag || undefined, username || undefined)

  return c.json({
    total,
    limit: isAll ? 'all' : limit,
    offset,
    links,
  })
})

const handleLinksValidateRequest = async (platform?: string, limitQuery: string = '100', offset: number = 0) => {
  return runRevalidation(platform || undefined, limitQuery, offset)
}

app.get('/links/validate', async (c) => {
  const firebaseUser = await requireFirebaseUser(c)
  if (!firebaseUser || 'status' in firebaseUser) return firebaseUser

  const rl = await getRateLimitHeaders(c, 'validate')
  if (!rl.allowed) {
    return c.json({
      error: 'Too many requests. Revalidation is a heavy operation.',
      retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
    }, 429)
  }

  const platform = c.req.query('platform')
  const limitQuery = c.req.query('limit') || '100'
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0

  const result = await handleLinksValidateRequest(platform, limitQuery, offset)
  return c.json(result)
})

app.post('/links/validate', async (c) => {
  const firebaseUser = await requireFirebaseUser(c)
  if (!firebaseUser || 'status' in firebaseUser) return firebaseUser

  const rl = await getRateLimitHeaders(c, 'validate')
  if (!rl.allowed) {
    return c.json({
      error: 'Too many requests. Revalidation is a heavy operation.',
      retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
    }, 429)
  }

  const platform = c.req.query('platform')
  const limitQuery = c.req.query('limit') || '100'
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0

  const result = await handleLinksValidateRequest(platform, limitQuery, offset)
  return c.json(result)
})

app.get('/tags', async (c) => {
  const tags = await getUniqueTags()
  return c.json({ tags })
})

app.post('/links/tags', async (c) => {
  try {
    const firebaseUser = await requireFirebaseUser(c)
    if (!firebaseUser || 'status' in firebaseUser) return firebaseUser

    const { url, tags } = await c.req.json<{ url: string; tags: string[] }>()
    if (!url || !Array.isArray(tags)) {
      return c.json({ error: 'Invalid payload: expected { url: string, tags: string[] }' }, 400)
    }

    if (!url.startsWith('http')) {
      return c.json({ error: 'Invalid URL format' }, 400)
    }

    await updateLinkTags(url, tags)
    return c.json({ success: true, url, tags })
  } catch (error) {
    console.error('Error updating tags:', error)
    return c.json({ error: 'Failed to update tags' }, 500)
  }
})

app.get('/links/stats', async (c) => {
  const total = await getLinkCount()
  const telegram = await getLinkCount('telegram')
  const mega = await getLinkCount('mega')

  return c.json({ total, telegram, mega })
})

app.get('/contributors', async (c) => {
  const limitQuery = c.req.query('limit') || '20'
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0
  const limit = Math.min(parseInt(limitQuery, 10) || 20, 100)

  const contributors = await getContributorLeaderboard(limit, offset)
  const total = await getContributorCount()

  return c.json({
    total,
    limit,
    offset,
    contributors: contributors.map((c: any, i: number) => ({
      rank: offset + i + 1,
      username: c.username,
      links_added: parseInt(c.links_added as string, 10) || 0,
      first_seen: c.first_seen,
      last_seen: c.last_seen,
    })),
  })
})

app.get('/contributors/me', async (c) => {
  try {
    const contributor = await findContributorForRequest(c)

    if (!contributor) {
      return c.json({ username: null, links_added: 0, rank: null })
    }

    const contributorId = contributor.id as number
    const rank = await getContributorRankById(contributorId)
    const activeLinksCount = await getContributorActiveLinkCount(contributorId)

    return c.json({
      username: contributor.username,
      recovery_key: contributor.recovery_key,
      links_added: activeLinksCount,
      rank,
      first_seen: contributor.first_seen,
      last_seen: contributor.last_seen,
    })
  } catch {
    return c.json({ username: null, links_added: 0, rank: null })
  }
})

app.post('/contributors/recover', async (c) => {
  try {
    const body = await c.req.json<ContributorIdentityPayload>()
    const recoveryKey = getIdentityValue(body.recovery_key)
    if (!recoveryKey) {
      return c.json({ error: 'Recovery key is required' }, 400)
    }

    await ensureDbReady()
    const contributor = await getContributorByRecoveryKey(recoveryKey)
    if (!contributor) {
      return c.json({ error: 'Invalid recovery key' }, 404)
    }

    const identity = await getContributorIdentityInput(c, body)
    const updatedContributor = await updateContributorIdentity(contributor.id as number, identity.ipHash, identity.deviceId)

    const activeLinksCount = await getContributorActiveLinkCount(updatedContributor.id as number)

    return c.json({
      success: true,
      message: `Welcome back, ${updatedContributor.username}!`,
      username: updatedContributor.username,
      recovery_key: updatedContributor.recovery_key,
      links_added: activeLinksCount,
    })
  } catch {
    return c.json({ error: 'Recovery failed' }, 500)
  }
})

app.post('/contributors/link-firebase', async (c) => {
  try {
    const firebaseUser = await requireFirebaseUser(c)
    if (!firebaseUser || 'status' in firebaseUser) return firebaseUser

    const body = await c.req.json<any>()
    const recoveryKey = getIdentityValue(body.recovery_key)
    if (!recoveryKey) {
      return c.json({ error: 'Recovery key is required' }, 400)
    }

    await ensureDbReady()
    const result = await linkContributorToFirebaseByRecoveryKey(recoveryKey, firebaseUser.uid, firebaseUser.email)

    if (!result.success) {
      return c.json({ error: result.error }, 400)
    }

    return c.json({
      success: true,
      message: result.merged ? `Successfully merged account into ${result.username}!` : 'Successfully linked account!',
    })
  } catch (err: any) {
    return c.json({ error: err.message || 'Linking failed' }, 500)
  }
})

export default app
