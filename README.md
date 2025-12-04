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

---

## 📡 Endpoints

### ✅ 1. **Single Link Check** (GET)

```
GET https://telecheck.vercel.app/?link=<telegram_link_or_username>
```

#### Example:

```
https://telecheck.vercel.app/?link=@durov
```

#### Example Response:

```json
{
  "input": "@durov",
  "normalized": "https://t.me/durov",
  "status": "valid",
  "reason": "Telegram page exists and is active"
}
```

---

### ✅ 2. **Multiple Links Check** (POST)

```
POST https://telecheck.vercel.app/
Content-Type: application/json
```

#### Body:

```json
{
  "links": [
    "@durov",
    "t.me/example",
    "https://t.me/notfound12345"
  ]
}
```

#### Response:

```json
{
  "total": 3,
  "groups": {
    "valid": [
      {
        "url": "https://t.me/durov",
        "status": "valid",
        "reason": "Telegram page exists and is active"
      }
    ],
    "invalid": [
      {
        "url": "https://t.me/notfound12345",
        "status": "invalid",
        "reason": "Telegram page does not exist or is unavailable"
      }
    ],
    "unknown": []
  }
}
```

---

## 🧠 How It Works

Telegram shows a public preview for every valid user/channel/group.  
If a Telegram entity exists, the HTML includes:

```
tgme_page_title
```

Validation logic:

- Contains `tgme_page_title` → **VALID**  
- Does not contain it → **INVALID**  
- Network failure → **UNKNOWN**

This avoids Telegram API credentials and works for:

- Users  
- Channels  
- Groups  
- Bots  
- Invite links  

---

## 🧪 Testing (Command Line)

### Single link:

```
curl "https://telecheck.vercel.app/?link=@durov"
```

### Multiple links:

```
curl -X POST "https://telecheck.vercel.app/" \
  -H "Content-Type: application/json" \
  -d '{"links":["@durov","t.me/notfound123"]}'
```

---

## 📁 Project Structure

```
src/
  └── index.ts
README.md
vercel.json
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

```
npm install
npm run dev
```

Local URL:

```
http://localhost:3000
```

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

