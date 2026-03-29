# 🚀 TeleCheck: Multi-Platform Link Validator API

A fast, lightweight link validator API for **Telegram** and **MEGA**, built with **Hono** and powered by **Neon Database**.

Live API:  
👉 **https://telecheck.vercel.app/**

---

## 🔥 Features

- 🟢 **No API credentials needed** — uses public HTML signatures.
- 📂 **Multi-Platform Support**: Validate Telegram (users, groups, channels, bots) and MEGA (files, folders) links.
- ⚡ **Ultra-fast Parallel Checks** via `Promise.all()`.
- 💾 **Database Persistence** — automatically saves valid links to a Neon (PostgreSQL) database.
- 🧹 **Input Normalization**:
  - `@username` → `https://t.me/username`
  - `username123` → `https://t.me/username123`
- 🔍 **Rich Metadata Extraction**:
  - **Telegram**: Title, description, photo, member count, and type (channel/group/user).
  - **MEGA**: File/folder name, description, and status (valid/expired).
- 📦 **Batch Validation** (POST).
- ⚙️ **In-Memory Caching** (5 min TTL) for repeated queries.
- 📊 **Usage Stats** & Global history endpoints.

---

## 📡 Endpoints

### ✅ 1. **Single Link Check** (GET)
Check a single link or Telegram username.

```http
GET https://telecheck.vercel.app/?link=@durov
```

**Response:**
```json
{
  "input": "@durov",
  "normalized": "https://t.me/durov",
  "status": "valid",
  "platform": "telegram",
  "metadata": {
    "title": "Pavel Durov",
    "description": "Founder of Telegram...",
    "photo": "https://...",
    "type": "user",
    "memberCount": null
  },
  "cached": false,
  "credits": "@saahiyo",
  "responseTime": 150
}
```

---

### ✅ 2. **Batch Link Check** (POST)
Validate multiple links at once.

```http
POST https://telecheck.vercel.app/
Content-Type: application/json
```

**Body:**
```json
{
  "links": [
    "@shakir",
    "https://mega.nz/file/xxxx",
    "https://t.me/invalid_user_123"
  ]
}
```

---

### 🗄️ 3. **Query Stored Links** (GET)
Retrieve recently validated links saved in the database.

```http
GET https://telecheck.vercel.app/links?platform=telegram&limit=10
```

- `platform`: `telegram` or `mega` (optional)
- `limit`: Default 50
- `offset`: For pagination

---

### 📊 4. **API & DB Stats** (GET)
- `/stats`: Runtime metrics (uptime, cache hits, memory stats).
- `/links/stats`: Database counts per platform.

---

### 🧹 5. **Re-validate & Clean Database** (POST)
Perform a fresh check on links already stored in the database. Valid links are updated with the latest metadata, and invalid/expired links are automatically deleted.

```http
POST https://telecheck.vercel.app/links/validate?limit=all
```

- `limit`: `50` (default), or `all` to process the entire database.
- `platform`: `telegram` or `mega` (optional) to filter which links to re-validate.
- `offset`: For pagination.

**Safety Features:**
- **Batching**: Processes links in parallel chunks of 20 to prevent timeouts.
- **Throttling**: 500ms delay between batches to avoid rate limits.
- **Cache Bypass**: Always fetches fresh status from the source.

---

### ℹ️ 6. **Utilities** (GET)
- `/health`: API health check.
- `/info`: API version and supported features.
- `/normalize?value=@user`: Test the normalization logic without a fetch check.

---

## 🧠 How It Works

- **Telegram**: Detects validity via the presence of `tgme_page_title` in the public web preview.
- **MEGA**: Inspects Open Graph (OG) tags and metadata to distinguish between active content and generic "File not found" placeholders.

---

## 📁 Project Structure

```text
src/
  ├── index.ts       # Main API router & check logic
  ├── db.ts          # Neon DB (PostgreSQL) operations
  └── dev.ts         # Local development entry point
public/
  └── index.html     # Frontend Dashboard
package.json         # Dependencies & Scripts
```

---

## 🛠 Local Development

1. **Clone the repo.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Environment:**
   Create a `.env.local` file with:
   ```env
   POSTGRES_URL=your_neon_db_url
   ```
4. **Run development server:**
   ```bash
   npm run dev
   ```

---

## 🔧 Deployment

The project is optimized for **Vercel Edge Runtime**. 

1. Push to GitHub.
2. Link project to Vercel.
3. Add `POSTGRES_URL` to Vercel environment variables.

---

## 📜 License

MIT — free for personal and commercial use.

---

## 👨‍💻 Author

Built by **[@saahiyo](https://github.com/saahiyo)**.  
Telegram: **@saahiyo**
