import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { saveLink, getLinks, getLinkCount, incrementStat, getStats, get24hStats, deleteLinks, getOrCreateContributor, getContributorLeaderboard, getContributorCount, getContributorByIdentity, getContributorRankById, getContributorActiveLinkCount, updateLinkTags, getUniqueTags, initDB, getContributorByRecoveryKey, updateContributorIdentity } from './db.js'

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

// Request Logging
app.use('*', logger())

type Platform = 'telegram' | 'mega' | 'unknown'
type CheckStatus = 'valid' | 'invalid' | 'expired' | 'unknown'

type TelegramEntityType = 'channel' | 'group' | 'user'
type MegaEntityType = 'folder' | 'file' | 'chat' | 'unknown'

type TelegramMetadata = {
  title: string | null
  description: string | null
  photo: string | null
  type: TelegramEntityType | null
  memberCount: number | null
  memberCountRaw: string | null
}

type MegaMetadata = {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  type: MegaEntityType | null
}

type GenericMetadata = {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

type LinkMetadata = TelegramMetadata | MegaMetadata | GenericMetadata | null

type TelegramCheckResult = {
  status: 'valid' | 'invalid'
  platform: 'telegram'
  metadata: TelegramMetadata | null
}

type MegaCheckResult = {
  status: 'valid' | 'invalid' | 'expired'
  platform: 'mega'
  metadata: MegaMetadata | null
}

type UnknownCheckResult = {
  status: 'valid' | 'invalid'
  platform: 'unknown'
  metadata: GenericMetadata | null
}

type CheckResult =
  | TelegramCheckResult
  | MegaCheckResult
  | UnknownCheckResult
  | {
      status: 'unknown'
      platform: Platform
      metadata: null
    }

type HttpCheckResult = CheckResult & {
  cached: boolean
}

type CacheEntry = {
  data: CheckResult
  expiresAt: number
}

type ContributorIdentityPayload = {
  contributor_id?: unknown
  device_id?: unknown
  recovery_key?: unknown
  contributor_username?: unknown
}

type BatchRequestBody = ContributorIdentityPayload & {
  links?: unknown
}

type BatchResultItem = HttpCheckResult & {
  url: string
}

type RevalidationAction = 'kept' | 'deleted'

type RevalidationResultItem = {
  url: string
  action: RevalidationAction
  status: CheckStatus
}

type LinkRow = {
  url: string
}

type HttpCheckOptions = {
  skipCache?: boolean
  contributorId?: number | null
  removeInvalidStored?: boolean
}

type FetchTargetValidation =
  | { ok: true; platform: Platform }
  | { ok: false; platform: Platform; reason: string }

// --------------------------------------------
// CORS (Allow localhost development)
// --------------------------------------------
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*' // mobile apps / curl
      if (origin.startsWith('http://localhost')) return origin
      if (origin.startsWith('http://127.0.0.1')) return origin
      return '*'  // fallback allow all
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
    credentials: false
  })
)

// --------------------------------------------
// IP HASH HELPER (SHA-256 via Web Crypto API)
// --------------------------------------------
const hashIp = async (ip: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + '_telecheck_salt_v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const getClientIp = (c: any): string => {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    'unknown'
  )
}

const getClientIpHash = async (c: any): Promise<string> => {
  const ip = getClientIp(c)
  return hashIp(ip)
}

const getIdentityValue = (value: unknown, maxLength = 128): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

const getContributorIdentityInput = async (c: any, body?: ContributorIdentityPayload) => {
  const deviceId =
    getIdentityValue(body?.device_id) ||
    getIdentityValue(body?.contributor_id) ||
    getIdentityValue(c.req.query('device_id')) ||
    getIdentityValue(c.req.query('contributor_id'))
  const recoveryKey = getIdentityValue(body?.recovery_key) || getIdentityValue(c.req.query('recovery_key'))

  return {
    ipHash: await getClientIpHash(c),
    deviceId,
    recoveryKey
  }
}

const resolveContributor = async (c: any, body?: ContributorIdentityPayload) => {
  await ensureDbReady()
  const identity = await getContributorIdentityInput(c, body)
  return getOrCreateContributor(identity)
}

