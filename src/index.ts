import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

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
// GLOBAL STATS STORE (resets on each deployment)
// --------------------------------------------
const stats = {
  startedAt: Date.now(),
  totalChecks: 0,
  valid: 0,
  invalid: 0,
  unknown: 0,
  cacheHits: 0,
  cacheMisses: 0
}

// --------------------------------------------
// IN-MEMORY CACHE (5 min TTL)
// --------------------------------------------
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const cache = new Map<string, { data: any; expiresAt: number }>()

const getCached = (key: string) => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

const setCache = (key: string, data: any) => {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL })
}

// --------------------------------------------
// PLATFORM DETECTION
// --------------------------------------------
type Platform = 'telegram' | 'mega' | 'unknown'

const detectPlatform = (url: string): Platform => {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === 't.me' || host === 'telegram.me' || host === 'telegram.org') return 'telegram'
    if (host === 'mega.nz' || host === 'mega.co.nz') return 'mega'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

// --------------------------------------------
// NORMALIZE FUNCTION
// --------------------------------------------
const normalize = (input: string) => {
  let s = input.trim()
  if (!s) return ""

  if (s.startsWith("@")) return `https://t.me/${s.slice(1)}`
  if (/^[A-Za-z0-9_]{5,32}$/.test(s)) return `https://t.me/${s}`
  if (!s.startsWith("http")) s = "https://" + s

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
const telegramCheck = async (url: string, html: string) => {
  if (html.includes("tgme_page_title")) {
    stats.valid++

    const title = extractText(html, 'tgme_page_title')
    const description = extractText(html, 'tgme_page_description')
    const extra = extractText(html, 'tgme_page_extra')
    const photo = extractImgSrc(html, 'tgme_page_photo_image')

    // Determine type from extra text (e.g. "5 111 subscribers", "12 members", etc.)
    let type: string | null = null
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

  stats.invalid++
  return { status: "invalid", platform: "telegram" as const, metadata: null }
}

// --------------------------------------------
// MEGA PAGE VALIDATION + METADATA
// --------------------------------------------
const megaCheck = async (url: string, html: string, httpStatus: number) => {
  const title = extractMeta(html, 'og:title') || extractPageTitle(html)
  const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
  const image = extractMeta(html, 'og:image')
  const siteName = extractMeta(html, 'og:site_name')

  // Detect MEGA link type from URL path
  let type: string | null = null
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
    stats.invalid++
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
    stats.valid++
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

  stats.invalid++
  return { status: "invalid", platform: "mega" as const, metadata: null }
}

// --------------------------------------------
// GENERIC CHECK (fallback for unknown platforms)
// --------------------------------------------
const genericCheck = async (url: string, html: string, httpStatus: number) => {
  const title = extractMeta(html, 'og:title') || extractPageTitle(html)
  const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
  const image = extractMeta(html, 'og:image')
  const siteName = extractMeta(html, 'og:site_name')

  if (title || httpStatus === 200) {
    stats.valid++
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

  stats.invalid++
  return { status: "invalid", platform: "unknown" as const, metadata: null }
}

// --------------------------------------------
// MAIN CHECK ROUTER
// --------------------------------------------
const httpCheck = async (url: string) => {
  // Check cache first
  const cached = getCached(url)
  if (cached) {
    stats.cacheHits++
    return { ...cached, cached: true }
  }
  stats.cacheMisses++

  try {
    const res = await fetch(url, { redirect: "follow" })
    const html = await res.text()
    const platform = detectPlatform(url)

    stats.totalChecks++

    let result
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

    setCache(url, result)
    return { ...result, cached: false }

  } catch (err: any) {
    stats.unknown++
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
        health: "/health",
        stats: "/stats",
        normalize: "/normalize?value=<input>",
        info: "/info"
      },
      credits: "@saahiyo",
      responseTime: Date.now() - start
    })
  }

  const normalized = normalize(link)
  const result = await httpCheck(normalized)

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
  let body: any = {}

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON" }, 400)
  }

  const links: string[] = body.links || []

  if (!Array.isArray(links) || links.length === 0) {
    return c.json({ error: "Provide { links: [...] }" }, 400)
  }

  const normalized = Array.from(new Set(links.map(normalize).filter(Boolean)))

  const results = await Promise.all(
    normalized.map(async (url) => {
      const res = await httpCheck(url)
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
  return c.json({ status: "ok", uptime_ms: Date.now() - stats.startedAt })
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

// GLOBAL STATS
app.get('/stats', (c) => {
  return c.json({
    uptime_ms: Date.now() - stats.startedAt,
    ...stats,
    cacheSize: cache.size
  })
})

export default app
