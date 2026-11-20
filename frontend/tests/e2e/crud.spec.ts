import { expect, test } from '@playwright/test'
import { today } from '../../src/dates'
import { seed, task as makeTask } from '../fakeBackend'
import { captureErrors, mockApi, navRow } from './mockApi'

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
  await main.getByRole('heading', { name: '📚 Reading' }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('📚 Books')
  await page.keyboard.press('Enter')
  await expect(main.getByRole('heading', { name: '📚 Books' })).toBeVisible()
  await expect(nav.getByText('📚 Books')).toBeVisible()

  await page.getByPlaceholder('+ New task').fill('Dune')
  await page.getByPlaceholder('+ New task').press('Enter')
  const task = main.locator('[data-kind="task"]', { hasText: 'Dune' })
  await task.click()

  await aside.getByRole('heading', { name: 'Dune' }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Dune Messiah')
  await page.keyboard.press('Enter')
  await expect(task).toContainText('Dune Messiah')

  const patches: string[] = []
  page.on('request', (r) => r.method() === 'PATCH' && patches.push(r.postData() ?? ''))
  await aside.getByRole('heading', { name: 'Dune Messiah' }).click()
  await page.keyboard.type('Nope')
  await page.keyboard.press('Escape')
  await expect(aside.getByRole('heading', { name: 'Dune Messiah' })).toBeVisible()
  await expect(task).toContainText('Dune Messiah')
  expect(patches.filter((b) => b.includes('Nope'))).toEqual([])

  // Focus stays in the input, so the next steps are typed straight in.
  await page.getByPlaceholder('+ New step').fill('Chapter 1')
  await page.getByPlaceholder('+ New step').press('Enter')
  await page.keyboard.type('Chapter 2')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Chapter 3')
  await page.keyboard.press('Enter')
  const steps = aside.locator('[data-kind="step"]')
  await expect(steps).toHaveText(['Chapter 1✕', 'Chapter 2✕', 'Chapter 3✕'])
  await steps.getByText('Chapter 2').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('Chapter Two')
  await page.keyboard.press('Enter')
  await steps.filter({ hasText: 'Chapter 3' }).getByRole('button', { name: 'Delete step' }).click()
  await expect(steps).toHaveText(['Chapter 1✕', 'Chapter Two✕'])
  const checkbox = aside.locator('[data-kind="step"]', { hasText: 'Chapter 1' }).getByRole('checkbox')
  await checkbox.click()
  await expect(checkbox).toBeChecked()
  await expect(task).toContainText('1/2 steps')

  await aside.locator('select').first().selectOption('inProgress')
  await aside.locator('input[type="date"]').fill('2030-01-02')
  await expect(navRow(page, '☀️ Today')).toHaveText('☀️ Today')
  await aside.getByText('☀️ Add to Today').click()
  await expect(navRow(page, '☀️ Today')).toHaveText('☀️ Today1')
  await aside.locator('select').last().selectOption('high')
  await expect(task).toContainText('☀️ Today')
  await expect(task).toContainText('📅 Wed Jan 2')
  await expect(task).toContainText('🔴 High')
  await expect(task.getByRole('combobox')).toHaveValue('inProgress')
  await page.screenshot({ path: 'test-results/crud-panel.png' })

  await nav.getByText('☀️ Today').click()
  await expect(main.locator('[data-kind="task"]', { hasText: 'Dune Messiah' })).toBeVisible()
  await page.screenshot({ path: 'test-results/crud.png' })

  expect(backend.data.tasks.find((t) => t.title === 'Dune Messiah')).toMatchObject({
    stage: 'inProgress',
    due: '2030-01-02',
    addedToToday: true,
    priority: 'high',
  })
  expect(backend.data.steps.find((s) => s.title === 'Chapter 1')).toMatchObject({ completed: true })
  expect(backend.data.steps.map((s) => s.title)).toEqual(['2% lactose free', 'Chapter 1', 'Chapter Two'])

  await nav.getByText('📚 Books').click()
  await task.click()
  await aside.getByRole('button', { name: '×', exact: true }).click()
  await expect(task).not.toContainText('📅')
  await expect.poll(() => backend.data.tasks.find((t) => t.title === 'Dune Messiah')?.due).toBeNull()
  await aside.getByRole('button', { name: 'Remove from Today' }).click()
  await expect(navRow(page, '☀️ Today')).toHaveText('☀️ Today')
  await expect(task).not.toContainText('☀️ Today')
  await page.keyboard.press('Escape')
  await expect(aside).toHaveCount(0)

  // Deleting the selected (last) list selects its neighbour.
  await nav.getByText('📚 Books').click({ button: 'right' })
  await page.getByText('Delete', { exact: true }).click()
  await expect(nav.getByText('📚 Books')).toHaveCount(0)
  await expect(main.getByRole('heading', { name: 'Home' })).toBeVisible()
  await nav.getByText('📋 All').click()
  await expect(main.getByText('Dune Messiah')).toHaveCount(0)
  expect(backend.data.tasks.some((t) => t.title === 'Dune Messiah')).toBe(false)
  expect(errors).toEqual([])
})