const findContributorForRequest = async (c: any) => {
  await ensureDbReady()
  const identity = await getContributorIdentityInput(c)
  return getContributorByIdentity(identity)
}

// --------------------------------------------
// CENTRALIZED ERROR HANDLER
// --------------------------------------------
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.url}:`, err.message)
  return c.json({
    error: err.message || 'Internal Server Error',
    path: c.req.path,
    timestamp: new Date().toISOString()
  }, 500)
})

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    path: c.req.path,
    availableEndpoints: ['/', '/links', '/links/stats', '/health', '/info', '/stats', '/normalize']
  }, 404)
})

// --------------------------------------------
// UPTIME TRACKER (in-memory only — resets on restart)
// --------------------------------------------
const startedAt = Date.now()

// --------------------------------------------
// IN-MEMORY CACHE (5 min TTL)
// --------------------------------------------
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_URL_LENGTH = 2048
const MAX_FETCH_BYTES = 1024 * 1024
const ALLOWED_FETCH_HOSTS = new Set(['t.me', 'telegram.me', 'telegram.org', 'mega.nz', 'mega.co.nz'])
const cache = new Map<string, CacheEntry>()

const getCached = (key: string): CheckResult | null => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

const setCache = (key: string, data: CheckResult): void => {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL })
}

const shouldRemoveStoredLink = (status: CheckStatus): boolean => {
  return status === 'invalid' || status === 'expired'
}

const removeStoredLinkIfInvalid = (url: string, result: CheckResult): void => {
  if (!shouldRemoveStoredLink(result.status)) return

  deleteLinks([url]).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[WARN] Failed to remove invalid stored link ${url}:`, message)
  })
}

// --------------------------------------------
// PLATFORM DETECTION
// --------------------------------------------
const normalizeHostname = (hostname: string): string => {
  return hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
}

const detectPlatform = (url: string): Platform => {
  try {
    const u = new URL(url)
    const host = normalizeHostname(u.hostname)
    if (host === 't.me' || host === 'telegram.me' || host === 'telegram.org') return 'telegram'
    if (host === 'mega.nz' || host === 'mega.co.nz') return 'mega'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

const isPrivateHostname = (hostname: string): boolean => {
  const host = normalizeHostname(hostname)
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return true

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number)
    if (parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
    const [a, b] = parts
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }

  return host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')
}

const validateFetchTarget = (url: string): FetchTargetValidation => {
  const platform = detectPlatform(url)

  if (!url || url.length > MAX_URL_LENGTH) {
    return { ok: false, platform, reason: 'URL is empty or too long' }
  }

  try {
    const parsed = new URL(url)
    const hostname = normalizeHostname(parsed.hostname)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, platform, reason: 'Unsupported URL protocol' }
    }

    if (parsed.username || parsed.password) {
      return { ok: false, platform, reason: 'URL credentials are not allowed' }
    }

    if (isPrivateHostname(hostname)) {
      return { ok: false, platform, reason: 'Private or local host is not allowed' }
    }

    if (!ALLOWED_FETCH_HOSTS.has(hostname) || platform === 'unknown') {
      return { ok: false, platform, reason: 'Only Telegram and MEGA links are supported' }
    }

    return { ok: true, platform }
  } catch {
    return { ok: false, platform, reason: 'Invalid URL' }
  }
}

const readTextWithLimit = async (res: Response): Promise<string> => {
  const contentLength = Number(res.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_FETCH_BYTES) {
    throw new Error('Response body too large')
  }

  if (!res.body) return res.text()

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > MAX_FETCH_BYTES) {
      await reader.cancel().catch(() => {})
      throw new Error('Response body too large')
    }
    text += decoder.decode(value, { stream: true })
  }

  text += decoder.decode()
  return text
}

