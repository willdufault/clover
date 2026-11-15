import { expect, test } from '@playwright/test'

test('dragging a step keeps the panel open and reorders', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
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

  const from = (await steps.last().boundingBox())!
  const to = (await steps.first().boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(from.x + from.width / 2, from.y + (to.y - from.y) * (i / 10) + from.height / 2)
  await page.mouse.up()

  await expect(page.locator('aside')).toBeVisible()
  await expect.poll(order).not.toEqual(before)
  expect(errors).toEqual([])
})
