import type { Locator, Page } from '@playwright/test'
import { loadEnv } from 'vite'
import { createFakeBackend, seed } from '../fakeBackend'

export const mockApi = async (page: Page, data = seed()) => {
  const backend = createFakeBackend(data)
  const env = loadEnv('development', process.cwd())
  const key = `oidc.user:${env.VITE_COGNITO_ISSUER}:${env.VITE_COGNITO_CLIENT_ID}`
  const user = JSON.stringify({
    access_token: 'x',
    token_type: 'Bearer',
    profile: { sub: 'u' },
    expires_at: 9999999999,
  })
  await page.addInitScript(({ k, v }) => localStorage.setItem(k, v), { k: key, v: user })
  await page.route(
    (url) => url.hostname.endsWith('.amazonaws.com'),
    async (route) => {
      const request = route.request()
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
      }
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      const { status, body } = backend.handle(request.method(), request.url(), request.postDataJSON() ?? undefined)
      await route.fulfill({ status, headers, json: body })
    },
  )
  return backend
}

export const captureErrors = (page: Page) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

export const box = async (locator: Locator) => {
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('Element is not visible')
  return bounds
}

export const center = async (locator: Locator) => {
  const b = await box(locator)
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

export const grab = async (page: Page, from: Locator) => {
  const start = await center(from)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  return start
}

export const glide = async (page: Page, start: { x: number; y: number }, to: Locator) => {
  const end = await center(to)
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(start.x + (end.x - start.x) * (i / 10), start.y + (end.y - start.y) * (i / 10))
}

export const drag = async (page: Page, from: Locator, to: Locator) => {
  await glide(page, await grab(page, from), to)
  await page.mouse.up()
}

export const navRow = (page: Page, name: string) => page.locator('nav > div', { hasText: name })

export const waitForDropAnimation = (page: Page) => page.waitForTimeout(500)

export const pick = async (page: Page, trigger: Locator, option: string) => {
  await trigger.click()
  await page.getByRole('menuitemradio', { name: option, exact: true }).click()
}

export const stageButton = (row: Locator) => row.getByRole('button', { name: /^Stage: / })

type Point = { x: number; y: number }

export const finger = async (page: Page, from: Point) => {
  const cdp = await page.context().newCDPSession(page)
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Point[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
  let at = from
  await send('touchStart', [from])
  return {
    move: async (to: Point) => {
      for (let i = 1; i <= 10; i++)
        await send('touchMove', [{ x: at.x + (to.x - at.x) * (i / 10), y: at.y + (to.y - at.y) * (i / 10) }])
      at = to
    },
    up: () => send('touchEnd', []),
  }
}

export const longPress = async (page: Page, target: Locator) => {
  const f = await finger(page, await center(target))
  await page.waitForTimeout(600)
  await f.up()
}

export const touchDrag = async (page: Page, from: Locator, to: Locator) => {
  const f = await finger(page, await center(from))
  await page.locator('[data-overlay]').waitFor()
  await f.move(await center(to))
  await f.up()
}
