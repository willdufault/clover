import { expect, test } from '@playwright/test'
import { seed, task } from '../fakeBackend'
import { captureErrors, drag, mockApi } from './mockApi'

test('dragging a task into a full list shows the limit error and keeps it in place', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.tasks.push(...Array.from({ length: 17 }, (_, i) => task(`t${i}`, `T${i}`, 'work')))
  const backend = await mockApi(page, data)
  await page.goto('/')

  await drag(page, page.locator('main').getByText('Milk', { exact: true }), page.locator('nav').getByText('Work'))

  const alert = page.getByRole('alert')
  await expect(alert).toHaveText(/List task limit reached \(20\)/)
  expect(backend.data.tasks.find((t) => t.id === 'g1')!.listId).toBe('groceries')
  await expect(page.locator('main [data-kind="task"]', { hasText: 'Milk' })).toBeVisible()
  await page.waitForTimeout(500) // let the drop animation finish before the screenshot
  await page.screenshot({ path: 'test-results/limit-banner.png' })
  expect(errors).toEqual([])
})
