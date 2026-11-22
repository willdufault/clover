import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

export const base = '/clover/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  // Allow importing backend/limits.json.
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: 'tests/unit/setupTests.ts',
  },
})
