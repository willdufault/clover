import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'
import { createFakeBackend } from '../fakeBackend'
import { stubViewport } from './viewport'

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

type User = ReturnType<typeof userEvent.setup>
const setup = async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('navigation')
  return user
}
const nav = () => screen.getByRole('navigation')
const main = () => screen.getByRole('main')
const aside = () => screen.getByRole('complementary')
const rowName = (rowElement: HTMLElement) => {
  const clone = rowElement.cloneNode(true) as HTMLElement
  clone.querySelectorAll('button, p').forEach((node) => node.remove())
  return clone.textContent ?? ''
}
const rowsIn = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-kind]')]
const namesIn = (root: HTMLElement) => rowsIn(root).map(rowName)
const tasks = () => namesIn(main())
const steps = () => namesIn(aside())
const lists = () =>
  within(nav())
    .getAllByRole('button')
    .map((button) => (button.textContent ?? '').replace(/\d+$/, ''))
const row = (name: string, root: HTMLElement = main()) => {
  const match = rowsIn(root).find((rowElement) => rowName(rowElement) === name)
  if (!match) throw new Error(`No row named ${name}`)
  return match
}
const pick = async (user: User, trigger: HTMLElement, option: string) => {
  await user.click(trigger)
  await user.click(screen.getByRole('menuitemradio', { name: option }))
  await flush()
}
const toggleButton = (name: string) => within(row(name)).getByRole('button', { name: /^Mark / })
const toggleDone = async (user: User, name: string) => {
  await user.click(toggleButton(name))
  await flush()
}
const last = (elements: HTMLElement[]) => {
  const element = elements.at(-1)
  if (!element) throw new Error('No elements')
  return element
}
const dueInput = () => within(aside()).getByLabelText('Due date')

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
  await user.type(screen.getByPlaceholderText('Add a list'), `${name}{Enter}`)
}
const newStep = async (user: User, name: string) => {
  await user.type(within(aside()).getByPlaceholderText('Add a step'), `${name}{Enter}`)
}
const sortButton = () => screen.getByRole('button', { name: /^Sort/ })
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

test('opening the context menu cancels an in-progress rename', async () => {
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  await user.click(within(aside()).getByText('2% lactose free'))
  expect(within(aside()).getByDisplayValue('2% lactose free')).toBeInTheDocument()
  await rightClick(user, within(main()).getByText('Milk'))
  expect(within(aside()).queryByDisplayValue('2% lactose free')).not.toBeInTheDocument()
  expect(screen.getByText('Delete')).toBeInTheDocument()
  expect(within(aside()).getByText('2% lactose free')).toBeInTheDocument()
})

test('deleting every list falls back to the All view with no tasks', async () => {
  const user = await setup()
  for (const name of ['Groceries', 'Work', 'Home']) {
    await deleteViaMenu(user, within(nav()).getByText(name))
  }
  expect(screen.getByRole('heading', { name: 'All' })).toBeInTheDocument()
  expect(tasks()).toHaveLength(0)
})

