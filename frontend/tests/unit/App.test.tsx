import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'
import { STAGE_LABELS } from '../../src/labels'
import { SELECTED_ROW_CLASS } from '../../src/styles'
import limits from '../../../backend/limits.json'
import { createFakeBackend, seed, task } from '../fakeBackend'

let backend: ReturnType<typeof createFakeBackend>
beforeEach(() => {
  backend = createFakeBackend()
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const { status, body } = backend.handle(
      init.method ?? 'GET',
      url,
      init.body ? JSON.parse(init.body as string) : undefined,
    )
    return { status, ok: status < 400, json: async () => body }
  })
})

const setup = async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('navigation')
  return { user }
}
const nav = () => screen.getByRole('navigation')
const main = () => screen.getByRole('main')
const aside = () => screen.getByRole('complementary')
const STAGE_EMOJIS = Object.values(STAGE_LABELS)
  .map((s) => s.emoji)
  .join('')
const rowName = (rowElement: HTMLElement) =>
  (rowElement.textContent ?? '')
    .replace(STAGE_EMOJIS, '')
    .replace(/✕$/, '')
    .replace(/(\d+\/\d+|📅 |🔴|🟢|☀️ Added|☀️ Today).*$/, '')
const rowsIn = (root: HTMLElement) =>
  within(root)
    .queryAllByRole('button')
    .filter((button) => !/^([✕×›]|⇅ Sort|☀️ Add to Today|Delete task)$/.test(button.textContent ?? ''))
const namesIn = (root: HTMLElement) => rowsIn(root).map(rowName)
const tasks = () => namesIn(main())
const steps = () => namesIn(aside()).filter((name) => name !== '+ New step')
const lists = () =>
  within(nav())
    .getAllByRole('button')
    .map((button) => (button.textContent ?? '').replace(/\d+$/, '').replace(/^\S+ /, ''))
    .filter((text) => !text.startsWith('+'))
const row = (name: string, root: HTMLElement = main()) => {
  const match = rowsIn(root).find((rowElement) => rowName(rowElement) === name)
  if (!match) throw new Error(`No row named ${name}`)
  return match
}
const stageSelect = (name: string) => within(row(name)).getByRole('combobox')
const last = (elements: HTMLElement[]) => {
  const element = elements.at(-1)
  if (!element) throw new Error('No elements')
  return element
}
const dueInput = () => last(within(aside()).getAllByDisplayValue(/^(\d{4}-\d{2}-\d{2})?$/))

type User = ReturnType<typeof userEvent.setup>
const submenuClick = async (user: User, parent: string, leaf: string) => {
  await user.hover(screen.getByText(parent))
  fireEvent.click(screen.getByText(leaf, { selector: 'button' }))
  await flush()
}
const rightClick = (user: User, element: HTMLElement) => user.pointer({ keys: '[MouseRight]', target: element })
const deleteViaMenu = async (user: User, element: HTMLElement) => {
  await rightClick(user, element)
  await user.click(screen.getByText('Delete'))
}
const newList = async (user: User, name: string) => {
  await user.type(screen.getByPlaceholderText('+ New list'), `${name}{Enter}`)
}
const newStep = async (user: User, name: string) => {
  await user.type(within(aside()).getByPlaceholderText('+ New step'), `${name}{Enter}`)
}
const toggle = (user: User, name: string, root: HTMLElement) =>
  user.click(within(row(name, root)).getByRole('checkbox'))
// Lets pending API calls settle after a synchronous fireEvent.
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const setDue = async (value: string) => {
  fireEvent.change(dueInput(), { target: { value } })
  fireEvent.blur(dueInput())
  await flush()
}

test('opening the context menu cancels an in-progress rename', async () => {
  const { user } = await setup()
  await user.click(within(main()).getByText('Milk'))
  for (const target of [() => within(aside()).getByText('2% lactose free'), () => within(main()).getByText('Milk')]) {
    await user.click(within(aside()).getByText('2% lactose free'))
    expect(within(aside()).getByDisplayValue('2% lactose free')).toBeInTheDocument()
    await rightClick(user, target())
    expect(within(aside()).queryByDisplayValue('2% lactose free')).not.toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  }
  expect(within(aside()).getByText('2% lactose free')).toBeInTheDocument()
})

