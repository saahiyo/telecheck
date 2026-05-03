import { neon, NeonQueryFunction } from '@neondatabase/serverless'

let sqlInstance: NeonQueryFunction<false, false> | null = null

const getDb = () => {
  if (sqlInstance) return sqlInstance

  const url = process.env.VLINKS_POSTGRES_URL || process.env.POSTGRES_URL
  if (!url) throw new Error('Missing VLINKS_POSTGRES_URL or POSTGRES_URL env var')
  
  sqlInstance = neon(url)
  return sqlInstance
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
      checked_at TIMESTAMP DEFAULT NOW(),
      tags TEXT[] DEFAULT '{}'::text[]
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `
  // ── Hourly stats for rolling 24hr window ──
  await sql`
    CREATE TABLE IF NOT EXISTS hourly_stats (
      hour TIMESTAMP NOT NULL,
      key TEXT NOT NULL,
      value BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (hour, key)
    )
  `
  // ── Contributors table ──
  await sql`
    CREATE TABLE IF NOT EXISTS contributors (
      id SERIAL PRIMARY KEY,
      ip_hash TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      recovery_key TEXT UNIQUE NOT NULL,
      links_added INTEGER DEFAULT 0,
      first_seen TIMESTAMP DEFAULT NOW(),
      last_seen TIMESTAMP DEFAULT NOW()
    )
  `
  // Add recovery_key column to contributors if it doesn't exist (for existing DBs)
  await sql`
    DO $$ BEGIN
      ALTER TABLE contributors ADD COLUMN recovery_key TEXT UNIQUE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `
  // Backfill existing contributors with a random key if null
  await sql`
    UPDATE contributors 
    SET recovery_key = md5(ip_hash || random()::text)
    WHERE recovery_key IS NULL
  `
  // Ensure the column is NOT NULL after backfill
  await sql`ALTER TABLE contributors ALTER COLUMN recovery_key SET NOT NULL`

  // Add contributor_id column to links if it doesn't exist
  await sql`
    DO $$ BEGIN
      ALTER TABLE links ADD COLUMN contributor_id INTEGER REFERENCES contributors(id);
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `

  // Add tags column to links if it doesn't exist
  await sql`
    DO $$ BEGIN
      ALTER TABLE links ADD COLUMN tags TEXT[] DEFAULT '{}'::text[];
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
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
  // Index on contributors for leaderboard sorting
  await sql`
    CREATE INDEX IF NOT EXISTS idx_contributors_links_added
    ON contributors (links_added DESC)
  `

  console.log('✅ Database initialized — tables + indexes ready')
}

// --------------------------------------------
// USERNAME GENERATOR (Adjective + Animal)
// --------------------------------------------
const ADJECTIVES = [
  'Swift','Bold','Bright','Calm','Cool','Cyber','Dark','Deep','Epic','Fast',
  'Fire','Flash','Frost','Gold','Grand','Hyper','Iron','Keen','Lunar','Neon',
  'Noble','Nova','Pixel','Prime','Pulse','Rapid','Royal','Sage','Shadow','Sharp',
  'Silent','Silver','Solar','Sonic','Star','Storm','Tech','Titan','Ultra','Vivid',
  'Wild','Zen','Blaze','Crimson','Azure','Onyx','Jade','Amber','Coral','Ivory'
]

const ANIMALS = [
  'Wolf','Fox','Bear','Eagle','Hawk','Lion','Tiger','Shark','Falcon','Raven',
  'Cobra','Phoenix','Dragon','Panther','Viper','Lynx','Orca','Owl','Puma','Jaguar',
  'Crane','Mantis','Dolphin','Stallion','Condor','Leopard','Rhino','Sphinx','Griffin','Hydra'
]

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return `${adj}${animal}`
}

async function generateUniqueUsername(): Promise<string> {
  const sql = getDb()
  // Try up to 20 times to find a unique base name, then fall back to numbered
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = generateUsername()
    const existing = await sql`SELECT id FROM contributors WHERE username = ${name} LIMIT 1`
    if (existing.length === 0) return name
  }
  // Fallback: add a random 3-digit suffix
  const base = generateUsername()
  const suffix = Math.floor(100 + Math.random() * 900)
  return `${base}${suffix}`
}