test('deleting a list that is not selected keeps the current list and the open panel', async () => {
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  await deleteViaMenu(user, within(nav()).getByText('Home'))
  expect(within(nav()).queryByText('Home')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
  expect(within(aside()).getByRole('heading', { name: 'Milk' })).toBeInTheDocument()
})

test('a list created while a delete is in flight survives and stays selected', async () => {
  const user = await setup()
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
  const user = await setup()
  await user.type(screen.getByPlaceholderText('Add a task'), '   {Enter}')
  expect(tasks()).toEqual(['Eggs', 'Milk'])

  await user.click(within(main()).getByText('Milk'))
  await newStep(user, '   ')
  expect(steps()).toEqual(['2% lactose free'])

  await newList(user, '   ')
  expect(lists()).toEqual(['Groceries', 'Work', 'Home'])
})

test('saves the due date only when the edit ends', async () => {
  const user = await setup()
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

test('clicking the due date opens the picker', async () => {
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  const showPicker = vi.fn()
  ;(dueInput() as HTMLInputElement).showPicker = showPicker
  fireEvent.click(dueInput())
  expect(showPicker).toHaveBeenCalled()
})

test('closing and reopening a task keeps position', async () => {
  const user = await setup()
  await user.click(within(nav()).getByText('Work'))
  await toggleDone(user, 'Reply to emails')
  expect(tasks()).toEqual(['Review PR', 'Update docs', 'Reply to emails'])
  await toggleDone(user, 'Reply to emails')
  expect(tasks()).toEqual(['Review PR', 'Update docs', 'Reply to emails'])
})

test("detail pane shows the selected task's own values", async () => {
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  fireEvent.change(dueInput(), { target: { value: '2000-01-01' } })
  fireEvent.blur(dueInput())
  await flush()
  await pick(user, within(aside()).getByRole('button', { name: 'Stage: Open' }), 'In progress')
  await pick(user, within(aside()).getByRole('button', { name: 'Priority: Medium' }), 'High')
  expect(within(aside()).getByRole('button', { name: 'Stage: In progress' })).toBeInTheDocument()
  await user.click(within(main()).getByText('Eggs'))
  expect(dueInput()).toHaveValue('')
  expect(within(aside()).getByRole('button', { name: 'Priority: Medium' })).toBeInTheDocument()
  expect(within(aside()).getByRole('button', { name: 'Stage: Open' })).toBeInTheDocument()
})

test('mixed selection offers Add, all-in-Today offers Remove', async () => {
  const user = await setup()
  await rightClick(user, row('Milk'))
  await user.click(last(screen.getAllByText('Add to Today')))
  await user.click(row('Milk'))
  await user.keyboard('{Control>}')
  await user.click(row('Eggs'))
  await user.keyboard('{/Control}')
  await rightClick(user, row('Eggs'))
  expect(screen.queryByText('Remove from Today')).toBeNull()
  await user.click(last(screen.getAllByText('Add to Today')))
  await rightClick(user, row('Eggs'))
  expect(screen.getByText('Remove from Today')).toBeInTheDocument()
  await user.click(screen.getByText('Remove from Today'))
  await user.click(within(nav()).getByText('Today'))
  expect(tasks()).toEqual([])
})

const selectTwo = async (user: User) => {
  await user.click(row('Milk'))
  await user.keyboard('{Control>}')
  await user.click(row('Eggs'))
  await user.keyboard('{/Control}')
}

test('a failing bulk patch leaves every item unchanged and shows the banner', async () => {
  const user = await setup()
  await selectTwo(user)
  backend.data.tasks = backend.data.tasks.filter((t) => t.id !== 'g2')
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set priority', 'High')
  expect(screen.getByRole('alert')).toHaveTextContent('Not found')
  expect(within(main()).queryByTitle('High priority')).toBeNull()
  expect(backend.data.tasks.find((t) => t.id === 'g1')).toMatchObject({ priority: 'medium' })
})

describe('multi-select', () => {
  test('deleting a step with its x button does not select the row behind it', async () => {
    const user = await setup()
    await user.click(row('Milk'))
    await newStep(user, 'Skim')
    await newStep(user, 'Oat')
    await user.click(within(row('Oat', aside())).getByRole('button', { name: 'Delete step: Oat' }))
    expect(steps()).toEqual(['2% lactose free', 'Skim'])
  })
})

test('Escape in the add-step input or with the context menu open keeps the panel', async () => {
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  await user.type(within(aside()).getByPlaceholderText('Add a step'), 'x{Escape}')
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
  const user = await setup()
  await user.click(screen.getByText('Milk'))
  await user.click(within(aside()).getByRole('button', { name: 'Add to Today' }))
  await user.click(within(nav()).getByText('Work'))
  await user.click(screen.getByText('Review PR'))
  await user.click(within(aside()).getByRole('button', { name: 'Add to Today' }))
  await user.click(within(nav()).getByText('Today'))
  await user.click(within(main()).getByText('Milk'))
  await user.click(within(aside()).getByRole('button', { name: 'Remove from Today' }))
  expect(tasks()).toEqual(['Review PR'])
  await user.keyboard('{Control>}')
  await user.click(within(main()).getByText('Review PR'))
  await user.keyboard('{/Control}')
  await deleteViaMenu(user, within(main()).getByText('Review PR'))
  await user.click(within(nav()).getByText('All'))
  expect(tasks()).toContain('Milk')
  expect(tasks()).not.toContain('Review PR')
})

test('a new task shows first while storage appends it', async () => {
  const user = await setup()
  await user.type(screen.getByPlaceholderText('Add a task'), 'Bread{Enter}')
  expect(tasks()).toEqual(['Bread', 'Eggs', 'Milk'])
  expect(backend.data.tasks.map((t) => t.title).at(-1)).toBe('Bread')
})

test('leading and trailing spaces are not stored', async () => {
  const user = await setup()
  await user.type(screen.getByPlaceholderText('Add a task'), '  Bread  {Enter}')
  expect(tasks()[0]).toBe('Bread')
  await user.click(within(main()).getByText('Bread'))
  await newStep(user, '  Toast  ')
  expect(steps()).toEqual(['Toast'])
})

test('the lists drawer opens from the menu button and closes on X or picking a list', async () => {
  stubViewport(375)
  const user = await setup()
  const drawer = () => nav().parentElement
  expect(drawer()).toHaveClass('invisible')
  await user.click(screen.getByLabelText('Open lists'))
  expect(drawer()).not.toHaveClass('invisible')
  await user.click(screen.getByLabelText('Close lists'))
  expect(drawer()).toHaveClass('invisible')
  await user.click(screen.getByLabelText('Open lists'))
  await user.click(within(nav()).getByText('Work'))
  expect(drawer()).toHaveClass('invisible')
  expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
  await user.click(screen.getByLabelText('Open lists'))
  expect(screen.getByRole('dialog', { name: 'Lists' })).toBeInTheDocument()
  expect(screen.getByLabelText('Close lists')).toHaveFocus()
  expect(main()).toHaveAttribute('inert')
  await user.keyboard('{Escape}')
  expect(drawer()).toHaveClass('invisible')
  expect(screen.getByLabelText('Open lists')).toHaveFocus()
  expect(main()).not.toHaveAttribute('inert')
})

test('on phones task detail is a modal dialog that returns focus when closed', async () => {
  stubViewport(375)
  const user = await setup()
  const milk = row('Milk')
  await user.click(milk)
  const dialog = screen.getByRole('dialog', { name: 'Milk' })
  expect(within(dialog).getByLabelText('Close panel')).toHaveFocus()
  expect(main()).toHaveAttribute('inert')
  expect(nav().parentElement).toHaveAttribute('inert')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(milk).toHaveFocus()
})

test('Escape with the drawer open closes only the drawer', async () => {
  stubViewport(375)
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  await user.click(screen.getByLabelText('Close panel'))
  await user.click(screen.getByLabelText('Open lists'))
  await user.keyboard('{Escape}')
  expect(nav().parentElement).toHaveClass('invisible')
})

test('right-click opens the menu without selecting or opening the task and returns focus on close', async () => {
  const user = await setup()
  const milk = row('Milk')
  milk.focus()
  await rightClick(user, milk)
  expect(screen.getByRole('menu')).toHaveFocus()
  expect(screen.queryByRole('complementary')).toBeNull()
  await user.keyboard('{Escape}')
  expect(milk).toHaveFocus()
})

test('Move to list offers the other lists and moves every selected task', async () => {
  const user = await setup()
  await rightClick(user, row('Milk'))
  await user.hover(screen.getByText('Move to list'))
  const submenu = screen.getAllByRole('menu')[1]
  if (!submenu) throw new Error('No submenu')
  expect(
    within(submenu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent),
  ).toEqual(['Work', 'Home'])
  await user.keyboard('{Escape}')

  await user.click(row('Milk'))
  await user.keyboard('{Control>}')
  await user.click(row('Eggs'))
  await user.keyboard('{/Control}')
  await rightClick(user, row('Eggs'))
  await submenuClick(user, 'Move to list', 'Home')
  expect(tasks()).toEqual([])
  expect(backend.data.tasks.filter((task) => task.listId === 'home').map((task) => task.id)).toEqual(['g1', 'g2'])
})

test('on phones a submenu replaces the sheet and Back returns to the main list', async () => {
  stubViewport(375, true)
  const user = await setup()
  await rightClick(user, row('Milk'))
  await user.click(screen.getByText('Set due date'))
  const menu = screen.getByRole('menu')
  expect(within(menu).getByText('Set due date', { selector: 'p' })).toBeInTheDocument()
  expect(within(menu).queryByText('Delete')).toBeNull()
  expect(within(menu).getAllByRole('menuitemradio')[0]).toHaveTextContent('Today')
  await user.click(within(menu).getByLabelText('Back'))
  expect(within(menu).getByText('Delete')).toBeInTheDocument()
  expect(within(menu).queryByLabelText('Back')).toBeNull()
  expect(within(menu).getByRole('menuitem', { name: 'Set due date' })).toHaveFocus()
})

test('on phones Escape in a submenu goes back to the main list', async () => {
  stubViewport(375, true)
  const user = await setup()
  await rightClick(user, row('Milk'))
  await user.click(screen.getByText('Set priority'))
  await user.keyboard('{Escape}')
  expect(screen.getByRole('menu')).toHaveTextContent('Delete')
  expect(screen.getByRole('menuitem', { name: 'Set priority' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).toBeNull()
})

test('on phones choosing a submenu item runs it and closes the menu', async () => {
  stubViewport(375, true)
  const user = await setup()
  await rightClick(user, row('Milk'))
  await user.click(screen.getByText('Move to list'))
  await user.click(screen.getByRole('menuitem', { name: 'Home' }))
  await flush()
  expect(screen.queryByRole('menu')).toBeNull()
  expect(backend.data.tasks.find((task) => task.id === 'g1')?.listId).toBe('home')
})

test('the stage picker marks the current stage and Escape closes it without closing the panel', async () => {
  const user = await setup()
  await user.click(row('Milk'))
  const stage = () => within(aside()).getByRole('button', { name: /^Stage: / })
  stage().focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('menuitemradio', { name: 'Open' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('menuitemradio', { name: 'Open' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).toBeNull()
  expect(aside()).toBeInTheDocument()
  expect(stage()).toHaveFocus()
  await pick(user, stage(), 'Waiting')
  expect(backend.data.tasks.find((task) => task.id === 'g1')?.stage).toBe('waiting')
  expect(toggleButton('Milk')).toHaveAttribute('title', 'Waiting')
})

const eggsStage = () => backend.data.tasks.find((task) => task.id === 'g2')?.stage

test('the row stage icon toggles done and open without selecting the row', async () => {
  const user = await setup()
  await toggleDone(user, 'Eggs')
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(eggsStage()).toBe('done')
  await toggleDone(user, 'Eggs')
  expect(eggsStage()).toBe('open')
  await rightClick(user, row('Eggs'))
  await submenuClick(user, 'Set stage', 'Waiting')
  await toggleDone(user, 'Eggs')
  expect(eggsStage()).toBe('done')
  await toggleDone(user, 'Eggs')
  expect(eggsStage()).toBe('open')
})

test('progress ignores cancelled tasks', async () => {
  const user = await setup()
  await toggleDone(user, 'Milk')
  await rightClick(user, row('Eggs'))
  await submenuClick(user, 'Set stage', 'Cancelled')
  expect(within(main()).getByText(/of \d+ done/)).toHaveTextContent(`1 of ${tasks().length - 1} done`)
})

test('sorting marks the active option and clearing restores the order', async () => {
  const user = await setup()
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set priority', 'Low')
  const before = tasks()
  await user.click(sortButton())
  expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
    'Stage',
    'Due date',
    'Priority',
  ])
  expect(screen.queryByRole('menuitemradio', { checked: true })).toBeNull()
  await user.click(screen.getByRole('menuitemradio', { name: 'Priority' }))
  expect(tasks().at(-1)).toBe('Milk')
  expect(screen.getByRole('button', { name: 'Clear sort: Priority' })).toHaveTextContent('Priority')
  await user.click(screen.getByRole('button', { name: 'Clear sort: Priority' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(tasks()).toEqual(before)
  expect(screen.getByRole('button', { name: 'Sort' })).toBeInTheDocument()
})

test('sorting by stage sinks done tasks', async () => {
  const user = await setup()
  await toggleDone(user, 'Milk')
  const before = tasks()
  await user.click(sortButton())
  await user.click(screen.getByRole('menuitemradio', { name: 'Stage' }))
  expect(tasks().at(-1)).toBe('Milk')
  await user.click(screen.getByRole('button', { name: 'Clear sort: Stage' }))
  expect(tasks()).toEqual(before)
})

test('the due submenu picks a date and removes it', async () => {
  const user = await setup()
  await rightClick(user, row('Milk'))
  await user.hover(screen.getByText('Set due date'))
  fireEvent.change(screen.getByLabelText('Pick a date'), { target: { value: '2026-12-01' } })
  await flush()
  expect(backend.data.tasks.find((task) => task.id === 'g1')?.due).toBe('2026-12-01')
  expect(screen.queryByRole('menu')).toBeNull()
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set due date', 'Remove due date')
  expect(backend.data.tasks.find((task) => task.id === 'g1')?.due).toBeNull()
})

test('the context menu shows the current due date next to Set due date', async () => {
  const user = await setup()
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set due date', 'Tomorrow')
  await rightClick(user, row('Milk'))
  const item = screen.getByRole('menuitem', { name: 'Set due date' })
  expect(item).toHaveTextContent('Tomorrow')
})

test('the row actions button opens the task menu', async () => {
  const user = await setup()
  await user.click(within(row('Milk')).getByLabelText('Task actions'))
  expect(screen.getByRole('menuitem', { name: 'Set stage' })).toBeInTheDocument()
  expect(screen.queryByRole('complementary')).toBeNull()
})

test('the due submenu checks the current preset or custom date', async () => {
  const user = await setup()
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set due date', 'Tomorrow')
  await rightClick(user, row('Milk'))
  await user.hover(screen.getByText('Set due date'))
  expect(screen.getByRole('menuitemradio', { name: 'Tomorrow' })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('menuitemradio', { name: 'Today' })).toHaveAttribute('aria-checked', 'false')
  fireEvent.change(screen.getByLabelText('Pick a date'), { target: { value: '2030-01-15' } })
  await flush()
  await rightClick(user, row('Milk'))
  await user.hover(screen.getByText('Set due date'))
  expect(screen.getByRole('menuitemradio', { name: 'Tue Jan 15' })).toHaveAttribute('aria-checked', 'true')
})

test('the detail pane moves the task to another list', async () => {
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  await user.click(within(aside()).getByRole('button', { name: /^List: / }))
  expect(screen.getByText('Move to list')).toBeInTheDocument()
  await user.click(screen.getByRole('menuitemradio', { name: /Work/ }))
  await flush()
  expect(backend.data.tasks.find((task) => task.title === 'Milk')?.listId).toBe(
    backend.data.lists.find((list) => list.name === 'Work')?.id,
  )
})

test('the list menu renames and deletes the list', async () => {
  const user = await setup()
  await user.click(within(nav()).getByText('Work'))
  await user.click(screen.getByLabelText('List actions'))
  await user.click(screen.getByRole('menuitem', { name: 'Rename list' }))
  await act(() => new Promise((resolve) => setTimeout(resolve)))
  await user.keyboard('{Control>}a{/Control}Office{Enter}')
  await flush()
  expect(within(main()).getByRole('heading', { name: 'Office' })).toBeInTheDocument()
  await user.click(screen.getByLabelText('List actions'))
  await user.click(screen.getByRole('menuitem', { name: 'Delete list' }))
  await flush()
  expect(lists()).not.toContain('Office')
})

test('smart lists have no list menu', async () => {
  const user = await setup()
  await user.click(within(nav()).getByText('All'))
  expect(screen.queryByLabelText('List actions')).toBeNull()
})

const allCount = () => Number(within(nav()).getByText('All').nextElementSibling?.textContent ?? 0)

test('sidebar counts only open tasks', async () => {
  const user = await setup()
  const before = allCount()
  await toggleDone(user, 'Milk')
  expect(allCount()).toBe(before - 1)
  await rightClick(user, row('Eggs'))
  await submenuClick(user, 'Set stage', 'Cancelled')
  expect(allCount()).toBe(before - 2)
})

const dragRow = async (from: HTMLElement, to: HTMLElement) => {
  const rows = rowsIn(main())
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return DOMRect.fromRect({ x: 0, y: rows.indexOf(this) * 40, width: 100, height: 40 })
  })
  const y = (element: HTMLElement) => rows.indexOf(element) * 40 + 20
  fireEvent.mouseDown(from, { button: 0, clientX: 50, clientY: y(from) })
  fireEvent.mouseMove(document, { clientX: 50, clientY: y(from) + 10 })
  await flush()
  fireEvent.mouseMove(document, { clientX: 50, clientY: y(to) })
  await flush()
  fireEvent.mouseUp(document, { clientX: 50, clientY: y(to) })
  await act(() => new Promise((resolve) => setTimeout(resolve, 60)))
  vi.restoreAllMocks()
}

test('dragging a task does not reorder while sorted, and does once the sort is cleared', async () => {
  const user = await setup()
  await pick(user, sortButton(), 'Priority')
  const sorted = tasks()
  await dragRow(row(sorted[0] ?? ''), row(sorted[1] ?? ''))
  expect(tasks()).toEqual(sorted)
  expect(screen.getByRole('button', { name: /^Clear sort/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Clear sort/ }))
  const before = tasks()
  await dragRow(row(before[0] ?? ''), row(before[1] ?? ''))
  expect(tasks()).toEqual([before[1], before[0]])
})
