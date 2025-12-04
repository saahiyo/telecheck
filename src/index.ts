import { Hono } from 'hono'

const app = new Hono()

// Normalize Telegram link or username
const normalize = (input: string) => {
  let s = input.trim()
  if (!s) return ""

  if (s.startsWith("@")) return `https://t.me/${s.slice(1)}`
  if (/^[A-Za-z0-9_]{5,32}$/.test(s)) return `https://t.me/${s}`
  if (!s.startsWith("http")) s = "https://" + s

  return s
}

// Check Telegram HTML signature
const httpCheck = async (url: string) => {
  try {
    const res = await fetch(url, { redirect: "follow" })
    const html = await res.text()

    // Valid Telegram pages contain tgme_page_title
    if (html.includes("tgme_page_title")) {
      return {
        status: "valid",
        reason: "Telegram page exists and is active"
      }
    }

    return {
      status: "invalid",
      reason: "Telegram page does not exist or is unavailable"
    }

  } catch (err: any) {
    return {
      status: "unknown",
      reason: err?.message || "Unexpected network error"
    }
  }
}

// --------------------------------------------
// GET /?link=xxxx
// --------------------------------------------
app.get('/', async (c) => {
  const link = c.req.query("link")

  if (!link) {
    return c.json({
      api: "Telegram Link Checker API",
      usage: {
        single: "/?link=https://t.me/example",
        multiple: "POST JSON → { links: [] }"
      }
    })
  }

  const normalized = normalize(link)
  const result = await httpCheck(normalized)

  return c.json({
    input: link,
    normalized,
    ...result
  })
})

// --------------------------------------------
// POST /
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

  // Normalize & dedupe
  const normalized = Array.from(new Set(links.map(normalize).filter(Boolean)))

  // Parallel multi-thread style using Promise.all
  const results = await Promise.all(
    normalized.map(async (url) => {
      const res = await httpCheck(url)
      return { url, ...res }
    })
  )

  // Grouping
  const valid = results.filter(r => r.status === "valid")
  const invalid = results.filter(r => r.status === "invalid")
  const unknown = results.filter(r => r.status === "unknown")

  return c.json({
    total: results.length,
    groups: {
      valid,
      invalid,
      unknown
    }
  })
})

export default app
