import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 0.5 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