test('add in All and Today, row stage, single delete, sort', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('/')

  const main = page.locator('main')
  const rows = main.locator('[data-kind="task"]')
  await expect(navRow(page, '📋 All')).toHaveText('📋 All5')
  await expect(navRow(page, 'Groceries')).toHaveText('Groceries2')
  await expect(navRow(page, 'Home')).toHaveText('Home')

  await navRow(page, '📋 All').click()
  await page.getByPlaceholder('+ New task').fill('Call mom')
  await page.getByPlaceholder('+ New task').press('Enter')
  await expect(rows.first()).toContainText('Call mom')
  await expect(navRow(page, '📋 All')).toHaveText('📋 All6')
  expect(backend.data.tasks.find((t) => t.title === 'Call mom')).toMatchObject({ listId: null, addedToToday: false })
  for (const list of ['Groceries', 'Work', 'Home']) {
    await navRow(page, list).click()
    await expect(main.getByRole('heading', { name: list })).toBeVisible()
    await expect(main.getByText('Call mom')).toHaveCount(0)
  }

  await navRow(page, '☀️ Today').click()
  await page.getByPlaceholder('+ New task').fill('Water plants')
  await page.getByPlaceholder('+ New task').press('Enter')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Water plants')
  await expect(navRow(page, '☀️ Today')).toHaveText('☀️ Today1')
  await expect(navRow(page, '📋 All')).toHaveText('📋 All7')
  await navRow(page, '📋 All').click()
  const water = rows.filter({ hasText: 'Water plants' })
  await expect(water).toBeVisible()

  await water.getByRole('combobox').selectOption('done')
  await expect(water.getByRole('combobox')).toHaveValue('done')
  await expect.poll(() => backend.data.tasks.find((t) => t.title === 'Water plants')?.stage).toBe('done')

  const call = rows.filter({ hasText: 'Call mom' })
  await call.click()
  await expect(page.locator('aside')).toBeVisible()
  await call.click({ button: 'right' })
  await page.getByText('Delete', { exact: true }).click()
  await expect(call).toHaveCount(0)
  await expect(page.locator('aside')).toHaveCount(0)
  await expect(navRow(page, '📋 All')).toHaveText('📋 All6')
  expect(backend.data.tasks.some((t) => t.title === 'Call mom')).toBe(false)
  await rows.filter({ hasText: 'Review PR' }).click()
  await page.locator('aside').getByRole('button', { name: 'Delete task' }).click()
  await expect(rows.filter({ hasText: 'Review PR' })).toHaveCount(0)
  await expect(page.locator('aside')).toHaveCount(0)
  expect(backend.data.tasks.some((t) => t.title === 'Review PR')).toBe(false)

  // The done task moves from first to last.
  await expect(rows.first()).toContainText('Water plants')
  await page.getByRole('button', { name: 'Sort' }).click()
  await page.getByRole('button', { name: 'Stage', exact: true }).click()
  await expect(rows.last()).toContainText('Water plants')
  await expect(rows.first()).toContainText('Milk')
  await page.screenshot({ path: 'test-results/add-sort.png' })
  expect(errors).toEqual([])
})

