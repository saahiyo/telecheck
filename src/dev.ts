import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { serve } from '@hono/node-server'
import app from './index.js'
import { initDB } from './db.js'

const port = 3000

// Initialize database table on startup
initDB().then(() => {
  console.log(`Server is running on http://localhost:${port}`)
  serve({
    fetch: app.fetch,
    port
  })
}).catch((err) => {
  console.error('❌ Failed to initialize database:', err.message)
  // Start server anyway — DB features will just fail gracefully
  console.log(`Server is running on http://localhost:${port} (without DB)`)
  serve({
    fetch: app.fetch,
    port
  })
})