// --------------------------------------------
// NORMALIZE FUNCTION
// --------------------------------------------
const normalize = (input: string) => {
  let s = input.trim()
  if (!s) return ""

  if (s.startsWith("@")) return `https://t.me/${s.slice(1)}`
  if (/^[A-Za-z0-9_]{5,32}$/.test(s)) return `https://t.me/${s}`
  if (!/^https?:\/\//i.test(s)) s = "https://" + s

  return s
}

// --------------------------------------------
// HTML TEXT EXTRACTION HELPERS
// --------------------------------------------
const extractText = (html: string, className: string): string | null => {
  const regex = new RegExp(`<div[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)</div>`)
  const match = html.match(regex)
  if (!match) return null
  return match[1].replace(/<[^>]+>/g, '').trim()
}

const extractImgSrc = (html: string, className: string): string | null => {
  const regex = new RegExp(`<img[^>]*class="[^"]*${className}[^"]*"[^>]*src="([^"]+)"`)
  const match = html.match(regex)
  return match ? match[1] : null
}

// --------------------------------------------
// GENERIC META TAG EXTRACTION (for non-Telegram)
// --------------------------------------------
const extractMeta = (html: string, property: string): string | null => {
  // Try og: and regular meta tags
  const ogRegex = new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]*)"`, 'i')
  const ogMatch = html.match(ogRegex)
  if (ogMatch) return ogMatch[1]

  const nameRegex = new RegExp(`<meta[^>]*name="${property}"[^>]*content="([^"]*)"`, 'i')
  const nameMatch = html.match(nameRegex)
  if (nameMatch) return nameMatch[1]

  return null
}

const extractPageTitle = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match ? match[1].trim() : null
}

// --------------------------------------------
// TELEGRAM PAGE VALIDATION + METADATA
// --------------------------------------------
const telegramCheck = async (_url: string, html: string): Promise<TelegramCheckResult> => {
  if (html.includes("tgme_page_title")) {
    incrementStat('valid').catch(() => {})

    const title = extractText(html, 'tgme_page_title')
    const description = extractText(html, 'tgme_page_description')
    const extra = extractText(html, 'tgme_page_extra')
    const photo = extractImgSrc(html, 'tgme_page_photo_image')

    // Determine type from extra text (e.g. "5 111 subscribers", "12 members", etc.)
    let type: TelegramEntityType | null = null
    let memberCount: number | null = null
    let memberCountRaw: string | null = null
    if (extra) {
      if (extra.toLowerCase().includes('subscriber')) type = 'channel'
      else if (extra.toLowerCase().includes('member')) type = 'group'
      else if (extra.toLowerCase().includes('online')) type = 'group'
      else type = 'user'
      memberCountRaw = extra
      const digits = extra.replace(/[^\d]/g, '')
      memberCount = digits ? parseInt(digits, 10) : null
    }

    return {
      status: "valid",
      platform: "telegram" as const,
      metadata: {
        title: title || null,
        description: description || null,
        photo: photo || null,
        type,
        memberCount,
        memberCountRaw
      }
    }
  }

  incrementStat('invalid').catch(() => {})
  return { status: "invalid", platform: "telegram" as const, metadata: null }
}

// --------------------------------------------
// MEGA PAGE VALIDATION + METADATA
// --------------------------------------------
const megaCheck = async (url: string, html: string, httpStatus: number): Promise<MegaCheckResult> => {
  const title = extractMeta(html, 'og:title') || extractPageTitle(html)
  const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
  const image = extractMeta(html, 'og:image')
  const siteName = extractMeta(html, 'og:site_name')

  // Detect MEGA link type from URL path
  let type: MegaEntityType | null = null
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    if (path.startsWith('/folder')) type = 'folder'
    else if (path.startsWith('/file')) type = 'file'
    else if (path.startsWith('/chat')) type = 'chat'
    else type = 'unknown'
  } catch {}

  // Detect expired/dead MEGA links — generic placeholder title + no description
  const genericTitles = ['file folder on mega', 'file on mega', 'folder on mega']
  const isExpired = title && genericTitles.includes(title.toLowerCase()) && !description

  if (isExpired) {
    incrementStat('invalid').catch(() => {})
    return {
      status: "expired",
      platform: "mega" as const,
      metadata: {
        title: title || null,
        description: null,
        image: image || null,
        siteName: siteName || null,
        type
      }
    }
  }

  // If we got a meaningful title, treat as valid
  if (title || httpStatus === 200) {
    incrementStat('valid').catch(() => {})
    return {
      status: "valid",
      platform: "mega" as const,
      metadata: {
        title: title || null,
        description: description || null,
        image: image || null,
        siteName: siteName || null,
        type
      }
    }
  }

  incrementStat('invalid').catch(() => {})
  return { status: "invalid", platform: "mega" as const, metadata: null }
}

