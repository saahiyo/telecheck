# TeleCheck API

TeleCheck is a lightweight Hono API for validating public Telegram and MEGA links. It normalizes input, fetches public page metadata, stores valid links in Neon Postgres, exposes saved-link search, and supports contributor leaderboards for the TeleCheck Pro frontend.

Live API: `https://telecheck.vercel.app`

## Stack

- Hono
- TypeScript
- Neon serverless Postgres
- Node local dev server through `@hono/node-server`
- Vercel deployment

## Features

- Telegram and MEGA validation without platform API credentials.
- Input normalization for Telegram usernames and `@username` handles.
- Metadata extraction for titles, descriptions, images, Telegram member counts, and link type.
- Batch validation with parallel checks.
- Valid link persistence in Postgres.
- Automatic removal of stored invalid or expired links when checked again.
- Saved-link search, pagination, platform filtering, tag filtering, and contributor filtering.
- Global saved-link tags.
- Contributor identities resolved by recovery key, browser/device id, then IP hash fallback.
- Contributor leaderboard and profile counts based on currently active valid links.
- Persistent stats plus rolling 24-hour stats.
- Five-minute in-memory result cache for repeated checks.
- Fetch safety limits for URL length, host allow-listing, private/local host blocking, response size, and timeout.
- Trigram indexes for saved-link substring search.

## Getting Started

Prerequisites:

- Node.js 20 or newer
- npm
- A Neon/Postgres connection string

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```env
VLINKS_POSTGRES_URL=postgres://...
# or
POSTGRES_URL=postgres://...
```

Start the local API:

```bash
npm run dev
```

The local server runs at `http://localhost:3000`.

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```powershell
npm.cmd install
npm.cmd run dev
```

## Verification

There is no dedicated build script. Use TypeScript directly:

```bash
npx tsc --noEmit
```

## Endpoints

### API Info

```http
GET /
GET /health
GET /info
GET /normalize?value=@username
```

`GET /` without a `link` query returns API metadata. `GET /normalize` shows how an input would be normalized without fetching it.

### Single Link Check

```http
GET /?link=@durov
GET /?link=https://t.me/durov
GET /?link=https://mega.nz/file/...
```

The response includes `input`, `normalized`, `status`, `platform`, `metadata`, `cached`, `credits`, and `responseTime`.

Contributor-aware callers can include `contributor_id`, `device_id`, and `recovery_key` as query parameters.

### Batch Link Check

```http
POST /
Content-Type: application/json

{
  "links": ["@durov", "https://mega.nz/file/..."],
  "device_id": "browser-device-id",
  "recovery_key": "optional-recovery-key"
}
```

The response groups results under `groups.valid`, `groups.invalid`, and `groups.unknown`.

### Saved Links

```http
GET /links?platform=telegram&limit=50&offset=0
GET /links?search=ai&tag=Tech&username=SwiftWolf
GET /links?validate=1&limit=100
```

Supported query parameters:

- `platform`: `telegram` or `mega`.
- `limit`: number of rows, or `all`.
- `offset`: pagination offset.
- `search`: substring search across URL, title, and description.
- `tag`: saved-link tag.
- `username` or `user`: contributor username filter.
- `validate`: when present, revalidates returned links instead of only listing them.

Saved-link rows include contributor details when available: username, active valid link count, first seen, and last seen.

### Revalidate Stored Links

```http
GET /links/validate?limit=100
POST /links/validate?limit=all
```

Revalidation bypasses cache, processes links with server-side concurrency of 4, retries invalid/expired results once after a short delay, deletes confirmed invalid or expired links, and keeps unknown results to avoid accidental data loss.

Response fields include `processed`, `kept`, `deleted`, `skipped`, and per-link `details`.

### Tags

```http
GET /tags
POST /links/tags
Content-Type: application/json

{
  "url": "https://t.me/example",
  "tags": ["Tech", "News"]
}
```

### Stats

```http
GET /stats
GET /stats?period=24h
GET /links/stats
```

`/stats` returns runtime cache size plus persistent counters from the database. `period=24h` returns rolling hourly counters. `/links/stats` returns saved-link totals by platform.

### Contributors

```http
GET /contributors?limit=20&offset=0
GET /contributors/me?device_id=...&recovery_key=...
POST /contributors/recover
Content-Type: application/json

{
  "recovery_key": "abc123def456",
  "device_id": "browser-device-id"
}
```

Contributor resolution order is recovery key, browser/device id, then IP hash fallback. Leaderboard/profile counts are recalculated from live valid links rather than trusting stale lifetime counters.

## Database

`initDB()` creates and migrates:

- `links`
- `contributors`
- `stats`
- `hourly_stats`

Important indexes:

- `idx_links_url_trgm`, `idx_links_title_trgm`, `idx_links_description_trgm` for `ILIKE '%term%'` search.
- `idx_links_platform`, `idx_links_checked_at`, and `idx_links_platform_checked` for listing/filtering.
- `idx_links_contributor_status` for active contributor counts.
- `idx_contributors_device_id` for stable browser/device identity.

The database initializer also enables `pg_trgm` and drops the older unused full-text index `idx_links_search`.

## Fetch Safety

External fetches are restricted to supported public Telegram and MEGA hosts. The API rejects unsupported protocols, credentialed URLs, private/local hosts, unknown hosts, oversized URLs, and responses larger than 1 MB. Source fetches use a 10 second timeout.

## Project Structure

```text
src/index.ts       Hono app, routes, validation, metadata extraction
src/db.ts          Neon/Postgres tables, migrations, queries, contributors
src/dev.ts         Local Node dev server
public/index.html  Static fallback/dashboard asset
package.json       Dependencies and scripts
tsconfig.json      TypeScript configuration
```

## License

MIT

## Author

Built by [@saahiyo](https://github.com/saahiyo). Telegram: `@saahiyo`
