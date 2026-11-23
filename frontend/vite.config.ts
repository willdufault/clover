import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { searchForWorkspaceRoot } from 'vite'
import { defineConfig } from 'vitest/config'

export const base = '/clover/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  // Allow importing the top-level shared/ folder.
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../shared'] } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: 'tests/unit/setupTests.ts',
  },
})