function generateRecoveryKey(): string {
  // Simple 12-character random hex string
  const chars = 'abcdef0123456789'
  let res = ''
  for (let i = 0; i < 12; i++) {
    res += chars[Math.floor(Math.random() * chars.length)]
  }
  return res
}

// --------------------------------------------
// CONTRIBUTORS: Get or create by IP hash
// --------------------------------------------
export const getOrCreateContributor = async (ipHash: string) => {
  const sql = getDb()
  // Check if contributor exists
  const existing = await sql`SELECT * FROM contributors WHERE ip_hash = ${ipHash} LIMIT 1`
  if (existing.length > 0) {
    // Update last_seen
    await sql`UPDATE contributors SET last_seen = NOW() WHERE id = ${existing[0].id}`
    return existing[0]
  }
  // Create new contributor with unique username and recovery key
  const username = await generateUniqueUsername()
  const recoveryKey = generateRecoveryKey()
  const rows = await sql`
    INSERT INTO contributors (ip_hash, username, recovery_key)
    VALUES (${ipHash}, ${username}, ${recoveryKey})
    RETURNING *
  `
  return rows[0]
}

export const getContributorByIpHash = async (ipHash: string) => {
  const sql = getDb()
  const rows = await sql`SELECT * FROM contributors WHERE ip_hash = ${ipHash} LIMIT 1`
  return rows.length > 0 ? rows[0] : null
}

export const getContributorLeaderboard = async (limit = 20, offset = 0) => {
  const sql = getDb()
  return sql`
    SELECT username, links_added, first_seen, last_seen
    FROM contributors
    WHERE links_added > 0
    ORDER BY links_added DESC, first_seen ASC
    LIMIT ${limit} OFFSET ${offset}
  `
}

export const getContributorCount = async () => {
  const sql = getDb()
  const rows = await sql`SELECT COUNT(*) as count FROM contributors WHERE links_added > 0`
  return parseInt(rows[0].count as string, 10)
}

export const getContributorRank = async (ipHash: string) => {
  const sql = getDb()
  const rows = await sql`
    SELECT rank FROM (
      SELECT ip_hash, RANK() OVER (ORDER BY links_added DESC, first_seen ASC) as rank
      FROM contributors
      WHERE links_added > 0
    ) ranked
    WHERE ip_hash = ${ipHash}
  `
  return rows.length > 0 ? parseInt(rows[0].rank as string, 10) : null
}

export const getContributorByRecoveryKey = async (recoveryKey: string) => {
  const sql = getDb()
  const rows = await sql`SELECT * FROM contributors WHERE recovery_key = ${recoveryKey} LIMIT 1`
  return rows.length > 0 ? rows[0] : null
}

export const updateContributorIpHash = async (contributorId: number, newIpHash: string) => {
  const sql = getDb()
  await sql`UPDATE contributors SET ip_hash = ${newIpHash} WHERE id = ${contributorId}`
}

