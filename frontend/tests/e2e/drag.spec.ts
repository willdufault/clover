import { expect, test, type Locator, type Page } from '@playwright/test'
import { seed, task as makeTask } from '../fakeBackend'
import {
  box,
  captureErrors,
  drag,
  glide,
  grab,
  lineSide,
  lineSides,
  mockApi,
  navRow,
  sweep,
  waitForDropAnimation,
} from './helpers'

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
      stage: 'open',
      order: 0,
    },
    { id: 's3', taskId: 'g1', title: 'Short', stage: 'open', order: 0 },
  )
  return data
}

const clone = (page: Page) => page.locator('[data-overlay]')

const boxes = (rows: Locator) =>
  rows.evaluateAll((els) =>
    els.map((el) => {
      const { x, y, width, height } = el.getBoundingClientRect()
      return { x, y, width, height }
    }),
  )

const dragAndCheck = async (page: Page, rows: Locator, row: Locator, to: Locator, side: 'above' | 'below' | null) => {
  const before = await box(row)
  const text = (await row.textContent()) ?? ''
  const targetText = await to.textContent()
  const start = await grab(page, row)
  await page.mouse.move(start.x, start.y + 10)
  await expect(row).toBeHidden()
  const settled = await boxes(rows)
  await glide(page, start, to, side === 'below' ? 0.75 : 0.25)
  await expect(clone(page)).toHaveCount(1)
  const overlay = await box(clone(page))
  expect(overlay.width).toBeCloseTo(before.width, 0)
  expect(overlay.height).toBeCloseTo(before.height, 0)
  await expect(clone(page)).toHaveText(text)
  await expect(row).toBeHidden()
  expect(await boxes(rows)).toEqual(settled)
  const sides = await lineSides(rows)
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

test('dropping a task back in its gap keeps the order and the hovered half picks the side', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  for (let i = 0; i < 3; i++) data.tasks.push(makeTask(`x${i}`, `Extra ${i}`, 'groceries'))
  await mockApi(page, data)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  await expect(rows).toHaveCount(5)
  const before = await rows.allTextContents()
  const start = await grab(page, rows.nth(2))
  await page.mouse.move(start.x, start.y + 10)
  const hover = async (index: number, at: number, side: 'above' | 'below') => {
    await glide(page, start, rows.nth(index), at)
    await expect.poll(() => lineSides(rows)).toEqual(before.map((_, i) => (i === index ? side : null)))
  }
  await hover(4, 0.25, 'above')
  await hover(4, 0.75, 'below')
  await hover(1, 0.75, 'below')
  await hover(3, 0.25, 'above')
  await page.mouse.up()
  await waitForDropAnimation(page)
  expect(await rows.allTextContents()).toEqual(before)
  expect(errors).toEqual([])
})

test('a slow drag keeps the drop line at the gap under the pointer', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  for (let i = 0; i < 5; i++) data.tasks.push(makeTask(`x${i}`, `Extra ${i}`, 'groceries'))
  await mockApi(page, data)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  await expect(rows).toHaveCount(7)
  const start = await grab(page, rows.nth(2))
  await page.mouse.move(start.x, start.y - 6)
  await sweep(rows, start, (to) => page.mouse.move(to.x, to.y))
  await page.mouse.up()
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
  await glide(page, start, rows.last(), 0.75)
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

  await page.reload()
  await expect.poll(titles).toEqual(['Eggs', 'Milk', 'Bread'])
  expect(errors).toEqual([])
})

const dropOn = async (page: Page, row: Locator, to: Locator, at: number) => {
  const start = await grab(page, row)
  await page.mouse.move(start.x, start.y + 10)
  await glide(page, start, to, at)
  await page.mouse.up()
  await waitForDropAnimation(page)
}

const texts = async (rows: Locator) => (await rows.allInnerTexts()).map((t) => t.trim())

test('a dragged list order survives a reload', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const lists = page.locator('nav [data-kind="list"]')
  const names = () => lists.allTextContents()
  await expect.poll(names).toEqual(['Groceries2', 'Work3', 'Home'])

  await dropOn(page, lists.first(), lists.last(), 0.75)
  await expect.poll(names).toEqual(['Work3', 'Home', 'Groceries2'])
  await page.reload()
  await expect.poll(names).toEqual(['Work3', 'Home', 'Groceries2'])
  expect(errors).toEqual([])
})

test('a dragged step order survives a reload', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const milk = page.locator('main [data-kind="task"]', { hasText: 'Milk' })
  const steps = page.locator('aside [data-kind="step"]')
  await milk.click()
  const input = page.getByPlaceholder('Add a step')
  for (const name of ['aaa', 'bbb']) {
    await input.fill(name)
    await input.press('Enter')
  }
  await expect.poll(() => texts(steps)).toEqual(['2% lactose free', 'aaa', 'bbb'])

  await dropOn(page, steps.last(), steps.first(), 0.25)
  await expect.poll(() => texts(steps)).toEqual(['bbb', '2% lactose free', 'aaa'])
  await page.reload()
  await milk.click()
  await expect.poll(() => texts(steps)).toEqual(['bbb', '2% lactose free', 'aaa'])
  expect(errors).toEqual([])
})