// --------------------------------------------
// GENERIC CHECK (fallback for unknown platforms)
// --------------------------------------------
const genericCheck = async (_url: string, html: string, httpStatus: number): Promise<UnknownCheckResult> => {
  const title = extractMeta(html, 'og:title') || extractPageTitle(html)
  const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
  const image = extractMeta(html, 'og:image')
  const siteName = extractMeta(html, 'og:site_name')

  if (title || httpStatus === 200) {
    incrementStat('valid').catch(() => {})
    return {
      status: "valid",
      platform: "unknown" as const,
      metadata: {
        title: title || null,
        description: description || null,
        image: image || null,
        siteName: siteName || null
      }
    }
  }

  incrementStat('invalid').catch(() => {})
  return { status: "invalid", platform: "unknown" as const, metadata: null }
}

// --------------------------------------------
// MAIN CHECK ROUTER
// --------------------------------------------
const httpCheck = async (url: string, options: HttpCheckOptions = {}): Promise<HttpCheckResult> => {
  const {
    skipCache = false,
    contributorId = null,
    removeInvalidStored = false
  } = options

  const target = validateFetchTarget(url)
  if (!target.ok) {
    incrementStat('invalid').catch(() => {})
    const result: CheckResult = { status: "invalid", platform: target.platform, metadata: null }
    if (removeInvalidStored) removeStoredLinkIfInvalid(url, result)
    return { ...result, cached: false }
  }

  // Check cache first
  if (!skipCache) {
    const cached = getCached(url)
    if (cached) {
      incrementStat('cacheHits').catch(() => {})
      if (removeInvalidStored) {
        removeStoredLinkIfInvalid(url, cached)
      }
      return { ...cached, cached: true }
    }
  }
  incrementStat('cacheMisses').catch(() => {})

  try {
    const res = await fetch(url, { 
      redirect: "follow",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    })
    const html = await readTextWithLimit(res)
    const platform = target.platform

    incrementStat('totalChecks').catch(() => {})

    let result: CheckResult
    switch (platform) {
      case 'telegram':
        result = await telegramCheck(url, html)
        break
      case 'mega':
        result = await megaCheck(url, html, res.status)
        break
      default:
        result = await genericCheck(url, html, res.status)
        break
    }

    // Save valid links to database (fire & forget)
    if (result.status === 'valid') {
      saveLink(url, result.platform, result.status, result.metadata, contributorId).catch(() => {})
    } else if (removeInvalidStored) {
      removeStoredLinkIfInvalid(url, result)
    }

    setCache(url, result)
    return { ...result, cached: false }

  } catch {
    incrementStat('unknown').catch(() => {})
    return { status: "unknown", platform: detectPlatform(url), metadata: null, cached: false }
  }
}

// --------------------------------------------
// ROOT: /?link=xxxx
// --------------------------------------------
app.get('/', async (c) => {
  const start = Date.now()
  const link = c.req.query("link")

  if (!link) {
    return c.json({
      api: "Link Checker API",
      supported: ["telegram", "mega"],
      endpoints: {
        single: "/?link=<link>",
        multiple: "POST / → { links: [] }",
        links: "/links?platform=<platform>&limit=<n>",
        linksStats: "/links/stats",
        contributors: "/contributors",
        myProfile: "/contributors/me",
        health: "/health",
        stats: "/stats",
        normalize: "/normalize?value=<input>",
        info: "/info"
      },
      credits: "@saahiyo",
      responseTime: Date.now() - start
    })
  }

  // Resolve contributor from stable browser identity first, then IP fallback
  let contributorId: number | null = null
  try {
    const contributor = await resolveContributor(c)
    contributorId = contributor.id as number
  } catch {}

  const normalized = normalize(link)
  const result = await httpCheck(normalized, {
    contributorId,
    removeInvalidStored: true
  })

  return c.json({
    input: link,
    normalized,
    ...result,
    credits: "@saahiyo",
    responseTime: Date.now() - start
  })
})