test('bulk range select, menu actions and delete each send one request', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.tasks.splice(2, 0, makeTask('g3', 'Bread', 'groceries'))
  const backend = await mockApi(page, data)
  const writes: string[] = []
  page.on(
    'request',
    (r) => ['PATCH', 'DELETE'].includes(r.method()) && writes.push(`${r.method()} ${new URL(r.url()).pathname}`),
  )
  await page.goto('/')

  const main = page.locator('main')
  const milk = main.locator('[data-kind="task"]', { hasText: 'Milk' })
  const eggs = main.locator('[data-kind="task"]', { hasText: 'Eggs' })
  const bread = main.locator('[data-kind="task"]', { hasText: 'Bread' })
  const groceries = () => backend.data.tasks.filter((t) => t.listId === 'groceries')
  await milk.click()
  await expect(page.locator('aside')).toBeVisible()
  await bread.click({ modifiers: ['Shift'] })
  await expect(main.getByText('3 selected')).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(0)
  await eggs.click({ modifiers: ['ControlOrMeta'] })
  await expect(main.getByText('2 selected')).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(0)
  await eggs.click({ modifiers: ['ControlOrMeta'] })
  await expect(main.getByText('3 selected')).toBeVisible()

  await eggs.click({ button: 'right' })
  await page.getByText('Set priority').hover()
  await page.getByRole('button', { name: '🔴 High' }).click()
  await expect(main.getByText('🔴 High')).toHaveCount(3)
  expect(groceries().map((t) => t.priority)).toEqual(['high', 'high', 'high'])

  await eggs.click({ button: 'right' })
  await page.getByText('Set stage').hover()
  await page.getByRole('button', { name: '⚡ In progress' }).click()
  for (const row of [milk, eggs, bread]) await expect(row.getByRole('combobox')).toHaveValue('inProgress')
  expect(groceries().map((t) => t.stage)).toEqual(['inProgress', 'inProgress', 'inProgress'])

  await eggs.click({ button: 'right' })
  await page.getByText('Set due date').hover()
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(main.getByText('📅 Today')).toHaveCount(3)
  expect(groceries().map((t) => t.due)).toEqual([today(), today(), today()])

  await eggs.click({ button: 'right' })
  await page.getByRole('button', { name: '☀️ Add to Today' }).click()
  await expect(main.getByText('☀️ Today')).toHaveCount(3)
  await expect(navRow(page, '☀️ Today')).toHaveText('☀️ Today3')
  expect(groceries().map((t) => t.addedToToday)).toEqual([true, true, true])
  await expect(main.getByText('3 selected')).toBeVisible()
  await page.screenshot({ path: 'test-results/bulk.png' })

  await eggs.click({ button: 'right' })
  await page.getByText('Delete', { exact: true }).click()
  await expect(main.locator('[data-kind="task"]')).toHaveCount(0)
  expect(backend.data.tasks.map((t) => t.id)).toEqual(['w1', 'w2', 'w3'])
  expect(backend.data.steps).toEqual([])
  expect(writes).toEqual(['PATCH /tasks', 'PATCH /tasks', 'PATCH /tasks', 'PATCH /tasks', 'DELETE /tasks'])
  expect(errors).toEqual([])
})

test('a partly cleared due date is not saved, and a failed save shows the saved date', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.tasks = data.tasks.map((t) => (t.id === 'g1' ? { ...t, due: '2030-01-02' } : t))
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
  expect(backend.data.tasks.find((t) => t.id === 'g1')?.due).toBe('2030-01-02')

  const handle = backend.handle
  backend.handle = (method, url, body) =>
    method === 'PATCH' ? { status: 409, body: { error: 'Boom.' } } : handle(method, url, body)
  await input.fill('2031-05-06')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toHaveText(/Boom/)
  await expect(input).toHaveValue('2030-01-02')
  await page.screenshot({ path: 'test-results/due-failed-save.png' })
  expect(backend.data.tasks.find((t) => t.id === 'g1')?.due).toBe('2030-01-02')
  await page.getByRole('button', { name: 'Dismiss error' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  // The browser logs the expected failed request; nothing else.
  expect(errors.filter((e) => !e.startsWith('Failed to load resource'))).toEqual([])
})
