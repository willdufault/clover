import { expect, test } from '@playwright/test'
import { seed } from '../fakeBackend'
import { captureErrors, mockApi } from './mockApi'

test('create, edit, set stage/due/Today and delete against the API', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('/')

  const nav = page.locator('nav')
  const main = page.locator('main')
  const aside = page.locator('aside')

  await page.getByPlaceholder('+ New list').fill('📚 Reading')
  await page.getByPlaceholder('+ New list').press('Enter')
  await expect(main.getByRole('heading', { name: '📚 Reading' })).toBeVisible()

  await page.getByPlaceholder('+ New task').fill('Dune')
  await page.getByPlaceholder('+ New task').press('Enter')
  const task = main.locator('[data-kind="task"]', { hasText: 'Dune' })
  await task.click()

  await aside.getByRole('heading', { name: 'Dune' }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Dune Messiah')
  await page.keyboard.press('Enter')
  await expect(task).toContainText('Dune Messiah')

  await page.getByPlaceholder('+ New step').fill('Chapter 1')
  await page.getByPlaceholder('+ New step').press('Enter')
  const checkbox = aside.locator('[data-kind="step"]', { hasText: 'Chapter 1' }).getByRole('checkbox')
  await checkbox.click()
  await expect(checkbox).toBeChecked()

  await aside.locator('select').first().selectOption('inProgress')
  await aside.locator('input[type="date"]').fill('2030-01-02')
  await aside.getByText('☀️ Add to Today').click()
  await expect(task).toContainText('☀️ Today')
  await expect(task).toContainText('📅 Wed Jan 2')
  await expect(task.getByRole('combobox')).toHaveValue('inProgress')

  await nav.getByText('☀️ Today').click()
  await expect(main.locator('[data-kind="task"]', { hasText: 'Dune Messiah' })).toBeVisible()
  await page.screenshot({ path: 'test-results/crud.png' })

  expect(backend.data.tasks.find((t) => t.title === 'Dune Messiah')).toMatchObject({
    stage: 'inProgress',
    due: '2030-01-02',
    addedToToday: true,
  })
  expect(backend.data.steps.find((s) => s.title === 'Chapter 1')).toMatchObject({ completed: true })

  await nav.getByText('📚 Reading').click({ button: 'right' })
  await page.getByText('Delete', { exact: true }).click()
  await expect(nav.getByText('📚 Reading')).toHaveCount(0)
  await nav.getByText('📋 All').click()
  await expect(main.getByText('Dune Messiah')).toHaveCount(0)
  expect(backend.data.tasks.some((t) => t.title === 'Dune Messiah')).toBe(false)
  expect(errors).toEqual([])
})

test('bulk priority and delete each send one request', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  const writes: string[] = []
  page.on('request', (r) => ['PATCH', 'DELETE'].includes(r.method()) && writes.push(`${r.method()} ${new URL(r.url()).pathname}`))
  await page.goto('/')

  const main = page.locator('main')
  const milk = main.locator('[data-kind="task"]', { hasText: 'Milk' })
  const eggs = main.locator('[data-kind="task"]', { hasText: 'Eggs' })
  await milk.click()
  await eggs.click({ modifiers: ['ControlOrMeta'] })
  await eggs.click({ button: 'right' })
  await page.getByText('Set priority').hover()
  await page.getByRole('button', { name: '🔴 High' }).click()
  await expect(main.getByText('🔴 High')).toHaveCount(2)
  await page.screenshot({ path: 'test-results/bulk.png' })
  expect(backend.data.tasks.filter((t) => t.priority === 'high').map((t) => t.id)).toEqual(['g1', 'g2'])

  await eggs.click({ button: 'right' })
  await page.getByText('Delete', { exact: true }).click()
  await expect(main.locator('[data-kind="task"]')).toHaveCount(0)
  expect(backend.data.tasks.map((t) => t.id)).toEqual(['w1', 'w2', 'w3'])
  expect(backend.data.steps).toEqual([])
  expect(writes).toEqual(['PATCH /tasks', 'DELETE /tasks'])
  expect(errors).toEqual([])
})

test('a partly cleared due date is not saved, and a failed save shows the saved date', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.tasks.find((t) => t.id === 'g1')!.due = '2030-01-02'
  const backend = await mockApi(page, data)
  await page.goto('/')
  await page.locator('main').getByText('Milk', { exact: true }).click()
  const aside = page.locator('aside')
  const input = aside.locator('input[type="date"]')

  // Backspace the day segment (mm/dd/yyyy), then blur.
  await input.click()
  await input.press('ArrowRight')
  await input.press('Backspace')
  expect(await input.evaluate((el: HTMLInputElement) => el.validity.badInput)).toBe(true)
  await aside.getByRole('heading', { name: 'Schedule' }).click()
  await expect(input).toHaveValue('2030-01-02')
  expect(backend.data.tasks.find((t) => t.id === 'g1')!.due).toBe('2030-01-02')

  const handle = backend.handle
  backend.handle = (method, url, body) => (method === 'PATCH' ? { status: 409, body: { error: 'Boom.' } } : handle(method, url, body))
  await input.fill('2031-05-06')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toHaveText(/Boom/)
  await expect(input).toHaveValue('2030-01-02')
  await page.screenshot({ path: 'test-results/due-failed-save.png' })
  expect(backend.data.tasks.find((t) => t.id === 'g1')!.due).toBe('2030-01-02')
  // The browser logs the expected failed request; nothing else.
  expect(errors.filter((e) => !e.startsWith('Failed to load resource'))).toEqual([])
})
