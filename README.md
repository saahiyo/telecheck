# 🚀 Telegram Link Checker API

A fast, lightweight **Telegram link validator API** built with **Hono**, deployed on **Vercel Edge Runtime**.

Live API:  
👉 **https://telecheck.vercel.app/**

This API checks whether a Telegram username, group, channel, or invite link **actually exists** — using Telegram’s public HTML signature instead of Telegram API credentials.

---

## 🔥 Features

- 🟢 No Telegram API credentials needed
- ⚡ Ultra-fast parallel checks via Promise.all()
- 🧹 Input normalization:
  - `@username` → `https://t.me/username`
  - `username123` → `https://t.me/username123`
- 🔍 Accurate validation using Telegram HTML metadata
- 📦 Batch validation (POST)
- 🗂 Grouped output: valid / invalid / unknown
- ⚙️ Single endpoint `/` for everything
- 🪶 Edge-optimized for lowest latency
- 🖥️ **Built-in Frontend Dashboard** for easy manual checking

---

## 📡 Endpoints

### ✅ 1. **Single Link Check** (GET)

```http
GET https://telecheck.vercel.app/?link=<telegram_link_or_username>
```

**Example:**
`https://telecheck.vercel.app/?link=@durov`

**Response:**
```json
{
  "input": "@durov",
  "normalized": "https://t.me/durov",
  "status": "valid",
  "reason": "Telegram page exists and is active",
  "credits": "@saahiyo"
}
```

---

### ✅ 2. **Multiple Links Check** (POST)

```http
POST https://telecheck.vercel.app/
Content-Type: application/json
```

**Body:**
```json
{
  "links": [
    "@durov",
    "t.me/example",
    "https://t.me/notfound12345"
  ]
}
```

**Response:**
```json
{
  "total": 3,
  "groups": {
    "valid": [
      { "url": "https://t.me/durov", "status": "valid", "reason": "..." }
    ],
    "invalid": [
      { "url": "https://t.me/notfound12345", "status": "invalid", "reason": "..." }
    ],
    "unknown": []
  },
  "credits": "@saahiyo"
}
```

---

### ℹ️ 3. **API Info** (GET)

Returns metadata about the API.

```http
GET https://telecheck.vercel.app/info
```

---

### 🏥 4. **Health Check** (GET)

Returns the API status and uptime.

```http
GET https://telecheck.vercel.app/health
```

---

### 📊 5. **Global Stats** (GET)

Returns usage statistics for the current deployment instance (resets on redeploy).

```http
GET https://telecheck.vercel.app/stats
```

---

### 🧹 6. **Normalize Link** (GET)

Test the normalization logic without performing a check.

```http
GET https://telecheck.vercel.app/normalize?value=@username
```

---

## 🖥️ Frontend Dashboard

The project includes a simple HTML frontend for manual testing.
Access it by visiting the root URL in a browser:

👉 **https://telecheck.vercel.app/**

Located in `public/index.html`.

---

## 🧠 How It Works

Telegram shows a public preview for every valid user/channel/group.  
If a Telegram entity exists, the HTML includes `tgme_page_title`.

**Validation logic:**
- Contains `tgme_page_title` → **VALID**
- Does not contain it → **INVALID**
- Network failure → **UNKNOWN**

This avoids Telegram API credentials and works for Users, Channels, Groups, Bots, and Invite links.

---

## 📁 Project Structure

```
src/
  └── index.ts       # Main API logic (Hono)
public/
  └── index.html     # Frontend Dashboard
package.json         # Dependencies & Scripts
README.md            # Documentation
```

---

## 📊 Status Meanings

| Status     | Meaning |
|------------|---------|
| **valid**   | Telegram page exists and is active |
| **invalid** | Page does not exist or unavailable |
| **unknown** | Network/timeout/other error |

---

## 🛠 Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run locally:**
   ```bash
   npm run dev
   ```
   This runs `vercel dev` to simulate the Edge environment.

3. **Open in browser:**
   - API: `http://localhost:3000`
   - Dashboard: `http://localhost:3000` (served from `public/`)

---

## 🔧 Deploy on Your Own Vercel Account

Just import your GitHub repo into Vercel — it detects Hono automatically.  
No environment variables required.

---

## 📜 License

MIT — free for personal and commercial use.

---

## 👨‍💻 Author

Telegram Link Checker built by **Shakir**  
Live API: https://telecheck.vercel.app/
