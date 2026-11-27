import { defineConfig, devices } from '@playwright/test'

// testes de ponta a ponta: sobe a API e o site como em desenvolvimento e usa um Chromium de verdade.
// os arquivos terminam em .e2e.ts para o Vitest nao pegar
const ci = !!process.env.CI

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: ci ? 1 : 0,
  reporter: ci ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5600',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    { command: 'npx tsx server/dev.ts', url: 'http://localhost:8787/api/health', reuseExistingServer: !ci, timeout: 60_000 },
    { command: 'npx vite --port 5600 --strictPort', url: 'http://localhost:5600', reuseExistingServer: !ci, timeout: 60_000 }
  ]
})
