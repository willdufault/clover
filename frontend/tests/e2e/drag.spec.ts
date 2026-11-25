import { expect, test, type Locator, type Page } from '@playwright/test'
import { seed, task as makeTask } from '../fakeBackend'
import { box, captureErrors, drag, glide, grab, mockApi, navRow, waitForDropAnimation } from './helpers'

test('dragging a step keeps the panel open and reorders', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  await page.locator('[data-kind="task"]', { hasText: 'Milk' }).first().click()
  const input = page.getByPlaceholder('Add a step')
  for (const name of ['aaa', 'bbb', 'ccc']) {
    await input.fill(name)
    await input.press('Enter')
  }
  const steps = page.locator('aside [data-kind="step"]')
  const order = async () => (await steps.allInnerTexts()).map((t) => t.trim())
  const before = await order()

  await drag(page, steps.last(), steps.first())

  await expect(page.locator('aside')).toBeVisible()
  await expect.poll(order).not.toEqual(before)
  expect(errors).toEqual([])
})

test('dragging a task onto the last sidebar list moves it, and onto Today adds it', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('./')
  const main = page.locator('main')
  const nav = page.locator('nav')

  await drag(page, main.getByText('Milk', { exact: true }), nav.getByText('Home'))
  await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g1')?.listId).toBe('home')
  await expect(main.getByText('Milk', { exact: true })).toHaveCount(0)
  await expect(navRow(page, 'Home')).toHaveText('Home1')

  await waitForDropAnimation(page)
  await drag(page, main.getByText('Eggs', { exact: true }), nav.getByText('Today', { exact: true }))
  await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g2')?.addedToToday).toBe(true)
  await expect(main.locator('[data-kind="task"]', { hasText: 'Eggs' }).getByTitle('In Today')).toBeVisible()
  await waitForDropAnimation(page)
  const patches: string[] = []
  page.on('request', (request) => request.method() === 'PATCH' && patches.push(request.url()))
  await drag(page, main.getByText('Eggs', { exact: true }), nav.getByText('Today', { exact: true }))
  await waitForDropAnimation(page)
  expect(patches).toEqual([])
  await page.screenshot({ path: 'test-results/drag-task.png' })
  expect(errors).toEqual([])
})

test('dragging a task into a full list shows the limit error and keeps it in place', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  const handle = backend.handle
  backend.handle = (method, url, body) =>
    method === 'PATCH' ? { status: 409, body: { error: 'List is full' } } : handle(method, url, body)
  await page.goto('./')

  await drag(page, page.locator('main').getByText('Milk', { exact: true }), page.locator('nav').getByText('Work'))

  await expect(page.getByRole('alert')).toContainText('List is full')
  expect(backend.data.tasks.find((t) => t.id === 'g1')?.listId).toBe('groceries')
  await expect(page.locator('main [data-kind="task"]', { hasText: 'Milk' })).toBeVisible()
  await waitForDropAnimation(page)
  await page.screenshot({ path: 'test-results/limit-banner.png' })
  expect(errors.filter((e) => !e.startsWith('Failed to load resource'))).toEqual([])
})

const richSeed = () => {
  const data = seed()
  data.tasks.unshift(makeTask('long', 'A very long task title that wraps onto several lines '.repeat(4), 'groceries'))
  data.steps.push(
    {
      id: 's2',
      taskId: 'g1',
      title: 'A long step title that wraps across the narrow detail pane '.repeat(2),
      completed: false,
    },
    { id: 's3', taskId: 'g1', title: 'Short', completed: false },
  )
  return data
}

const clone = (page: Page) => page.locator('[data-overlay]')

const lineSide = (row: Locator) =>
  row.evaluate((el) => {
    const style = getComputedStyle(el, '::before')
    if (style.content === 'none') return null
    return style.top === '0px' ? 'above' : 'below'
  })

const boxes = (rows: Locator) => rows.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))

const dragAndCheck = async (page: Page, rows: Locator, row: Locator, to: Locator, side: 'above' | 'below' | null) => {
  const before = await box(row)
  const text = (await row.textContent()) ?? ''
  const targetText = await to.textContent()
  const start = await grab(page, row)
  await page.mouse.move(start.x, start.y + 10)
  await expect(row).toBeHidden()
  const settled = await boxes(rows)
  await glide(page, start, to)
  await expect(clone(page)).toHaveCount(1)
  const overlay = await box(clone(page))
  expect(overlay.width).toBeCloseTo(before.width, 0)
  expect(overlay.height).toBeCloseTo(before.height, 0)
  await expect(clone(page)).toHaveText(text)
  await expect(row).toBeHidden()
  expect(await boxes(rows)).toEqual(settled)
  const sides = await Promise.all((await rows.all()).map(lineSide))
  expect(sides.filter(Boolean)).toEqual(side ? [side] : [])
  if (side) expect(await lineSide(to)).toBe(side)
  await page.mouse.up()
  await waitForDropAnimation(page)
  await expect(clone(page)).toHaveCount(0)
  if (!side) return
  const texts = await rows.allTextContents()
  expect(texts.indexOf(text)).toBe(texts.indexOf(targetText ?? '') + (side === 'below' ? 1 : -1))
}

