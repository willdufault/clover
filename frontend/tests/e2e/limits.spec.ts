import { expect, test } from '@playwright/test'
import { seed, task } from '../fakeBackend'
import { captureErrors, mockApi } from './mockApi'

test('dragging a task into a full list shows the limit error and keeps it in place', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.tasks.push(...Array.from({ length: 17 }, (_, i) => task(`t${i}`, `T${i}`, 'work')))
  const backend = await mockApi(page, data)
  await page.goto('/')

  const from = (await page.locator('main').getByText('Milk', { exact: true }).boundingBox())!
  const to = (await page.locator('nav').getByText('Work').boundingBox())!
  const [x0, y0] = [from.x + from.width / 2, from.y + from.height / 2]
  const [x1, y1] = [to.x + to.width / 2, to.y + to.height / 2]
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (x1 - x0) * (i / 10), y0 + (y1 - y0) * (i / 10))
  await page.mouse.up()

  const alert = page.getByRole('alert')
  await expect(alert).toHaveText(/List task limit reached \(20\)/)
  expect(backend.data.tasks.find((t) => t.id === 'g1')!.listId).toBe('groceries')
  await expect(page.locator('main [data-kind="task"]', { hasText: 'Milk' })).toBeVisible()
  await page.waitForTimeout(500) // let the drop animation finish before the screenshot
  await page.screenshot({ path: 'test-results/limit-banner.png' })
  expect(errors).toEqual([])
})
