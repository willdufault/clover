import { expect, test } from '@playwright/test'
import { mockApi } from './mockApi'

test('create, edit, set stage/due/Today and delete against the API', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
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
