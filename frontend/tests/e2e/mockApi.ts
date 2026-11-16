import type { Page } from '@playwright/test'
import { createFakeBackend } from '../fakeBackend'

// Serves the API from an in-memory fake and signs in with a fake, unexpired token. No network.
export const mockApi = async (page: Page) => {
  const backend = createFakeBackend()
  const payload = btoa(JSON.stringify({ exp: 9999999999 }))
  await page.addInitScript((token) => localStorage.setItem('idToken', token), `x.${payload}.y`)
  await page.route(
    (url) => url.hostname.endsWith('.amazonaws.com'),
    async (route) => {
      const request = route.request()
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      const { status, body } = backend.handle(request.method(), request.url(), request.postDataJSON() ?? undefined)
      await route.fulfill({ status, headers, json: body })
    },
  )
  return backend
}