test('a task dragged to another list shows at its bottom', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  const titles = async () => (await rows.locator('span.break-words').allInnerTexts()).map((t) => t.trim())

  await drag(page, rows.filter({ hasText: 'Milk' }), page.locator('nav').getByText('Work'))
  await expect(rows.filter({ hasText: 'Milk' })).toHaveCount(0)
  await waitForDropAnimation(page)
  await navRow(page, 'Work').click()
  await expect.poll(titles).toEqual(['Review PR', 'Update docs', 'Reply to emails', 'Milk'])
  await page.reload()
  await navRow(page, 'Work').click()
  await expect.poll(titles).toEqual(['Review PR', 'Update docs', 'Reply to emails', 'Milk'])
  await page.screenshot({ path: 'test-results/drag-to-list-bottom.png' })
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
    await glide(page, start, rows.last(), 0.75)
    const lines = (await lineSides(rows)).filter(Boolean)
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

test('dragging a selected task moves every selected task', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.tasks.push(makeTask('g3', 'Bread', 'groceries'), makeTask('g4', 'Butter', 'groceries'))
  const backend = await mockApi(page, data)
  await page.goto('./')
  const main = page.locator('main')
  const nav = page.locator('nav')
  const row = (title: string) => main.locator('[data-kind="task"]', { hasText: title })
  const listOf = (id: string) => backend.data.tasks.find((t) => t.id === id)?.listId
  const selectBoth = async (a: string, b: string) => {
    await row(a).click({ modifiers: ['ControlOrMeta'] })
    await row(b).click({ modifiers: ['ControlOrMeta'] })
  }

  await selectBoth('Milk', 'Eggs')
  await expect(main.getByText('2 selected')).toBeVisible()
  const start = await grab(page, row('Milk'))
  await page.mouse.move(start.x, start.y + 10)
  await expect(row('Milk')).toBeHidden()
  await expect(row('Eggs')).toBeHidden()
  await page.mouse.move(start.x, start.y + 80)
  await expect(clone(page)).toHaveCount(1)
  await page.screenshot({ path: 'test-results/drag-multi-overlay.png' })
  await glide(page, start, nav.getByText('Home'))
  await page.mouse.up()
  await expect.poll(() => [listOf('g1'), listOf('g2')]).toEqual(['home', 'home'])
  await expect(row('Milk')).toHaveCount(0)
  await expect(row('Eggs')).toHaveCount(0)
  await waitForDropAnimation(page)

  await selectBoth('Bread', 'Butter')
  await drag(page, row('Bread'), nav.getByText('Today', { exact: true }))
  await expect
    .poll(() => ['g3', 'g4'].map((id) => backend.data.tasks.find((t) => t.id === id)?.addedToToday))
    .toEqual([true, true])
  await expect(row('Bread').getByTitle('In Today')).toBeVisible()
  await expect(row('Butter').getByTitle('In Today')).toBeVisible()
  await expect(main.getByText(/selected/)).toHaveCount(0)
  await waitForDropAnimation(page)

  await selectBoth('Bread', 'Butter')
  const patches: string[] = []
  page.on('request', (request) => request.method() === 'PATCH' && patches.push(request.url()))
  const again = await grab(page, row('Bread'))
  await page.mouse.move(again.x, again.y + 10)
  await expect(row('Bread')).toBeHidden()
  await expect(row('Butter')).toBeHidden()
  await glide(page, again, nav.getByText('Today', { exact: true }))
  await page.mouse.up()
  await waitForDropAnimation(page)
  await expect(row('Bread')).toBeVisible()
  await expect(row('Butter')).toBeVisible()
  expect(patches).toEqual([])

  await selectBoth('Bread', 'Butter')
  const cancelled = await grab(page, row('Bread'))
  await page.mouse.move(cancelled.x, cancelled.y + 10)
  await expect(row('Butter')).toBeHidden()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await waitForDropAnimation(page)
  await expect(row('Bread')).toBeVisible()
  await expect(row('Butter')).toBeVisible()

  await page.keyboard.press('Escape')
  await row('Bread').click()
  await drag(page, row('Butter'), nav.getByText('Work'))
  await expect.poll(() => listOf('g4')).toBe('work')
  expect(listOf('g3')).toBe('groceries')
  await expect(row('Bread')).toBeVisible()
  expect(errors).toEqual([])
})

test('dragging selected tasks within the list moves them together and the order sticks', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.tasks.push(
    makeTask('g3', 'Bread', 'groceries'),
    makeTask('g4', 'Butter', 'groceries'),
    makeTask('g5', 'Jam', 'groceries'),
  )
  await mockApi(page, data)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  const row = (title: string) => rows.filter({ hasText: title })
  const titles = async () => (await rows.locator('span.break-words').allInnerTexts()).map((t) => t.trim())
  await expect.poll(titles).toEqual(['Jam', 'Butter', 'Bread', 'Eggs', 'Milk'])

  await row('Butter').click({ modifiers: ['ControlOrMeta'] })
  await row('Eggs').click({ modifiers: ['ControlOrMeta'] })
  const start = await grab(page, row('Eggs'))
  await page.mouse.move(start.x, start.y - 10)
  await expect(row('Butter')).toBeHidden()
  await glide(page, start, rows.first(), 0.25)
  expect((await lineSides(rows)).filter(Boolean)).toEqual(['above'])
  await page.mouse.up()
  await expect.poll(titles).toEqual(['Butter', 'Eggs', 'Jam', 'Bread', 'Milk'])
  await waitForDropAnimation(page)

  await navRow(page, 'Work').click()
  await navRow(page, 'Groceries').click()
  await expect.poll(titles).toEqual(['Butter', 'Eggs', 'Jam', 'Bread', 'Milk'])
  expect(errors).toEqual([])
})
