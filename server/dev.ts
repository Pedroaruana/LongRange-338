import { serve } from '@hono/node-server'
import { createApp } from './app'
import { memoryStore } from './store'

// API rodando local com ranking em memoria; o Vite repassa /api para ca
const port = Number(process.env.API_PORT ?? 8787)

serve({ fetch: createApp(memoryStore()).fetch, port }, () => {
  console.log(`API em http://localhost:${port}/api`)
})
