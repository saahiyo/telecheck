import { neon } from '@neondatabase/serverless'

const getDb = () => {
  const url = process.env.VLINKS_POSTGRES_URL || process.env.POSTGRES_URL
  if (!url) throw new Error('Missing VLINKS_POSTGRES_URL or POSTGRES_URL env var')
  return neon(url)
}

// --------------------------------------------
// INIT: Create table if not exists
// --------------------------------------------
export const initDB = async () => {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS links (
      id SERIAL PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT,
      description TEXT,
      image TEXT,
      type TEXT,
      member_count INTEGER,
      raw_metadata JSONB,
      checked_at TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  // ── Performance indexes ──
  // GIN index for full-text search on url, title, description
  await sql`
    CREATE INDEX IF NOT EXISTS idx_links_search
    ON links
    USING GIN (to_tsvector('english', coalesce(url,'') || ' ' || coalesce(title,'') || ' ' || coalesce(description,'')))
  `
  // B-tree index on platform for filtered queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_links_platform
    ON links (platform)
  `
  // B-tree index on checked_at for ORDER BY sorting
  await sql`
    CREATE INDEX IF NOT EXISTS idx_links_checked_at
    ON links (checked_at DESC)
  `
  // Composite index for the most common query pattern: filter by platform + sort by date
  await sql`
    CREATE INDEX IF NOT EXISTS idx_links_platform_checked
    ON links (platform, checked_at DESC)
  `

  console.log('✅ Database initialized — tables + indexes ready')
}

// --------------------------------------------
// SAVE: Insert or update a valid link
// --------------------------------------------
export const saveLink = async (
  url: string,
  platform: string,
  status: string,
  metadata: Record<string, any> | null
) => {
  const sql = getDb()
  const title = metadata?.title || null
  const description = metadata?.description || null
  const image = metadata?.photo || metadata?.image || null
  const type = metadata?.type || null
  const memberCount = metadata?.memberCount || null

  await sql`
    INSERT INTO links (url, platform, status, title, description, image, type, member_count, raw_metadata)
    VALUES (${url}, ${platform}, ${status}, ${title}, ${description}, ${image}, ${type}, ${memberCount}, ${JSON.stringify(metadata)})
    ON CONFLICT (url) DO UPDATE SET
      platform = EXCLUDED.platform,
      status = EXCLUDED.status,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      image = EXCLUDED.image,
      type = EXCLUDED.type,
      member_count = EXCLUDED.member_count,
      raw_metadata = EXCLUDED.raw_metadata,
      checked_at = NOW()
  `
}

// --------------------------------------------
// GET: Query stored links (ILIKE search for substring matching)
// --------------------------------------------
export const getLinks = async ({
  platform,
  search,
  limit = 50,
  offset = 0
}: {
  platform?: string
  search?: string
  limit?: number
  offset?: number
}) => {
  const sql = getDb()
  const pattern = search ? `%${search.trim()}%` : null

  if (platform && pattern) {
    return sql`
      SELECT *
      FROM links
      WHERE platform = ${platform}
        AND (
          url ILIKE ${pattern}
          OR title ILIKE ${pattern}
          OR description ILIKE ${pattern}
        )
      ORDER BY checked_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  }

  if (platform) {
    return sql`
      SELECT *
      FROM links
      WHERE platform = ${platform}
      ORDER BY checked_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  }

  if (pattern) {
    return sql`
      SELECT *
      FROM links
      WHERE url ILIKE ${pattern}
        OR title ILIKE ${pattern}
        OR description ILIKE ${pattern}
      ORDER BY checked_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  }

  return sql`
    SELECT *
    FROM links
    ORDER BY checked_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `
}

// --------------------------------------------
// GET BY URL: Check if a link exists
// --------------------------------------------
export const getLinkByUrl = async (url: string) => {
  const sql = getDb()
  const rows = await sql`SELECT * FROM links WHERE url = ${url} LIMIT 1`
  return rows.length > 0 ? rows[0] : null
}

// --------------------------------------------
// DELETE: Remove multiple links
// --------------------------------------------
export const deleteLinks = async (urls: string[]) => {
  if (!urls.length) return
  const sql = getDb()
  await sql`DELETE FROM links WHERE url = ANY(${urls})`
}

// --------------------------------------------
// COUNT: Get total stored links (supports search filter)
// --------------------------------------------
export const getLinkCount = async (platform?: string, search?: string) => {
  const sql = getDb()
  const pattern = search ? `%${search.trim()}%` : null

  if (platform && pattern) {
    const rows = await sql`
      SELECT COUNT(*) as count FROM links
      WHERE platform = ${platform}
        AND (
          url ILIKE ${pattern}
          OR title ILIKE ${pattern}
          OR description ILIKE ${pattern}
        )
    `
    return parseInt(rows[0].count as string, 10)
  }

  if (platform) {
    const rows = await sql`SELECT COUNT(*) as count FROM links WHERE platform = ${platform}`
    return parseInt(rows[0].count as string, 10)
  }

  if (pattern) {
    const rows = await sql`
      SELECT COUNT(*) as count FROM links
      WHERE url ILIKE ${pattern}
        OR title ILIKE ${pattern}
        OR description ILIKE ${pattern}
    `
    return parseInt(rows[0].count as string, 10)
  }

  const rows = await sql`SELECT COUNT(*) as count FROM links`
  return parseInt(rows[0].count as string, 10)
}

// --------------------------------------------
// STATS: Increment a stat counter
// --------------------------------------------
export const incrementStat = async (key: string, amount = 1) => {
  const sql = getDb()
  await sql`
    INSERT INTO stats (key, value, updated_at)
    VALUES (${key}, ${amount}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = stats.value + ${amount},
      updated_at = NOW()
  `
}

// --------------------------------------------
// STATS: Get all stats as a flat object
// --------------------------------------------
export const getStats = async (): Promise<Record<string, number>> => {
  const sql = getDb()
  const rows = await sql`SELECT key, value FROM stats`
  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.key as string] = parseInt(row.value as string, 10)
  }
  return result
}
