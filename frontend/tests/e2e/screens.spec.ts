import { expect, test, type Locator } from '@playwright/test'
import { join } from 'node:path'
import { today } from '../../src/dates'
import { task } from '../fakeBackend'
import { captureErrors, longPress, mockApi } from './helpers'

const dir = process.env.SCREENS_DIR

const VIEWPORTS: [number, number, boolean][] = [
  [320, 568, true],
  [375, 812, true],
  [430, 932, true],
  [768, 1024, true],
  [1024, 768, true],
  [1440, 900, false],
  [2560, 1440, false],
]

const day = (offset: number) => {
  const date = new Date(`${today()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

const gardenSeed = () => ({
  lists: [
    { id: 'garden', name: 'Garden' },
    { id: 'errands', name: 'Errands' },
    { id: 'reading', name: 'Reading list for the long winter evenings' },
    { id: 'someday', name: 'Someday' },
  ],
  tasks: [
    {
      ...task('t1', 'Turn the compost heap', 'garden'),
      stage: 'inProgress',
      priority: 'high',
      due: day(-2),
      addedToToday: true,
    },
    {
      ...task('t2', 'Order seed potatoes and onion sets before the spring rush sells out the good varieties', 'garden'),
      priority: 'low',
      due: day(1),
    },
    { ...task('t3', 'Sharpen pruning shears', 'garden'), stage: 'waiting' },
    {
      ...task(
        't4',
        'Mend the gap in the north fence where the deer keep getting through near the old apple tree',
        'garden',
      ),
      priority: 'high',
      due: day(5),
    },
    task('t5', 'Prick out tomato seedlings', 'garden'),
    { ...task('t6', 'Plant garlic', 'garden'), stage: 'done' },
    { ...task('t7', 'Repaint the shed', 'garden'), stage: 'cancelled' },
    task('t8', 'Pick up twine', 'errands'),
  ],
  steps: [
    { id: 's1', taskId: 't1', title: 'Fork over the top layer', completed: true },
    {
      id: 's2',
      taskId: 't1',
      title: 'Add a barrow of leaf mould and the coffee grounds from the café',
      completed: false,
    },
    { id: 's3', taskId: 't1', title: 'Water if dry', completed: false },
  ],
})

for (const [width, height, touch] of VIEWPORTS)
  test.describe(`${width}px screens`, () => {
    test.skip(!dir, 'Set SCREENS_DIR to capture screenshots')
    test.use({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    })

    test('capture', async ({ page }) => {
      const errors = captureErrors(page)
      await mockApi(page, gardenSeed())
      await page.goto('./')
      await page.evaluate(() => document.fonts.ready)
      const shot = async (name: string, keepMouse = false) => {
        if (!keepMouse && !touch) await page.mouse.move(width - 1, height - 1)
        await page.screenshot({ path: join(dir ?? '', `${width}-${name}.png`) })
      }
      const press = (target: Locator) => (touch ? target.tap() : target.click())
      const dismiss = () => (touch ? page.touchscreen.tap(width / 2, 4) : page.mouse.click(width / 2, 4))
      const menuOn = (target: Locator) => (touch ? longPress(page, target) : target.click({ button: 'right' }))
      const main = page.locator('main')
      const rows = main.locator('[data-kind="task"]')
      const compost = rows.filter({ hasText: 'Turn the compost heap' })
      const narrow = width < 1024

      await expect(compost).toBeVisible()
      await shot('list')

      await press(page.getByRole('button', { name: 'Sort' }))
      await shot('sort-menu')
      await press(page.getByRole('menuitemradio', { name: 'Priority' }))
      await shot('list-sorted')
      await press(page.getByRole('button', { name: 'Clear sort: Priority' }))

      await press(page.getByLabel('List actions'))
      await expect(page.getByRole('menuitem', { name: 'Rename list' })).toBeVisible()
      await shot('list-menu')
      await dismiss()

      if (!touch) {
        const mend = rows.filter({ hasText: 'Mend the gap' })
        await mend.hover()
        await shot('row-hover', true)
        await mend.getByLabel('Task actions').click()
        await expect(page.getByRole('menu')).toBeVisible()
        await shot('row-hover-menu', true)
        await dismiss()
      }

      await menuOn(rows.filter({ hasText: 'Mend the gap' }))
      await expect(page.getByRole('menu')).toBeVisible()
      await shot('context-menu')
      const dueItem = page.getByRole('menuitem', { name: /^Set due date/ })
      await (touch ? dueItem.tap() : dueItem.hover())
      await expect(page.getByRole('menuitem', { name: 'Pick a date…' })).toBeVisible()
      await shot('context-submenu', true)
      await dismiss()

      if (narrow) await press(page.getByLabel('Open lists'))
      await expect(page.locator('nav')).toBeInViewport({ ratio: 1 })
      await shot('sidebar')
      await press(page.locator('nav').getByText('Today'))
      await expect(main.getByRole('heading', { name: 'Today' })).toBeVisible()
      await shot('today-list')
      if (narrow) await press(page.getByLabel('Open lists'))
      await press(page.locator('nav').getByText('All', { exact: true }))
      await expect(main.getByRole('heading', { name: 'All' })).toBeVisible()
      await shot('all-list')
      if (narrow) await press(page.getByLabel('Open lists'))
      await press(page.locator('nav').getByText('Someday'))
      await expect(main.getByRole('heading', { name: 'Someday' })).toBeVisible()
      await shot('empty-list')

      if (narrow) await press(page.getByLabel('Open lists'))
      await press(page.locator('nav').getByText('Garden'))
      await press(compost.getByText('Turn the compost heap'))
      const aside = page.locator('aside')
      await expect(aside.getByText('Water if dry')).toBeVisible()
      await shot('detail')
      await press(aside.getByRole('button', { name: /^Priority: / }))
      await shot('detail-picker')
      await dismiss()
      await press(aside.getByRole('button', { name: /^Stage: / }))
      await shot('stage-picker')
      await dismiss()
      await press(aside.getByRole('button', { name: /^List: / }))
      await expect(page.getByRole('menuitemradio', { name: /Errands/ })).toBeVisible()
      await shot('move-to-list')
      await dismiss()
      expect(errors).toEqual([])
    })
  })