// --------------------------------------------
// POST /  (Batch checker)
// --------------------------------------------
app.post('/', async (c) => {
  const start = Date.now()
  let body: BatchRequestBody = {}

  try {
    body = await c.req.json<BatchRequestBody>()
  } catch {
    return c.json({ error: "Invalid JSON" }, 400)
  }

  const links = Array.isArray(body.links) ? body.links : []

  if (links.length === 0) {
    return c.json({ error: "Provide { links: [...] }" }, 400)
  }

  // Resolve contributor from stable browser identity first, then IP fallback
  let contributorId: number | null = null
  try {
    const contributor = await resolveContributor(c, body)
    contributorId = contributor.id as number
  } catch {}

  const normalized = Array.from(
    new Set(
      links
        .filter((value): value is string => typeof value === 'string')
        .map(normalize)
        .filter(Boolean)
    )
  )

  const results: BatchResultItem[] = await Promise.all(
    normalized.map(async (url) => {
      const res = await httpCheck(url, {
        contributorId,
        removeInvalidStored: true
      })
      return { url, ...res }
    })
  )

  const valid = results.filter(r => r.status === "valid")
  const invalid = results.filter(r => r.status === "invalid")
  const unknown = results.filter(r => r.status === "unknown")

  return c.json({
    total: results.length,
    groups: { valid, invalid, unknown },
    credits: "@saahiyo",
    responseTime: Date.now() - start
  })
})

// --------------------------------------------
// NEW ROUTES BELOW ↓
// --------------------------------------------

// HEALTH CHECK
app.get('/health', (c) => {
  return c.json({ status: "ok", uptime_ms: Date.now() - startedAt })
})


// API INFO
app.get('/info', (c) => {
  return c.json({
    name: "Link Checker API",
    version: "2.0.0",
    supported: ["telegram", "mega"],
    runtime: "Vercel Edge",
    author: "@saahiyo",
    endpoints: {
      singleCheck: "/?link=<value>",
      batchCheck: "POST / → { links: [] }",
      storedLinks: "/links?platform=<platform>&limit=<n>",
      linksStats: "/links/stats",
      revalidateLinks: "POST /links/validate?limit=all",
      health: "/health",
      stats: "/stats",
      normalize: "/normalize?value=<input>"
    }
  })
})

// NORMALIZATION TEST
app.get('/normalize', (c) => {
  const value = c.req.query("value")
  if (!value) return c.json({ error: "Missing ?value=" })

  return c.json({
    input: value,
    normalized: normalize(value)
  })
})

// GLOBAL STATS (reads from DB — persistent across restarts & deployments)
app.get('/stats', async (c) => {
  const period = c.req.query('period')
  const dbStats = period === '24h' ? await get24hStats() : await getStats()
  return c.json({
    uptime_ms: Date.now() - startedAt,
    ...dbStats,
    cacheSize: cache.size
  })
})

// --------------------------------------------
// REVALIDATE LOGIC (helper)
// --------------------------------------------
const REVALIDATION_CONCURRENCY = 4
const REVALIDATION_RETRY_DELAY_MS = 1200

