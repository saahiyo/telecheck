import { Hono } from 'hono'

const app = new Hono()

// --------------------------------------------
// GLOBAL STATS STORE (resets on each deployment)
// --------------------------------------------
const stats = {
  startedAt: Date.now(),
  totalChecks: 0,
  valid: 0,
  invalid: 0,
  unknown: 0
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
// TELEGRAM PAGE VALIDATION
// --------------------------------------------
const httpCheck = async (url: string) => {
  try {
    const res = await fetch(url, { redirect: "follow" })
    const html = await res.text()

    stats.totalChecks++

    if (html.includes("tgme_page_title")) {
      stats.valid++
      return { status: "valid", reason: "Telegram page exists and is active" }
    }

    stats.invalid++
    return { status: "invalid", reason: "Telegram page does not exist or is unavailable" }

  } catch (err: any) {
    stats.unknown++
    return { status: "unknown", reason: err?.message || "Unexpected network error" }
  }
}

// --------------------------------------------
// ROOT: /?link=xxxx
// --------------------------------------------
app.get('/', async (c) => {
  const link = c.req.query("link")

  if (!link) {
    return c.json({
      api: "Telegram Link Checker API",
      endpoints: {
        single: "/?link=<telegram_link>",
        multiple: "POST / → { links: [] }",
        health: "/health",
        stats: "/stats",
        normalize: "/normalize?value=<input>",
        info: "/info"
      },
      credits: "@saahiyo"
    })
  }

  const normalized = normalize(link)
  const result = await httpCheck(normalized)

  return c.json({
    input: link,
    normalized,
    ...result,
    credits: "@saahiyo"
  })
})

// --------------------------------------------
// POST /  (Batch checker)
// --------------------------------------------
app.post('/', async (c) => {
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
    credits: "@saahiyo"
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
    name: "Telegram Link Checker API",
    version: "1.0.0",
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
    ...stats
  })
})

export default app