test('deleting every list falls back to the All view with no tasks', async () => {
  const { user } = await setup()
  for (const name of ['Groceries', 'Work', 'Home']) {
    await deleteViaMenu(user, within(nav()).getByText(name))
  }
  expect(screen.getByRole('heading', { name: '📋 All' })).toBeInTheDocument()
  expect(tasks()).toHaveLength(0)
})

// Regression (04ff05c): deleting another list used to change the selected list.
test('deleting a list that is not selected keeps the current list and the open panel', async () => {
  const { user } = await setup()
  await user.click(within(main()).getByText('Milk'))
  // Home's neighbour is Work, so a wrong fallback would switch away from Groceries.
  await deleteViaMenu(user, within(nav()).getByText('Home'))
  expect(within(nav()).queryByText('Home')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
  expect(within(aside()).getByRole('heading', { name: 'Milk' })).toBeInTheDocument()
})

test('a list created while a delete is in flight survives and stays selected', async () => {
  const { user } = await setup()
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  const realFetch = fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    if (init.method === 'DELETE') await gate
    return realFetch(url, init)
  })
  await user.click(within(nav()).getByText('Work'))
  await deleteViaMenu(user, within(nav()).getByText('Work'))
  await newList(user, 'Fun')
  expect(screen.getByRole('heading', { name: 'Fun' })).toBeInTheDocument()
  release()
  await flush()
  expect(lists()).toEqual(expect.arrayContaining(['Groceries', 'Home', 'Fun']))
  expect(within(nav()).queryByText('Work')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Fun' })).toBeInTheDocument()
})

test('whitespace-only names are ignored', async () => {
  const { user } = await setup()
  await user.type(screen.getByPlaceholderText(/new task/i), '   {Enter}')
  expect(tasks()).toEqual(['Milk', 'Eggs'])

  await user.click(within(main()).getByText('Milk'))
  await newStep(user, '   ')
  expect(steps()).toEqual(['2% lactose free'])

  await newList(user, '   ')
  expect(lists()).toEqual(['Groceries', 'Work', 'Home'])
})

it('saves the due date only when the edit ends', async () => {
  const { user } = await setup()
  await user.click(within(main()).getByText('Milk'))
  const id = backend.data.tasks.find((t) => t.title === 'Milk')?.id
  act(() => dueInput().focus())
  fireEvent.change(dueInput(), { target: { value: '2030-01-02' } })
  await flush()
  expect(backend.data.tasks.find((t) => t.id === id)?.due).toBeNull()
  fireEvent.keyDown(dueInput(), { key: 'Enter' })
  await flush()
  expect(backend.data.tasks.find((t) => t.id === id)?.due).toBe('2030-01-02')
})

test('closing and reopening a task keeps position', async () => {
  const { user } = await setup()
  await user.click(within(nav()).getByText('Work'))
  await user.selectOptions(stageSelect('Reply to emails'), 'done')
  expect(tasks()).toEqual(['Reply to emails', 'Update docs', 'Review PR'])
  await user.selectOptions(stageSelect('Reply to emails'), 'inProgress')
  expect(tasks()).toEqual(['Reply to emails', 'Update docs', 'Review PR'])
})

test("detail pane shows the selected task's own values", async () => {
  const { user } = await setup()
  await user.click(within(main()).getByText('Milk'))
  await setDue('2000-01-01')
  await user.selectOptions(stageSelect('Milk'), 'inProgress')
  await user.selectOptions(within(aside()).getByDisplayValue('🟡 Medium'), '🔴 High')
  await user.click(within(main()).getByText('Eggs'))
  expect(dueInput()).toHaveValue('')
  expect(within(aside()).getByDisplayValue('🟡 Medium')).toBeInTheDocument()
})