const runRevalidation = async (platform?: string, limitQuery: string = '50', offset: number = 0) => {
  const isAll = limitQuery.toLowerCase() === 'all'
  const parsedLimit = parseInt(limitQuery, 10)
  const numericLimit = Number.isNaN(parsedLimit) ? 50 : parsedLimit
  const limit = isAll ? 100000 : Math.min(Math.max(numericLimit, 1), 100000)

  const links = await getLinks({ platform: platform || undefined, limit, offset })
  
  if (!links.length) {
    return { message: "No links found to validate", processed: 0 }
  }

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const validateStoredLink = async (url: string): Promise<RevalidationResultItem> => {
    const res = await httpCheck(url, { skipCache: true })

    if (res.status === 'valid' || res.status === 'unknown') {
      return { url, action: 'kept' as RevalidationAction, status: res.status }
    }

    await delay(REVALIDATION_RETRY_DELAY_MS)
    const retryRes = await httpCheck(url, { skipCache: true })

    if (retryRes.status === 'valid' || retryRes.status === 'unknown') {
      return { url, action: 'kept' as RevalidationAction, status: retryRes.status }
    }

    return { url, action: 'deleted' as RevalidationAction, status: retryRes.status }
  }

  const results: RevalidationResultItem[] = []

  for (let i = 0; i < links.length; i += REVALIDATION_CONCURRENCY) {
    const chunk = links.slice(i, i + REVALIDATION_CONCURRENCY)
    const chunkResults = await Promise.all(
      chunk.map((link) => validateStoredLink((link as LinkRow).url))
    )
    results.push(...chunkResults)
  }

  const invalidUrls = results
    .filter(r => r.action === 'deleted')
    .map(r => r.url)

  if (invalidUrls.length > 0) {
    await deleteLinks(invalidUrls).catch(() => {})
  }

  const kept = results.filter(r => r.action === "kept")
  const deleted = results.filter(r => r.action === "deleted")
  const unknown = results.filter(r => r.status === "unknown")

  return {
    processed: results.length,
    kept: kept.length,
    deleted: deleted.length,
    skipped: unknown.length,
    details: results
  }
}
// --------------------------------------------
// STORED LINKS (and optional GET revalidation)
// --------------------------------------------
app.get('/links', async (c) => {
  const platform = c.req.query('platform')
  const search = c.req.query('search')
  const tag = c.req.query('tag')
  const username = c.req.query('username') || c.req.query('user')
  const limitQuery = c.req.query('limit') || '50'
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0
  const validate = c.req.query('validate') !== undefined

  if (validate) {
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
    offset
  })
  const total = await getLinkCount(platform || undefined, search || undefined, tag || undefined, username || undefined)

  return c.json({
    total,
    limit: isAll ? 'all' : limit,
    offset,
    links
  })
})

// --------------------------------------------
// REVALIDATE DB LINKS
// --------------------------------------------
const handleLinksValidateRequest = async (platform?: string, limitQuery: string = '100', offset: number = 0) => {
  return runRevalidation(platform || undefined, limitQuery, offset)
}

app.get('/links/validate', async (c) => {
  const platform = c.req.query('platform')
  const limitQuery = c.req.query('limit') || '100'
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0

  const result = await handleLinksValidateRequest(platform, limitQuery, offset)
  return c.json(result)
})

app.post('/links/validate', async (c) => {
  const platform = c.req.query('platform')
  const limitQuery = c.req.query('limit') || '100'
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0

  const result = await handleLinksValidateRequest(platform, limitQuery, offset)
  return c.json(result)
})

// --------------------------------------------
// TAGS ENDPOINTS
// --------------------------------------------
app.get('/tags', async (c) => {
  const tags = await getUniqueTags()
  return c.json({ tags })
})

app.post('/links/tags', async (c) => {
  try {
    const { url, tags } = await c.req.json<{ url: string; tags: string[] }>()
    if (!url || !Array.isArray(tags)) {
      return c.json({ error: 'Invalid payload: expected { url: string, tags: string[] }' }, 400)
    }
    
    // Basic URL validation
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

// STORED LINKS STATS
app.get('/links/stats', async (c) => {
  const total = await getLinkCount()
  const telegram = await getLinkCount('telegram')
  const mega = await getLinkCount('mega')

  return c.json({ total, telegram, mega })
})

// --------------------------------------------
// CONTRIBUTORS LEADERBOARD
// --------------------------------------------
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
      last_seen: c.last_seen
    }))
  })
})

// CURRENT USER'S PROFILE (matched by recovery key, device ID, then IP hash)
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
      last_seen: contributor.last_seen
    })
  } catch (err) {
    return c.json({ username: null, links_added: 0, rank: null })
  }
})

// RECOVER ACCOUNT VIA KEY
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
    const updatedContributor = await updateContributorIdentity(
      contributor.id as number,
      identity.ipHash,
      identity.deviceId
    )

    const activeLinksCount = await getContributorActiveLinkCount(updatedContributor.id as number)

    return c.json({
      success: true,
      message: `Welcome back, ${updatedContributor.username}!`,
      username: updatedContributor.username,
      recovery_key: updatedContributor.recovery_key,
      links_added: activeLinksCount
    })
  } catch (err) {
    return c.json({ error: 'Recovery failed' }, 500)
  }
})

export default app