test('dragging hides the row and shows a drop line where it lands', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page, richSeed())
  await page.goto('./')
  await page.evaluate(() => document.fonts.ready)
  const tasks = page.locator('main [data-kind="task"]')
  const lists = page.locator('nav [data-kind="list"]')
  const steps = page.locator('aside [data-kind="step"]')

  await dragAndCheck(page, tasks, tasks.filter({ hasText: 'very long' }), tasks.first(), 'above')
  await dragAndCheck(page, tasks, tasks.filter({ hasText: 'Eggs' }), tasks.last(), 'below')
  await dragAndCheck(page, lists, lists.first(), lists.last(), 'below')

  await tasks.filter({ hasText: 'Milk' }).click()
  await page.locator('aside').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
  await dragAndCheck(page, steps, steps.filter({ hasText: 'long step' }), steps.last(), 'below')

  await dragAndCheck(page, tasks, tasks.filter({ hasText: 'Eggs' }), page.locator('nav').getByText('Work'), null)
  await expect(tasks.filter({ hasText: 'Eggs' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('new tasks show first and a dragged order sticks', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  const titles = async () => (await rows.locator('span.break-words').allInnerTexts()).map((t) => t.trim())
  await expect.poll(titles).toEqual(['Eggs', 'Milk'])

  await page.getByPlaceholder('Add a task').fill('Bread')
  await page.getByPlaceholder('Add a task').press('Enter')
  await expect.poll(titles).toEqual(['Bread', 'Eggs', 'Milk'])

  const start = await grab(page, rows.filter({ hasText: 'Bread' }))
  await page.mouse.move(start.x, start.y + 10)
  await glide(page, start, rows.last())
  await page.mouse.up()
  await expect.poll(titles).toEqual(['Eggs', 'Milk', 'Bread'])
  await waitForDropAnimation(page)

  await rows.filter({ hasText: 'Eggs' }).getByRole('button', { name: 'Mark done' }).click()
  await rows.filter({ hasText: 'Eggs' }).getByRole('button', { name: 'Mark open' }).click()
  await expect.poll(titles).toEqual(['Eggs', 'Milk', 'Bread'])

  await navRow(page, 'Work').click()
  await navRow(page, 'Groceries').click()
  await expect.poll(titles).toEqual(['Eggs', 'Milk', 'Bread'])
  await navRow(page, 'All').click()
  const all = await titles()
  expect(all.filter((t) => ['Eggs', 'Milk', 'Bread'].includes(t))).toEqual(['Eggs', 'Milk', 'Bread'])
  expect(errors).toEqual([])
})

test('dragging a task does not reorder while sorted but still moves it to a list', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page, richSeed())
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  const titles = async () => (await rows.locator('span.break-words').allInnerTexts()).map((t) => t.trim())
  await page.getByRole('button', { name: 'Sort' }).click()
  await page.getByRole('menuitem', { name: 'Priority' }).click()
  const sorted = await titles()

  const dragFirstToLast = async () => {
    const start = await grab(page, rows.first())
    await page.mouse.move(start.x, start.y + 10)
    await glide(page, start, rows.last())
    const lines = (await Promise.all((await rows.all()).map(lineSide))).filter(Boolean)
    await page.mouse.up()
    return lines
  }
  expect(await dragFirstToLast()).toEqual([])
  await waitForDropAnimation(page)
  await expect.poll(titles).toEqual(sorted)
  await expect(page.getByRole('button', { name: /^Clear sort/ })).toBeVisible()

  await drag(page, rows.filter({ hasText: 'Eggs' }), page.locator('nav').getByText('Work'))
  await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g2')?.listId).toBe('work')
  await waitForDropAnimation(page)

  await page.getByRole('button', { name: /^Clear sort/ }).click()
  const before = await titles()
  expect(await dragFirstToLast()).toEqual(['below'])
  await expect.poll(titles).toEqual([...before.slice(1), before[0]])
  expect(errors).toEqual([])
})
