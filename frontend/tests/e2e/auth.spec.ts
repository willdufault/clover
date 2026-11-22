import { expect, test } from '@playwright/test'
import { captureErrors } from './helpers'

test('a failed sign-in shows an error instead of looping', async ({ page }) => {
  const errors = captureErrors(page)
  const cognito: string[] = []
  await page.route(
    (url) => url.hostname.endsWith('.amazoncognito.com'),
    async (route) => {
      cognito.push(route.request().url())
      await route.fulfill({ status: 400, headers: { 'access-control-allow-origin': '*' }, json: {} })
    },
  )
  await page.route(
    (url) => url.hostname.endsWith('.amazonaws.com'),
    (route) =>
      route.fulfill({
        status: route.request().method() === 'OPTIONS' ? 204 : 401,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      }),
  )
  await page.goto('./?code=bogus')

  await expect(page.getByRole('alert')).toContainText('Sign-in failed')
  expect(new URL(page.url()).host).toBe('localhost:5173')
  expect(new URL(page.url()).search).toBe('')
  expect(cognito.filter((u) => u.includes('/oauth2/authorize'))).toEqual([])
  expect(errors.filter((e) => !e.includes('401'))).toEqual([])
  await page.screenshot({ path: 'test-results/signin-failed.png' })
})
