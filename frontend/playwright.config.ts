import { defineConfig } from '@playwright/test'
import { base } from './vite.config'

const url = new URL(base, 'http://localhost:5173').href

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: url, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 0.5 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev',
    url,
    reuseExistingServer: true,
  },
})
