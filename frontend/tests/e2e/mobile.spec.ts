import { expect, test, type Locator, type Page } from '@playwright/test'
import { seed, task as makeTask } from '../shared/fakeBackend'
import { captureErrors, mockApi } from './helpers'

test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

const center = async (locator: Locator) => {
  const bounds = await locator.boundingBox()
  if (!bounds) throw new Error('Element is not visible')
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

type Point = { x: number; y: number }

const finger = async (page: Page, from: Point) => {
  const cdp = await page.context().newCDPSession(page)
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Point[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
  let at = from
  await send('touchStart', [from])
  return {
    move: async (to: Point) => {
      const a = at
      for (let i = 1; i <= 10; i++)
        await send('touchMove', [{ x: a.x + (to.x - a.x) * (i / 10), y: a.y + (to.y - a.y) * (i / 10) }])
      at = to
    },
    up: () => send('touchEnd', []),
  }
}

const longPress = async (page: Page, target: Locator) => {
  const f = await finger(page, await center(target))
  await page.waitForTimeout(600)
  await f.up()
}

test('the lists drawer opens and closes', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const nav = page.locator('nav')

  await expect(nav).toBeHidden()
  await page.getByLabel('Open lists').tap()
  await expect(nav).toBeVisible()
  await nav.getByText('Work').tap()
  await expect(nav).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Work' })).toBeVisible()

  await page.getByLabel('Open lists').tap()
  await page.mouse.click(360, 300)
  await expect(nav).toBeHidden()

  await page.getByLabel('Open lists').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Close lists')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(nav).toBeHidden()
  await expect(page.getByLabel('Open lists')).toBeFocused()
  expect(errors).toEqual([])
})

test('task detail opens full screen and closes', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const aside = page.locator('aside')

  await page.locator('[data-kind="task"]', { hasText: 'Milk' }).tap()
  await expect(aside.getByRole('heading', { name: 'Milk' })).toBeVisible()
  await expect
    .poll(async () => Object.values((await aside.boundingBox()) ?? {}).map(Math.round))
    .toEqual([0, 0, 375, 667])
  await aside.getByLabel('Close panel').tap()
  await expect(aside).toHaveCount(0)
  expect(errors).toEqual([])
})

test('long-press opens the context menu on screen and its submenus expand on tap', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('./')

  await longPress(page, page.locator('[data-kind="task"]', { hasText: 'Eggs' }))
  const remove = page.getByRole('menuitem', { name: 'Delete' })
  await expect(remove).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Set stage' }).tap()
  const done = page.getByRole('menuitem', { name: '✅ Done' })
  await expect(done).toBeVisible()
  const box = await done.boundingBox()
  expect(box && box.x >= 0 && box.x + box.width <= 375 && box.y + box.height <= 667).toBe(true)
  await done.tap()
  await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g2')?.stage).toBe('done')
  await expect(remove).toBeHidden()
  expect(errors).toEqual([])
})

test('long-press on a sidebar list and on a step opens their menus', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('./')

  await page.getByLabel('Open lists').tap()
  await page.waitForTimeout(300)
  await longPress(page, page.locator('nav [data-kind="list"]', { hasText: 'Home' }))
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
  await expect(page.getByText('Home', { exact: true }).last()).toBeVisible()
  await page.getByRole('menuitem', { name: 'Delete' }).tap()
  await expect.poll(() => backend.data.lists.map((l) => l.id)).toEqual(['groceries', 'work'])
  await page.mouse.click(360, 300)

  await page.locator('[data-kind="task"]', { hasText: 'Milk' }).tap()
  await longPress(page, page.locator('aside [data-kind="step"]'))
  await page.getByRole('menuitem', { name: 'Mark as done' }).tap()
  await expect.poll(() => backend.data.steps[0]?.completed).toBe(true)
  expect(errors).toEqual([])
})

test('a quick swipe scrolls the list instead of opening the menu', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  for (let i = 0; i < 20; i++) data.tasks.push(makeTask(`x${i}`, `Extra ${i}`, 'groceries'))
  await mockApi(page, data)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  await expect(rows).toHaveCount(22)
  const before = await rows.allInnerTexts()

  const f = await finger(page, await center(rows.nth(4)))
  await f.move({ x: 187, y: 100 })
  await f.up()

  await expect.poll(() => page.locator('main').evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
  expect(await rows.allInnerTexts()).toEqual(before)
  await page.waitForTimeout(600)
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(errors).toEqual([])
})

test.describe('iPad portrait', () => {
  test.use({ viewport: { width: 1024, height: 1366 }, isMobile: false })

  test('detail is a sheet closed by its scrim, and the long-press menu stays by the row', async ({ page }) => {
    const errors = captureErrors(page)
    await mockApi(page)
    await page.goto('./')
    const row = page.locator('[data-kind="task"]', { hasText: 'Eggs' })

    await expect(page.locator('nav')).toBeVisible()
    await row.tap()
    await expect(page.locator('aside')).toBeVisible()
    await page.mouse.click(300, 1000)
    await expect(page.locator('aside')).toHaveCount(0)

    await longPress(page, row)
    const remove = page.getByRole('menuitem', { name: 'Delete', exact: true })
    await expect(remove).toBeVisible()
    const menu = await remove.locator('..').boundingBox()
    const rowBox = await row.boundingBox()
    expect(menu && rowBox && Math.abs(menu.y - (rowBox.y + rowBox.height / 2)) < 10).toBe(true)
    await page.getByRole('menuitem', { name: 'Set stage' }).tap()
    await expect(page.getByRole('menuitem', { name: '✅ Done' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Set stage' }).tap()
    await expect(page.getByRole('menuitem', { name: '✅ Done' })).toHaveCount(0)
    expect(errors).toEqual([])
  })
})

test('detail is a modal dialog on phones and stops being modal when the screen widens', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const row = page.locator('[data-kind="task"]', { hasText: 'Milk' })

  await row.tap()
  await expect(page.getByRole('dialog', { name: 'Milk' })).toBeVisible()
  await expect(page.getByLabel('Close panel')).toBeFocused()
  await expect(page.locator('main')).toHaveAttribute('inert')
  await page.keyboard.press('Escape')
  await expect(page.locator('aside')).toHaveCount(0)

  await page.getByLabel('Open lists').tap()
  await expect(page.locator('main')).toHaveAttribute('inert')
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.locator('main')).not.toHaveAttribute('inert')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await row.click()
  await expect(page.locator('aside')).not.toHaveAttribute('role')
  expect(errors).toEqual([])
})

test('long-press Move to list moves the task to another list', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('./')

  await longPress(page, page.locator('[data-kind="task"]', { hasText: 'Eggs' }))
  await page.getByRole('menuitem', { name: 'Move to list' }).tap()
  await expect(page.getByRole('menuitem', { name: 'Groceries' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Work' }).tap()

  await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g2')?.listId).toBe('work')
  await expect(page.locator('main [data-kind="task"]', { hasText: 'Eggs' })).toHaveCount(0)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.locator('aside')).toHaveCount(0)
  expect(errors).toEqual([])
})
