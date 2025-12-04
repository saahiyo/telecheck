import { Hono } from 'hono'

export const config = {
  runtime: 'edge',
}

const app = new Hono()

// --------------------------------------------------
// Helper: Check a single Telegram link (HTTP only)
// --------------------------------------------------
async function checkLink(url: string): Promise<"VALID" | "INVALID"> {
  try {
    const response = await fetch(url)
    const html = await response.text()

    // Main rule: tgme_page_title exists → VALID
    if (html.includes("tgme_page_title")) {
      return "VALID"
    }
    return "INVALID"
  } catch (e) {
    return "INVALID"
  }
}

// --------------------------------------------------
// GET /?url=link
// --------------------------------------------------
app.get("/", async (c) => {
  const url = c.req.query("url")

  if (!url) {
    return c.json({ error: "Missing ?url=" })
  }

  const status = await checkLink(url)

  return c.json({
    url,
    status,
  })
})

// --------------------------------------------------
// POST /
// Body: { "links": ["url1", "url2", ...] }
// --------------------------------------------------
app.post("/", async (c) => {
  const body = await c.req.json()

  if (!body?.links || !Array.isArray(body.links)) {
    return c.json({ error: "Send JSON: { links: [ ... ] }" }, 400)
  }

  // Remove duplicates
  const unique = [...new Set(body.links)]

  // Check all links in parallel
  const results = await Promise.all(
    unique.map(async (link) => ({
      link,
      status: await checkLink(link),
    }))
  )

  // Sort: VALID first
  results.sort((a, b) => (a.status === "VALID" ? -1 : 1))

  return c.json({
    total: unique.length,
    valid: results.filter(r => r.status === "VALID").length,
    invalid: results.filter(r => r.status === "INVALID").length,
    results
  })
})

export default app
