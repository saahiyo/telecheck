import { Hono } from 'hono'

const app = new Hono()

// Normalize usernames and URLs
const normalize = (input: string) => {
  let s = input.trim()
  if (!s) return ""

  if (s.startsWith("@")) return `https://t.me/${s.slice(1)}`
  if (/^[A-Za-z0-9_]{5,32}$/.test(s)) return `https://t.me/${s}`
  if (!s.startsWith("http")) s = "https://" + s

  return s
}

// Simple HTTP check
const httpCheck = async (url: string) => {
  try {
    const res = await fetch(url, { redirect: "follow" })
    const status = res.status

    if (status === 200) return { status: "valid", reason: "OK" }
    if ([404, 410].includes(status)) return { status: "invalid", reason: "Not Found" }
    if ([301, 302, 303, 307, 308].includes(status))
      return { status: "valid", reason: `Redirect ${status}` }

    return { status: "unknown", reason: `HTTP ${status}` }
  } catch (err: any) {
    return { status: "unknown", reason: err.message || "Network error" }
  }
}

// -------------------------------------------------------
// ⚡ GET /?link=xxxx  (single link check)
// -------------------------------------------------------

app.get('/', async (c) => {
  const link = c.req.query("link")

  if (!link) {
    return c.json({
      message: "Telegram Link Checker API",
      usage: "/?link=https://t.me/example\nPOST JSON { links: [] }",
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

// -------------------------------------------------------
// ⚡ POST /  (multiple link check)
// -------------------------------------------------------

app.post('/', async (c) => {
  let body: any

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: "Invalid JSON" }, 400)
  }

  const list: string[] = body.links || []

  if (!Array.isArray(list) || list.length === 0) {
    return c.json({ error: "Provide { links: [...] }" }, 400)
  }

  // Normalize + dedupe
  const normalized = Array.from(new Set(list.map(normalize).filter(Boolean)))

  const results = await Promise.all(
    normalized.map(async (url) => {
      const check = await httpCheck(url)
      return {
        url,
        ...check
      }
    })
  )

  return c.json({
    count: results.length,
    results
  })
})

export default app
