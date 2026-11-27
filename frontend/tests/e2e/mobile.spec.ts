import { expect, test, type Locator, type Page } from '@playwright/test'
import { seed, task as makeTask } from '../fakeBackend'
import { tomorrow } from '../../src/dates'
import {
  captureErrors,
  center,
  finger,
  lineSides,
  longPress,
  mockApi,
  sweep,
  touchDrag,
  waitForDropAnimation,
} from './helpers'

test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

const texts = async (rows: Locator) => (await rows.allInnerTexts()).map((t) => t.split('\n')[0])

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

test('long-press opens the context menu on screen and a submenu replaces it in place', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('./')

  const rows = page.locator('main [data-kind="task"]')
  const row = rows.filter({ hasText: 'Eggs' })

  await longPress(page, row)
  const remove = page.getByRole('menuitem', { name: 'Delete' })
  await expect(remove).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(0)
  await expect(page.locator('[data-overlay]')).toHaveCount(0)
  await expect(row).toBeVisible()
  await page.getByRole('menuitem', { name: 'Set stage' }).tap()
  const done = page.getByRole('menuitemradio', { name: 'Done' })
  await expect(done).toBeVisible()
  await expect
    .poll(async () => {
      const box = await done.boundingBox()
      return !!box && box.x >= 0 && box.x + box.width <= 375 && box.y + box.height <= 667
    })
    .toBe(true)
  await done.tap()
  await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g2')?.stage).toBe('done')
  await expect(remove).toBeHidden()
  await waitForDropAnimation(page)
  await expect.poll(() => texts(rows)).toEqual(['Eggs', 'Milk'])
  await row.tap()
  await expect(page.locator('aside').getByRole('heading', { name: 'Eggs' })).toBeVisible()
  expect(errors).toEqual([])
})

