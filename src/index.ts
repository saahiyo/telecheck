import { Hono } from 'hono'

export const config = {
  runtime: 'edge',
}

const app = new Hono()

// -----------------------------------------------
// Helper to check a Telegram link
// -----------------------------------------------
async function checkLink(url: string): Promise<"VALID" | "INVALID"> {
  try {
    const res = await fetch(url)
    const html = await res.text()

    if (html.includes("tgme_page_title")) {
      return "VALID"
    }
    return "INVALID"
  } catch {
    return "INVALID"
  }
}

// ------------------------------------------------
// GET /?url=...
// ------------------------------------------------
app.get("/", async (c) => {
  const url = c.req.query("url")

  if (!url) return c.json({ error: "Missing ?url=" })

  const status = await checkLink(url)
  return c.json({ url, status })
})

// ------------------------------------------------
// POST /   { "links": ["...","..."] }
// ------------------------------------------------
app.post("/", async (c) => {
  const body = await c.req.json().catch(() => null)

  // Type guard
  if (!body || !Array.isArray(body.links)) {
    return c.json(
      { error: "Send JSON: { links: [ ... ] }" },
      400
    )
  }

  const unique = [...new Set(body.links.map(String))] as string[]

  const results = await Promise.all(
    unique.map(async (link) => ({
      link,
      status: await checkLink(link),
    }))
  )

  // Sort valid first
  results.sort((a, b) => (a.status === "VALID" ? -1 : 1))

  return c.json({
    total: unique.length,
    valid: results.filter(r => r.status === "VALID").length,
    invalid: results.filter(r => r.status === "INVALID").length,
    results
  })
})

export default app
