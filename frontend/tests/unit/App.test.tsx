import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'
import { createFakeBackend, task as makeTask } from '../fakeBackend'
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
  fireEvent.click(screen.getByText(leaf, { selector: '[role^="menuitem"] span' }))
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
const selectTwo = async (user: User) => {
  await user.click(row('Milk'))
  await user.keyboard('{Control>}')
  await user.click(row('Eggs'))
  await user.keyboard('{/Control}')
}
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))
const taskById = (id: string) => backend.data.tasks.find((task) => task.id === id)
const stepRow = (name: string) => row(name, aside())
const isSelected = (element: HTMLElement) => element.dataset.selected === 'true'
const selectedSteps = () => ['2% lactose free', 'Skim', 'Oat'].map((name) => isSelected(stepRow(name)))
const stepStage = (name: string) => backend.data.steps.find((step) => step.title === name)?.stage
const withSteps = async (user: User) => {
  await user.click(row('Milk'))
  await newStep(user, 'Skim')
  await newStep(user, 'Oat')
  await flush()
}

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

test('deleting the selected list sends one batch request and selects the list before it', async () => {
  const user = await setup()
  const deletes: unknown[] = []
  const realFetch = fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    if (init.method === 'DELETE') deletes.push([new URL(url).pathname, JSON.parse(init.body as string)])
    return realFetch(url, init)
  })
  await user.click(within(nav()).getByText('Work'))
  await deleteViaMenu(user, within(nav()).getByText('Work'))
  await flush()
  expect(deletes).toEqual([['/lists', { ids: ['work'] }]])
  expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
  expect(lists()).not.toContain('Work')
  expect(backend.data.tasks.some((task) => task.listId === 'work')).toBe(false)
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
  act(() => dueInput().focus())
  fireEvent.change(dueInput(), { target: { value: '2030-01-02' } })
  await flush()
  expect(taskById('g1')?.due).toBeNull()
  fireEvent.keyDown(dueInput(), { key: 'Enter' })
  await flush()
  expect(taskById('g1')?.due).toBe('2030-01-02')
})

test('clicking the due date opens the picker', async () => {
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  const showPicker = vi.fn()
  ;(dueInput() as HTMLInputElement).showPicker = showPicker
  fireEvent.click(dueInput())
  expect(showPicker).toHaveBeenCalled()
})