test('step menu shows Mark as done unless every selected step is done', async () => {
  const { user } = await setup()
  await user.click(within(main()).getByText('Milk'))
  await newStep(user, 'Oat')
  await toggle(user, 'Oat', aside())
  await user.click(row('2% lactose free', aside()))
  await user.keyboard('{Control>}')
  await user.click(row('Oat', aside()))
  await user.keyboard('{/Control}')
  await rightClick(user, row('Oat', aside()))
  await user.click(screen.getByText('Mark as done'))
  expect(within(row('2% lactose free', aside())).getByRole('checkbox')).toBeChecked()
  await rightClick(user, row('Oat', aside()))
  await user.click(screen.getByText('Mark as open'))
  for (const name of ['2% lactose free', 'Oat'])
    expect(within(row(name, aside())).getByRole('checkbox')).not.toBeChecked()
  await rightClick(user, row('Oat', aside()))
  await user.click(screen.getByText('Delete', { exact: true }))
  expect(backend.data.steps).toEqual([])
})

test('mixed selection offers Add, all-in-Today offers Remove', async () => {
  const { user } = await setup()
  await rightClick(user, row('Milk'))
  await user.click(last(screen.getAllByText('☀️ Add to Today')))
  await user.click(row('Milk'))
  await user.keyboard('{Control>}')
  await user.click(row('Eggs'))
  await user.keyboard('{/Control}')
  await rightClick(user, row('Eggs'))
  expect(screen.queryByText('☀️ Remove from Today')).toBeNull()
  await user.click(last(screen.getAllByText('☀️ Add to Today')))
  await rightClick(user, row('Eggs'))
  expect(screen.getByText('☀️ Remove from Today')).toBeInTheDocument()
  await user.click(screen.getByText('☀️ Remove from Today'))
  await user.click(within(nav()).getByText('☀️ Today'))
  expect(tasks()).toEqual([])
})

const selectTwo = async (user: User) => {
  await user.click(row('Milk'))
  await user.keyboard('{Control>}')
  await user.click(row('Eggs'))
  await user.keyboard('{/Control}')
}

describe('multi-select', () => {
  test('a failing bulk patch leaves every item unchanged and shows the banner', async () => {
    const { user } = await setup()
    await selectTwo(user)
    backend.data.tasks = backend.data.tasks.filter((t) => t.id !== 'g2')
    await rightClick(user, row('Milk'))
    await submenuClick(user, 'Set priority', '🔴 High')
    expect(screen.getByRole('alert')).toHaveTextContent('Not found')
    expect(within(main()).queryByText('🔴 High')).toBeNull()
    expect(backend.data.tasks.find((t) => t.id === 'g1')).toMatchObject({ priority: 'medium' })
  })

  test('deleting a step with its x button does not select the row behind it', async () => {
    const { user } = await setup()
    await user.click(row('Milk'))
    await newStep(user, 'Skim')
    await newStep(user, 'Oat')
    await user.click(row('Skim', aside()))
    await user.keyboard('{Control>}')
    await user.click(within(row('Oat', aside())).getByRole('button', { name: 'Delete step' }))
    await user.keyboard('{/Control}')
    expect(steps()).toEqual(['2% lactose free', 'Skim'])
    expect(rowsIn(aside()).some((r) => r.className.includes(SELECTED_ROW_CLASS))).toBe(false)
  })

  test('modifier-click on step text selects without renaming', async () => {
    const { user } = await setup()
    await user.click(row('Milk'))
    await newStep(user, 'Skim')
    await user.click(row('Skim', aside()))
    const boxes = within(aside()).queryAllByRole('textbox').length
    for (const key of ['Control', 'Shift']) {
      await user.keyboard(`{${key}>}`)
      await user.click(within(aside()).getByText('2% lactose free'))
      await user.keyboard(`{/${key}}`)
      expect(within(aside()).queryAllByRole('textbox')).toHaveLength(boxes)
      expect(row('Skim', aside())).toHaveClass(SELECTED_ROW_CLASS)
      expect(row('2% lactose free', aside())).toHaveClass(SELECTED_ROW_CLASS)
      await user.click(row('Skim', aside()))
    }
  })
})

