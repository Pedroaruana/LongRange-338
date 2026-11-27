import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seo } from './seo'

export default defineConfig({
  plugins: [react(), tailwindcss(), seo()],
  // em desenvolvimento a API roda em outro processo (npm run dev:api)
  server: { port: 5600, proxy: { '/api': 'http://localhost:8787' } }
})
