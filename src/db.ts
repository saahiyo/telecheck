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
  console.log('✅ Database initialized — links table ready')
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
// GET: Query stored links
// --------------------------------------------
export const getLinks = async (platform?: string, limit = 50, offset = 0) => {
  const sql = getDb()
  if (platform) {
    return sql`
      SELECT * FROM links
      WHERE platform = ${platform}
      ORDER BY checked_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
  }
  return sql`
    SELECT * FROM links
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
// COUNT: Get total stored links
// --------------------------------------------
export const getLinkCount = async (platform?: string) => {
  const sql = getDb()
  if (platform) {
    const rows = await sql`SELECT COUNT(*) as count FROM links WHERE platform = ${platform}`
    return parseInt(rows[0].count as string, 10)
  }
  const rows = await sql`SELECT COUNT(*) as count FROM links`
  return parseInt(rows[0].count as string, 10)
}
