import { expect, test } from '@playwright/test'
import limits from '../../../backend/limits.json' with { type: 'json' }
import { seed, task } from '../fakeBackend'
import { captureErrors, drag, mockApi, waitForDropAnimation } from './mockApi'

test('dragging a task into a full list shows the limit error and keeps it in place', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.tasks.push(...Array.from({ length: limits.tasksPerList - 3 }, (_, i) => task(`t${i}`, `T${i}`, 'work')))
  const backend = await mockApi(page, data)
  await page.goto('/')

  await drag(page, page.locator('main').getByText('Milk', { exact: true }), page.locator('nav').getByText('Work'))

  const alert = page.getByRole('alert')
  await expect(alert).toContainText(`List task limit reached (${limits.tasksPerList})`)
  expect(backend.data.tasks.find((t) => t.id === 'g1')?.listId).toBe('groceries')
  await expect(page.locator('main [data-kind="task"]', { hasText: 'Milk' })).toBeVisible()
  await waitForDropAnimation(page)
  await page.screenshot({ path: 'test-results/limit-banner.png' })
  expect(errors).toEqual([])
})