test('Escape in the add-step input or with the context menu open keeps the panel', async () => {
  const { user } = await setup()
  await user.click(within(main()).getByText('Milk'))
  await user.type(within(aside()).getByPlaceholderText('+ New step'), 'x{Escape}')
  expect(aside()).toBeInTheDocument()

  await rightClick(user, within(main()).getByText('Milk'))
  expect(screen.getByText('Delete')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByText('Delete')).toBeNull()
  expect(aside()).toBeInTheDocument()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('complementary')).toBeNull()
})

test('a task that left the view is not deleted with the selection', async () => {
  const { user } = await setup()
  await user.click(screen.getByText('Milk'))
  await user.click(within(aside()).getByText('☀️ Add to Today'))
  await user.click(within(nav()).getByText('Work'))
  await user.click(screen.getByText('Review PR'))
  await user.click(within(aside()).getByText('☀️ Add to Today'))
  await user.click(within(nav()).getByText('☀️ Today'))
  await user.click(within(main()).getByText('Milk'))
  await user.click(within(aside()).getByLabelText('Remove from Today'))
  expect(tasks()).toEqual(['Review PR'])
  await user.keyboard('{Control>}')
  await user.click(within(main()).getByText('Review PR'))
  await user.keyboard('{/Control}')
  await deleteViaMenu(user, within(main()).getByText('Review PR'))
  await user.click(within(nav()).getByText('📋 All'))
  expect(tasks()).toContain('Milk')
  expect(tasks()).not.toContain('Review PR')
})

test('leading and trailing spaces are not stored', async () => {
  const { user } = await setup()
  await user.type(screen.getByPlaceholderText(/new task/i), '  Bread  {Enter}')
  expect(tasks()[0]).toBe('Bread')
  await user.click(within(main()).getByText('Bread'))
  await newStep(user, '  Toast  ')
  expect(steps()).toEqual(['Toast'])
})

const many = <T,>(n: number, make: (i: number) => T) => Array.from({ length: n }, (_, i) => make(i))

describe('limits', () => {
  test('tasks-per-list limit blocks creating a task in a full list', async () => {
    const data = seed()
    data.tasks.push(...many(limits.tasksPerList - 2, (i) => task(`t${i}`, `T${i}`, 'groceries')))
    const count = data.tasks.length
    backend = createFakeBackend(data)
    const { user } = await setup()
    await user.type(screen.getByPlaceholderText('+ New task'), 'One more{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(`List task limit reached (${limits.tasksPerList})`)
    expect(backend.data.tasks).toHaveLength(count)
  })

  test('step limit counts steps across all tasks', async () => {
    const data = seed()
    data.steps.push(
      ...many(limits.stepsPerUser - 1, (i) => ({
        id: `s${i}`,
        taskId: `w${(i % 3) + 1}`,
        title: `S${i}`,
        completed: false,
      })),
    )
    backend = createFakeBackend(data)
    const { user } = await setup()
    await user.click(within(main()).getByText('Milk'))
    await newStep(user, 'One more')
    expect(await screen.findByRole('alert')).toHaveTextContent(`Step limit reached (${limits.stepsPerUser})`)
    expect(backend.data.steps).toHaveLength(limits.stepsPerUser)
  })

  test('steps-per-task limit blocks adding a step to a full task', async () => {
    const data = seed()
    data.steps.push(
      ...many(limits.stepsPerTask - 1, (i) => ({ id: `s${i}`, taskId: 'g1', title: `S${i}`, completed: false })),
    )
    backend = createFakeBackend(data)
    const { user } = await setup()
    await user.click(within(main()).getByText('Milk'))
    await newStep(user, 'One more')
    expect(await screen.findByRole('alert')).toHaveTextContent(`Task step limit reached (${limits.stepsPerTask})`)
    expect(backend.data.steps).toHaveLength(limits.stepsPerTask)
  })
})