test('clicking the Today row adds the task, and only the X removes it', async () => {
  const user = await setup()
  await user.click(within(main()).getByText('Milk'))
  expect(within(aside()).queryByRole('button', { name: 'Remove from Today' })).toBeNull()
  await user.click(within(aside()).getByRole('button', { name: 'Add to Today' }))
  expect(taskById('g1')?.addedToToday).toBe(true)
  await user.click(within(aside()).getByText('Added to Today'))
  expect(taskById('g1')?.addedToToday).toBe(true)
  await user.click(within(aside()).getByRole('button', { name: 'Remove from Today' }))
  expect(taskById('g1')?.addedToToday).toBe(false)
  expect(within(aside()).getByRole('button', { name: 'Add to Today' })).toBeInTheDocument()
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

test('a failing bulk patch leaves every item unchanged and shows the banner', async () => {
  const user = await setup()
  await selectTwo(user)
  backend.data.tasks = backend.data.tasks.filter((t) => t.id !== 'g2')
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set priority', 'High')
  expect(screen.getByRole('alert')).toHaveTextContent('Not found')
  expect(within(main()).queryByTitle('High priority')).toBeNull()
  expect(taskById('g1')).toMatchObject({ priority: 'medium' })
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

  test('ctrl-click toggles steps, shift-click adds a range, plain click clears', async () => {
    const user = await setup()
    await withSteps(user)
    await user.keyboard('{Control>}')
    await user.click(stepRow('2% lactose free'))
    await user.keyboard('{/Control}')
    await user.keyboard('{Shift>}')
    await user.click(stepRow('Oat'))
    await user.keyboard('{/Shift}')
    expect(selectedSteps()).toEqual([true, true, true])
    await user.keyboard('{Control>}')
    await user.click(stepRow('Skim'))
    await user.keyboard('{/Control}')
    expect(selectedSteps()).toEqual([true, false, true])
    await user.click(stepRow('Skim'))
    expect(rowsIn(aside()).some(isSelected)).toBe(false)
  })

  test('Escape clears the step selection and keeps the panel', async () => {
    const user = await setup()
    await withSteps(user)
    await user.keyboard('{Control>}')
    await user.click(stepRow('Oat'))
    await user.keyboard('{/Control}')
    await user.keyboard('{Escape}')
    expect(isSelected(stepRow('Oat'))).toBe(false)
    expect(aside()).toBeInTheDocument()
  })

  test('the step menu sets the stage of every selected step, then deletes them', async () => {
    const user = await setup()
    await withSteps(user)
    await user.keyboard('{Control>}')
    await user.click(stepRow('Skim'))
    await user.click(stepRow('Oat'))
    await user.keyboard('{/Control}')
    await rightClick(user, stepRow('Oat'))
    expect(screen.getByText('2 steps')).toBeInTheDocument()
    await submenuClick(user, 'Set stage', 'Waiting')
    expect([stepStage('Skim'), stepStage('Oat'), stepStage('2% lactose free')]).toEqual(['waiting', 'waiting', 'open'])
    await rightClick(user, stepRow('Skim'))
    await submenuClick(user, 'Set stage', 'Open')
    expect([stepStage('Skim'), stepStage('Oat')]).toEqual(['open', 'open'])
    await deleteViaMenu(user, stepRow('Skim'))
    await flush()
    expect(steps()).toEqual(['2% lactose free'])
  })

  test('the step icon toggles done and open', async () => {
    const user = await setup()
    await withSteps(user)
    await user.click(within(stepRow('Oat')).getByRole('button', { name: 'Mark done' }))
    await flush()
    expect(stepStage('Oat')).toBe('done')
    expect(within(stepRow('Oat')).getByRole('button', { name: 'Mark open' })).toHaveAttribute('title', 'Done')
    await user.click(within(stepRow('Oat')).getByRole('button', { name: 'Mark open' }))
    await flush()
    expect(stepStage('Oat')).toBe('open')
  })

  test('the step menu checks the shared stage only when all targets share it', async () => {
    const user = await setup()
    await withSteps(user)
    await user.click(within(stepRow('Oat')).getByRole('button', { name: 'Mark done' }))
    await flush()
    await rightClick(user, stepRow('Oat'))
    await user.hover(screen.getByText('Set stage'))
    expect(screen.getByRole('menuitemradio', { name: 'Done' })).toBeChecked()
    await user.keyboard('{Escape}')
    await user.keyboard('{Control>}')
    await user.click(stepRow('Skim'))
    await user.click(stepRow('Oat'))
    await user.keyboard('{/Control}')
    await rightClick(user, stepRow('Oat'))
    await user.hover(screen.getByText('Set stage'))
    expect(screen.queryByRole('menuitemradio', { checked: true })).toBeNull()
  })

  test('the task step counter excludes cancelled steps', async () => {
    const user = await setup()
    await withSteps(user)
    await user.click(within(stepRow('Skim')).getByRole('button', { name: 'Mark done' }))
    await rightClick(user, stepRow('Oat'))
    await submenuClick(user, 'Set stage', 'Cancelled')
    expect(row('Milk')).toHaveTextContent('1/2')
  })

  test('right-clicking an unselected step targets only that step', async () => {
    const user = await setup()
    await withSteps(user)
    await user.keyboard('{Control>}')
    await user.click(stepRow('Skim'))
    await user.click(stepRow('Oat'))
    await user.keyboard('{/Control}')
    await rightClick(user, stepRow('2% lactose free'))
    expect(screen.queryByText('2 steps')).toBeNull()
    await submenuClick(user, 'Set stage', 'Done')
    expect([stepStage('2% lactose free'), stepStage('Skim'), stepStage('Oat')]).toEqual(['done', 'open', 'open'])
  })

  test('the step selection clears when the detail task changes', async () => {
    const user = await setup()
    await withSteps(user)
    await user.keyboard('{Control>}')
    await user.click(stepRow('Oat'))
    await user.keyboard('{/Control}')
    await user.click(row('Eggs'))
    await user.click(row('Milk'))
    expect(isSelected(stepRow('Oat'))).toBe(false)
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
  expect(drawer()).toHaveClass('hidden')
  await user.click(screen.getByLabelText('Open lists'))
  expect(drawer()).not.toHaveClass('hidden')
  await user.click(screen.getByLabelText('Close lists'))
  expect(drawer()).toHaveClass('hidden')
  await user.click(screen.getByLabelText('Open lists'))
  await user.click(within(nav()).getByText('Work'))
  expect(drawer()).toHaveClass('hidden')
  expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
  await user.click(screen.getByLabelText('Open lists'))
  expect(screen.getByRole('dialog', { name: 'Lists' })).toBeInTheDocument()
  expect(screen.getByLabelText('Close lists')).toHaveFocus()
  expect(main()).toHaveAttribute('inert')
  await user.keyboard('{Escape}')
  expect(drawer()).toHaveClass('hidden')
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
  expect(nav().parentElement).toHaveClass('hidden')
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

  await selectTwo(user)
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
  expect(taskById('g1')?.listId).toBe('home')
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
  expect(taskById('g1')?.stage).toBe('waiting')
  expect(toggleButton('Milk')).toHaveAttribute('title', 'Waiting')
})

test('the row stage icon toggles done and open without selecting the row', async () => {
  const user = await setup()
  await toggleDone(user, 'Eggs')
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(taskById('g2')?.stage).toBe('done')
  await toggleDone(user, 'Eggs')
  expect(taskById('g2')?.stage).toBe('open')
  await rightClick(user, row('Eggs'))
  await submenuClick(user, 'Set stage', 'Waiting')
  await toggleDone(user, 'Eggs')
  expect(taskById('g2')?.stage).toBe('done')
  await toggleDone(user, 'Eggs')
  expect(taskById('g2')?.stage).toBe('open')
})

test('progress ignores cancelled tasks', async () => {
  const user = await setup()
  await toggleDone(user, 'Milk')
  await rightClick(user, row('Eggs'))
  await submenuClick(user, 'Set stage', 'Cancelled')
  expect(within(main()).getByText(/of \d+ done/)).toHaveTextContent(`1 of ${tasks().length - 1} done`)
})

test('the sort menu lists the options and clearing the sort restores the order', async () => {
  const user = await setup()
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set priority', 'Low')
  const before = tasks()
  await user.click(sortButton())
  expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Stage', 'Due date', 'Priority'])
  await user.click(screen.getByRole('menuitem', { name: 'Priority' }))
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
  await user.click(screen.getByRole('menuitem', { name: 'Stage' }))
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
  expect(taskById('g1')?.due).toBe('2026-12-01')
  expect(screen.queryByRole('menu')).toBeNull()
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set due date', 'Remove due date')
  expect(taskById('g1')?.due).toBeNull()
})

test('the context menu shows the current due date next to Set due date', async () => {
  const user = await setup()
  await rightClick(user, row('Milk'))
  await submenuClick(user, 'Set due date', 'Tomorrow')
  await rightClick(user, row('Milk'))
  const item = screen.getByRole('menuitem', { name: 'Set due date' })
  expect(item).toHaveTextContent('Tomorrow')
})

test('task properties follow one order in the menu, panel and row', async () => {
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const user = await setup()
  await rightClick(user, row('Milk'))
  expect(
    within(screen.getByRole('menu'))
      .getAllByRole('menuitem')
      .map((item) => item.ariaLabel ?? item.textContent),
  ).toEqual(['Set stage', 'Add to Today', 'Set due date', 'Set priority', 'Move to list', 'Delete'])
  await user.keyboard('{Escape}')
  await user.click(row('Milk'))
  const panel = within(aside())
  const order = [
    panel.getByRole('button', { name: /^Stage: / }),
    panel.getByRole('button', { name: 'Add to Today' }),
    panel.getByLabelText('Due date'),
    panel.getByRole('button', { name: /^Priority: / }),
    panel.getByRole('button', { name: /^List: / }),
  ]
  expect(
    [...aside().querySelectorAll('button, input')].filter((element) => order.includes(element as HTMLElement)),
  ).toEqual(order)
  await user.click(panel.getByRole('button', { name: 'Add to Today' }))
  await pick(user, panel.getByRole('button', { name: /^Priority: / }), 'High')
  fireEvent.blur(dueInput(), { target: { value: '2026-12-01' } })
  await flush()
  expect([...row('Milk').querySelectorAll('p span')].map((span) => span.textContent)).toEqual([
    'Today',
    'Tue Dec 1',
    'High',
    '0/1',
  ])
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
  fireEvent.mouseMove(document, { clientX: 50, clientY: y(to) + 10 })
  await flush()
  fireEvent.mouseUp(document, { clientX: 50, clientY: y(to) + 10 })
  await act(() => new Promise((resolve) => setTimeout(resolve, 60)))
  vi.restoreAllMocks()
}

test('dragging a task does not reorder while sorted, and does once the sort is cleared', async () => {
  const user = await setup()
  await user.click(sortButton())
  await user.click(screen.getByRole('menuitem', { name: 'Priority' }))
  const sorted = tasks()
  await dragRow(row(sorted[0] ?? ''), row(sorted[1] ?? ''))
  expect(tasks()).toEqual(sorted)
  expect(screen.getByRole('button', { name: /^Clear sort/ })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Clear sort/ }))
  const before = tasks()
  await dragRow(row(before[0] ?? ''), row(before[1] ?? ''))
  expect(tasks()).toEqual([before[1], before[0]])
})

test('dragging one of several selected tasks reorders them together', async () => {
  backend.data.tasks.push(
    makeTask('g3', 'Bread', 'groceries'),
    makeTask('g4', 'Butter', 'groceries'),
    makeTask('g5', 'Jam', 'groceries'),
  )
  const user = await setup()
  const before = tasks()
  await user.keyboard('{Control>}')
  await user.click(row(before[2] ?? ''))
  await user.click(row(before[4] ?? ''))
  await user.keyboard('{/Control}')
  await dragRow(row(before[4] ?? ''), row(before[0] ?? ''))
  expect(tasks()).toEqual([before[0], before[2], before[4], before[1], before[3]])
})
