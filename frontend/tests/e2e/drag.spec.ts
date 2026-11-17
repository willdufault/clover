import { expect, test } from '@playwright/test'
import { captureErrors, drag, mockApi } from './mockApi'

test('dragging a step keeps the panel open and reorders', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('/')
  await page.locator('[data-kind="task"]', { hasText: 'Milk' }).first().click()
  const input = page.getByPlaceholder('+ New step')
  for (const name of ['aaa', 'bbb', 'ccc']) {
    await input.fill(name)
    await input.press('Enter')
  }
  const steps = page.locator('aside [data-kind="step"]')
  const order = async () => (await steps.allInnerTexts()).map((t) => t.replace('✕', '').trim())
  const before = await order()

  await drag(page, steps.last(), steps.first())

  await expect(page.locator('aside')).toBeVisible()
  await expect.poll(order).not.toEqual(before)
  expect(errors).toEqual([])
})

test('dragging a task onto the last sidebar list moves it, and onto Today adds it', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('/')
  const main = page.locator('main')
  const nav = page.locator('nav')

  // Regression: the last list was not a drop target.
  await drag(page, main.getByText('Milk', { exact: true }), nav.getByText('Home'))
  await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g1')!.listId).toBe('home')
  await expect(main.getByText('Milk', { exact: true })).toHaveCount(0)
  await expect(nav.locator(':scope > div', { hasText: 'Home' })).toHaveText('Home1')

  await page.waitForTimeout(500) // let the drop animation finish
  await drag(page, main.getByText('Eggs', { exact: true }), nav.getByText('☀️ Today'))
  await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g2')!.addedToToday).toBe(true)
  await expect(main.locator('[data-kind="task"]', { hasText: 'Eggs' })).toContainText('☀️ Today')
  await page.waitForTimeout(500) // let the drop animation finish before the screenshot
  await page.screenshot({ path: 'test-results/drag-task.png' })
  expect(errors).toEqual([])
})