// --------------------------------------------
// SAVE: Insert or update a valid link
// --------------------------------------------
export const saveLink = async (
  url: string,
  platform: string,
  status: string,
  metadata: Record<string, any> | null,
  contributorId?: number | null
) => {
  const sql = getDb()
  const title = metadata?.title || null
  const description = metadata?.description || null
  const image = metadata?.photo || metadata?.image || null
  const type = metadata?.type || null
  const memberCount = metadata?.memberCount || null

  // Check if link already exists (to avoid double-counting contributor)
  const existing = await sql`SELECT id FROM links WHERE url = ${url} LIMIT 1`
  const isNewLink = existing.length === 0

  await sql`
    INSERT INTO links (url, platform, status, title, description, image, type, member_count, raw_metadata, contributor_id)
    VALUES (${url}, ${platform}, ${status}, ${title}, ${description}, ${image}, ${type}, ${memberCount}, ${JSON.stringify(metadata)}, ${contributorId || null})
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

  // Increment contributor link count only for genuinely new links
  if (isNewLink && contributorId) {
    await sql`UPDATE contributors SET links_added = links_added + 1, last_seen = NOW() WHERE id = ${contributorId}`
  }
}

// --------------------------------------------
// GET: Query stored links (ILIKE search for substring matching)
// --------------------------------------------
export const getLinks = async ({
  platform,
  search,
  tag,
  username,
  limit = 50,
  offset = 0
}: {
  platform?: string
  search?: string
  tag?: string
  username?: string
  limit?: number
  offset?: number
}) => {
  const sql = getDb()
  const pattern = search ? `%${search.trim()}%` : null
  const tagFilter = tag ? tag.trim() : null
  const usernameFilter = username ? username.trim() : null

  // Base query with contributor details when available
  const baseQuery = usernameFilter 
    ? sql`FROM links l JOIN contributors c ON l.contributor_id = c.id WHERE c.username = ${usernameFilter}`
    : sql`FROM links l LEFT JOIN contributors c ON l.contributor_id = c.id WHERE true`

  const platformCond = platform ? sql`AND l.platform = ${platform}` : sql``
  const searchCond = pattern ? sql`AND (l.url ILIKE ${pattern} OR l.title ILIKE ${pattern} OR l.description ILIKE ${pattern})` : sql``
  const tagCond = tagFilter ? sql`AND (${tagFilter}::text = ANY(l.tags))` : sql``

  return sql`
    SELECT
      l.*,
      c.username AS contributor_username,
      c.links_added AS contributor_links_added,
      c.first_seen AS contributor_first_seen,
      c.last_seen AS contributor_last_seen
    ${baseQuery}
    ${platformCond}
    ${searchCond}
    ${tagCond}
    ORDER BY l.checked_at DESC
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
export const getLinkCount = async (platform?: string, search?: string, tag?: string, username?: string) => {
  const sql = getDb()
  const pattern = search ? `%${search.trim()}%` : null
  const tagFilter = tag ? tag.trim() : null
  const usernameFilter = username ? username.trim() : null

  const baseQuery = usernameFilter 
    ? sql`FROM links l JOIN contributors c ON l.contributor_id = c.id WHERE c.username = ${usernameFilter}`
    : sql`FROM links l WHERE true`

  const platformCond = platform ? sql`AND l.platform = ${platform}` : sql``
  const searchCond = pattern ? sql`AND (l.url ILIKE ${pattern} OR l.title ILIKE ${pattern} OR l.description ILIKE ${pattern})` : sql``
  const tagCond = tagFilter ? sql`AND (${tagFilter}::text = ANY(l.tags))` : sql``

  const rows = await sql`
    SELECT COUNT(*) as count 
    ${baseQuery}
    ${platformCond}
    ${searchCond}
    ${tagCond}
  `
  return parseInt(rows[0].count as string, 10)
}

// --------------------------------------------
// TAGS: Update tags for a link
// --------------------------------------------
export const updateLinkTags = async (url: string, tags: string[]) => {
  const sql = getDb()
  await sql`UPDATE links SET tags = ${tags} WHERE url = ${url}`
}

// --------------------------------------------
// TAGS: Get all unique tags used across links
// --------------------------------------------
export const getUniqueTags = async () => {
  const sql = getDb()
  const rows = await sql`SELECT DISTINCT unnest(tags) as tag FROM links`
  return rows.map(r => r.tag as string).filter(Boolean)
}

// --------------------------------------------
// STATS: Increment a stat counter
// --------------------------------------------
let hourlyTableReady = false
const ensureHourlyTable = async () => {
  if (hourlyTableReady) return
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS hourly_stats (
      hour TIMESTAMP NOT NULL,
      key TEXT NOT NULL,
      value BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (hour, key)
    )
  `
  hourlyTableReady = true
}

export const incrementStat = async (key: string, amount = 1) => {
  const sql = getDb()
  await sql`
    INSERT INTO stats (key, value, updated_at)
    VALUES (${key}, ${amount}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = stats.value + ${amount},
      updated_at = NOW()
  `
  try {
    await ensureHourlyTable()
    await sql`
      INSERT INTO hourly_stats (hour, key, value)
      VALUES (date_trunc('hour', NOW()), ${key}, ${amount})
      ON CONFLICT (hour, key) DO UPDATE SET
        value = hourly_stats.value + ${amount}
    `
  } catch (e) {
    // Silently fail — don't break the main stats flow
  }
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

// --------------------------------------------
// STATS: Get rolling 24h stats
// --------------------------------------------
export const get24hStats = async (): Promise<Record<string, number>> => {
  const sql = getDb()
  await ensureHourlyTable()
  const rows = await sql`SELECT key, SUM(value) as value FROM hourly_stats WHERE hour >= NOW() - INTERVAL '24 hours' GROUP BY key`
  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.key as string] = parseInt(row.value as string, 10)
  }
  return result
}