test('long-press on a sidebar list opens its menu and step x buttons show on touch', async ({ page }) => {
  const errors = captureErrors(page)
  const backend = await mockApi(page)
  await page.goto('./')

  await page.getByLabel('Open lists').tap()
  await longPress(page, page.locator('nav [data-kind="list"]', { hasText: 'Home' }))
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
  await expect(page.getByText('Home', { exact: true }).last()).toBeVisible()
  await page.getByRole('menuitem', { name: 'Delete' }).tap()
  await expect.poll(() => backend.data.lists.map((l) => l.id)).toEqual(['groceries', 'work'])
  await page.mouse.click(360, 300)

  await page.locator('[data-kind="task"]', { hasText: 'Milk' }).tap()
  const remove = page.getByRole('button', { name: /^Delete step/ })
  await expect(remove).toBeVisible()
  const hit = await remove.evaluate((el) => {
    const { width, height } = getComputedStyle(el, '::before')
    return [parseFloat(width), parseFloat(height)]
  })
  expect(Math.min(...hit)).toBeGreaterThanOrEqual(44)
  await remove.tap()
  await expect.poll(() => backend.data.steps).toEqual([])
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

const touchReorder = async (
  page: Page,
  selector: string,
  expected: string[],
  open?: () => Promise<void>,
  data = seed(),
) => {
  const errors = captureErrors(page)
  await mockApi(page, data)
  await page.goto('./')
  await open?.()
  const rows = page.locator(selector)
  await expect(rows).toHaveCount(expected.length)
  await touchDrag(page, rows.last(), rows.first())
  await expect.poll(() => texts(rows)).toEqual(expected)
  expect(errors).toEqual([])
}

test('touch hold-then-move reorders a task', async ({ page }) => {
  await touchReorder(page, 'main [data-kind="task"]', ['Milk', 'Eggs'])
  await expect(page.locator('aside')).toHaveCount(0)
})

test('touch hold-then-move reorders a step', async ({ page }) => {
  const data = seed()
  data.steps.push({ id: 'g1b', taskId: 'g1', title: 'Whole', stage: 'open' })
  await touchReorder(
    page,
    'aside [data-kind="step"]',
    ['Whole', '2% lactose free'],
    () => page.locator('[data-kind="task"]', { hasText: 'Milk' }).tap(),
    data,
  )
})

test('touch hold-then-move reorders a list', async ({ page }) => {
  await touchReorder(page, 'nav [data-kind="list"]', ['Home', 'Groceries', 'Work'], () =>
    page.getByLabel('Open lists').tap(),
  )
})

test('a slow touch drag reorders instead of opening the menu', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  await expect(rows).toHaveCount(2)
  const before = await texts(rows)
  const from = await center(rows.last())
  const to = await center(rows.first(), 0.25)

  await rows.last().evaluate(
    async (target, { x, top, bottom }) => {
      const send = (type: string, y: number) => {
        const touch = new Touch({ identifier: 1, target, clientX: x, clientY: y })
        const touches = type === 'touchend' ? [] : [touch]
        target.dispatchEvent(
          new TouchEvent(type, { bubbles: true, cancelable: true, touches, changedTouches: [touch] }),
        )
      }
      send('touchstart', bottom)
      await new Promise((resolve) => setTimeout(resolve, 300))
      for (let y = bottom; y >= top; y -= 3) {
        send('touchmove', y)
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      send('touchend', top)
    },
    { x: from.x, top: to.y, bottom: from.y },
  )

  await expect.poll(() => texts(rows)).toEqual(before.toReversed())
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a touch drag from the middle collapses the row and marks the drop target', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  for (let i = 0; i < 3; i++) data.tasks.push(makeTask(`x${i}`, `Extra ${i}`, 'groceries'))
  await mockApi(page, data)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  await expect(rows).toHaveCount(5)
  const before = await texts(rows)
  const third = await rows.nth(2).boundingBox()

  const f = await finger(page, await center(rows.nth(2)))
  await page.locator('[data-overlay]').waitFor()
  await f.move(await center(rows.first()))
  expect(await rows.nth(2).boundingBox()).toBeNull()
  expect((await rows.nth(3).boundingBox())?.y).toBe(third?.y)
  await expect(rows.first()).toHaveClass(/before:bg-clover/)
  expect(await rows.first().evaluate((el) => getComputedStyle(el, '::before').height)).toBe('2px')
  await f.up()

  await expect.poll(() => texts(rows)).toEqual([before[2], before[0], before[1], before[3], before[4]])
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a touch drop back in its gap keeps the order and the hovered half picks the side', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  for (let i = 0; i < 3; i++) data.tasks.push(makeTask(`x${i}`, `Extra ${i}`, 'groceries'))
  await mockApi(page, data)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  await expect(rows).toHaveCount(5)
  const before = await texts(rows)
  const f = await finger(page, await center(rows.nth(2)))
  await page.locator('[data-overlay]').waitFor()
  const hover = async (index: number, at: number, side: 'above' | 'below') => {
    await f.move(await center(rows.nth(index), at))
    await expect.poll(() => lineSides(rows)).toEqual(before.map((_, i) => (i === index ? side : null)))
  }

  await hover(0, 0.25, 'above')
  await hover(4, 0.25, 'above')
  await hover(4, 0.75, 'below')
  await hover(1, 0.75, 'below')
  await hover(3, 0.25, 'above')
  await f.up()
  await waitForDropAnimation(page)
  expect(await texts(rows)).toEqual(before)
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a slow touch drag keeps the drop line at the gap under the finger', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  for (let i = 0; i < 5; i++) data.tasks.push(makeTask(`x${i}`, `Extra ${i}`, 'groceries'))
  await mockApi(page, data)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  await expect(rows).toHaveCount(7)
  const start = await center(rows.nth(2))
  const f = await finger(page, start)
  await page.locator('[data-overlay]').waitFor()
  await sweep(rows, start, (to) => f.move(to, 1))
  await f.up()
  expect(errors).toEqual([])
})

test('holding still keeps the list in place and shows no drop line before the menu', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const rows = page.locator('main [data-kind="task"]')
  await expect(rows).toHaveCount(2)
  const below = await rows.last().boundingBox()

  const f = await finger(page, await center(rows.first()))
  await page.locator('[data-overlay]').waitFor()
  expect(await rows.last().boundingBox()).toEqual(below)
  await expect(page.locator('main [class*="before:bg-clover"]')).toHaveCount(0)
  await expect(page.getByRole('menu')).toBeVisible()
  await f.up()
  expect(errors).toEqual([])
})

test.describe('touch laptop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false })

  test('touch-dragging a selected task moves only that task', async ({ page }) => {
    const errors = captureErrors(page)
    await mockApi(page)
    await page.goto('./')
    await page.locator('nav').getByText('Work').click()
    const rows = page.locator('main [data-kind="task"]')
    await rows.filter({ hasText: 'Reply' }).click()
    await rows.filter({ hasText: 'Update' }).click({ modifiers: ['Shift'] })
    await expect(page.locator('aside')).toHaveCount(0)

    await touchDrag(page, rows.filter({ hasText: 'Update' }), rows.first())

    await expect.poll(() => texts(rows)).toEqual(['Update docs', 'Review PR', 'Reply to emails'])
    expect(errors).toEqual([])
  })

  test('touch-dragging a task onto a sidebar list or Today does not move it', async ({ page }) => {
    const errors = captureErrors(page)
    const backend = await mockApi(page)
    await page.goto('./')
    const nav = page.locator('nav')
    const milk = page.locator('main [data-kind="task"]', { hasText: 'Milk' })

    await touchDrag(page, milk, nav.getByText('Home'))
    await waitForDropAnimation(page)
    await touchDrag(page, milk, nav.getByText('Today', { exact: true }))
    await waitForDropAnimation(page)

    await expect(milk).toBeVisible()
    expect(backend.data.tasks.find((t) => t.id === 'g1')).toMatchObject({ listId: 'groceries', addedToToday: false })
    expect(errors).toEqual([])
  })
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
    const menu = await page.getByRole('menu').boundingBox()
    const rowBox = await row.boundingBox()
    expect(menu && rowBox && menu.y >= rowBox.y + rowBox.height).toBe(true)
    await page.getByRole('menuitem', { name: 'Set stage' }).tap()
    await expect(page.getByRole('menuitemradio', { name: 'Done' })).toBeVisible()
    await page.getByLabel('Back').tap()
    await expect(page.getByRole('menuitemradio', { name: 'Done' })).toHaveCount(0)
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

test('the sort menu stays on screen and Sort hides on an empty list', async ({ page }) => {
  const errors = captureErrors(page)
  await mockApi(page)
  await page.goto('./')
  const menu = page.getByRole('menu')
  const onScreen = async () => {
    const box = await menu.boundingBox()
    return !!box && box.x >= 0 && box.x + box.width <= 375
  }

  await page.getByRole('button', { name: 'Sort' }).tap()
  expect(await onScreen()).toBe(true)
  await page.getByRole('menuitem', { name: 'Priority' }).tap()
  await page.getByRole('button', { name: 'Clear sort: Priority' }).tap()
  await expect(page.getByRole('button', { name: 'Sort' })).toBeVisible()
  await expect(menu).toHaveCount(0)

  await page.getByLabel('Open lists').tap()
  await page.locator('nav').getByText('Home').tap()
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sort' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test.describe('phone sheet submenus', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })

  test('long-press shows press feedback, then due date submenu replaces the sheet', async ({ page }) => {
    const errors = captureErrors(page)
    const backend = await mockApi(page)
    await page.goto('./')
    const row = page.locator('[data-kind="task"]', { hasText: 'Eggs' })
    const menu = page.getByRole('menu')

    const f = await finger(page, await center(row))
    await expect(row).toHaveClass(/scale-98/)
    await expect(menu).toBeVisible()
    await f.up()
    await expect(row).not.toHaveClass(/scale-98/)

    await menu.getByRole('menuitem', { name: 'Set due date' }).tap()
    await expect(menu.getByLabel('Back')).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
    await menu.getByRole('menuitemradio', { name: 'Tomorrow' }).tap()
    await expect(menu).toHaveCount(0)
    await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g2')?.due).toBe(tomorrow())
    expect(errors).toEqual([])
  })
})

test.describe('tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, reducedMotion: 'reduce' })

  test('long-press menu floats at the press point and Move to list replaces it in place', async ({ page }) => {
    const errors = captureErrors(page)
    const data = seed()
    for (let i = 1; i <= 20; i++) data.lists.push({ id: `l${i}`, name: `List ${i}` })
    const backend = await mockApi(page, data)
    await page.goto('./')
    const row = page.locator('main [data-kind="task"]', { hasText: 'Eggs' })
    const menu = page.getByRole('menu')
    const press = await center(row)
    const onScreen = async () => {
      const box = await menu.boundingBox()
      return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 820 && box.y + box.height <= 1180
    }

    await longPress(page, row)
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    const box = await menu.boundingBox()
    const rowBox = await row.boundingBox()
    expect(
      box && rowBox && Math.abs(box.x - press.x) < 10 && box.y >= rowBox.y + rowBox.height && box.width < 300,
    ).toBe(true)
    expect(await onScreen()).toBe(true)

    await menu.getByRole('menuitem', { name: 'Move to list' }).tap()
    const back = menu.getByLabel('Back')
    await expect(back).toBeVisible()
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
    expect(await onScreen()).toBe(true)
    expect((await menu.boundingBox())?.height).toBeLessThanOrEqual(384)
    expect(await menu.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)

    await menu.evaluate((el) => (el.scrollTop = el.scrollHeight))
    await expect.poll(() => menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    const menuBox = await menu.boundingBox()
    const backBox = await back.boundingBox()
    expect(menuBox && backBox && backBox.y >= menuBox.y && backBox.y - menuBox.y < 12).toBe(true)
    const last = menu.getByRole('menuitem', { name: 'List 20' })
    await expect(last).toBeInViewport()
    await last.tap()
    await expect.poll(() => backend.data.tasks.find((t) => t.id === 'g2')?.listId).toBe('l20')
    await expect(menu).toHaveCount(0)
    expect(errors).toEqual([])
  })
})

test('long-press on a step opens its menu and marks only that step done', async ({ page }) => {
  const errors = captureErrors(page)
  const data = seed()
  data.steps.push({ id: 'g1b', taskId: 'g1', title: 'Skim', stage: 'open' })
  const backend = await mockApi(page, data)
  await page.goto('./')
  await page.locator('[data-kind="task"]', { hasText: 'Milk' }).tap()

  await longPress(page, page.locator('aside [data-kind="step"]', { hasText: 'Skim' }))
  await page.getByRole('menuitem', { name: 'Set stage' }).tap()
  await page.getByRole('menuitemradio', { name: 'Done' }).tap()
  await expect(page.getByRole('menuitemradio', { name: 'Done' })).toHaveCount(0)
  await expect.poll(() => backend.data.steps.map((s) => s.stage)).toEqual(['open', 'done'])
  await expect(page.locator('aside')).toBeVisible()
  expect(errors).toEqual([])
})
