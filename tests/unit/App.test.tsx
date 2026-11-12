import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'
import { today, tomorrow } from '../../src/due'

const setup = () => ({ user: userEvent.setup(), ...render(<App />) })
const nav = () => screen.getByRole('navigation')
const main = () => screen.getByRole('main')
const aside = () => screen.getByRole('complementary')
const STAGES = '⬜ Open⚡ In progress⏳ Waiting✅ Done❌️ Cancelled'
const rowName = (rowElement: HTMLElement) =>
  (rowElement.textContent ?? '').replace(STAGES, '').replace(/(\d+\/\d+|📅 |🔴|🔵).*$/, '')
const rowsIn = (root: HTMLElement) =>
  within(root).queryAllByRole('button').filter((button) => !/^[✕×›]$/.test(button.textContent ?? ''))
const namesIn = (root: HTMLElement) => rowsIn(root).map(rowName)
const tasks = () => namesIn(main())
const subtasks = () => namesIn(aside())
const lists = () =>
  within(nav())
    .getAllByRole('button')
    .map((button) => (button.textContent ?? '').replace(/\d+$/, ''))
    .filter((text) => !text.startsWith('+'))
const row = (name: string, root: HTMLElement = main()) =>
  rowsIn(root).find((rowElement) => rowName(rowElement) === name)!
const stageSelect = (name: string) => within(row(name)).getByRole('combobox')
const dueInput = () => within(aside()).getAllByDisplayValue(/^(\d{4}-\d{2}-\d{2})?$/).at(-1)!
const closeButton = () => within(aside()).getByLabelText('Close panel')
const removeDue = () => within(aside()).getByText('×')

type User = ReturnType<typeof userEvent.setup>
const submenuClick = async (user: User, parent: string, leaf: string) => {
  await user.hover(screen.getByText(parent))
  fireEvent.click(screen.getByText(leaf))
}
const rightClick = (user: User, element: HTMLElement) => user.pointer({ keys: '[MouseRight]', target: element })
const menuAction = async (user: User, element: HTMLElement, action: 'Delete') => {
  await rightClick(user, element)
  await user.click(screen.getByText(action))
}
const rename = async (user: User, element: HTMLElement, name: string) => {
  await user.click(element)
  await user.keyboard(`${name}{Enter}`)
}
const newList = async (user: User, name: string) => {
  await user.click(screen.getByText('+ New list'))
  await user.type(screen.getByPlaceholderText('List name…'), `${name}{Enter}`)
}
const toggle = (user: User, name: string, root: HTMLElement = main()) =>
  user.click(within(row(name, root)).getByRole('checkbox'))
const setDue = (value: string) =>
  fireEvent.change(dueInput(), { target: { value } })
const pick = async (user: User, from: string, to: string) => {
  await user.click(within(main()).getByText('Milk'))
  await user.selectOptions(within(aside()).getByDisplayValue(from), to)
}

test('add a task and set its stage from the row', async () => {
  const { user } = setup()
  await user.type(screen.getByPlaceholderText(/new task/i), 'Bread{Enter}')
  expect(tasks()).toEqual(['Bread', 'Milk', 'Eggs'])

  const stage = stageSelect('Bread')
  await user.selectOptions(stage, 'done')
  expect(stage).toHaveDisplayValue('✅ Done')
  expect(tasks()).toEqual(['Milk', 'Eggs', 'Bread'])

  await user.selectOptions(stage, 'inProgress')
  expect(stage).toHaveDisplayValue('⚡ In progress')
  await user.selectOptions(stage, 'open')
  expect(stage).toHaveDisplayValue('⬜ Open')
})

test('open side panel, add and toggle a subtask', async () => {
  const { user } = setup()
  await user.click(within(main()).getByText('Milk'))
  expect(within(aside()).getByText('2% lactose free')).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText(/new subtask/i), 'Oat{Enter}')
  expect(within(aside()).getByText('Oat')).toBeInTheDocument()
  expect(within(screen.getByRole('main')).queryByText('Oat')).not.toBeInTheDocument()

  await toggle(user, 'Oat', aside())
  expect(within(row('Oat', aside())).getByRole('checkbox')).toBeChecked()
})

test('subtask count shows and updates on toggle, hidden with no subtasks', async () => {
  const { user } = setup()
  const main = screen.getByRole('main')
  expect(within(main).getByText('0/1')).toBeInTheDocument()
  expect(within(row('Eggs')).queryByText(/^\d+\/\d+$/)).toBeNull()
  await user.click(screen.getByText('Milk'))
  await toggle(user, '2% lactose free', aside())
  expect(within(main).getByText('1/1')).toBeInTheDocument()
})

test('toggling a subtask moves it below open ones', async () => {
  const { user } = setup()
  await user.click(within(main()).getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/new subtask/i), 'Oat{Enter}')
  expect(subtasks()).toEqual(['Oat', '2% lactose free'])

  await toggle(user, 'Oat', aside())
  expect(subtasks()).toEqual(['2% lactose free', 'Oat'])
})

test('rename, cancel rename and delete a task', async () => {
  const { user } = setup()
  await user.click(within(main()).getByText('Eggs'))
  await rename(user, within(aside()).getByRole('heading', { name: 'Eggs' }), 'Ham')
  expect(within(main()).getByText('Ham')).toBeInTheDocument()
  expect(within(main()).queryByText('Eggs')).not.toBeInTheDocument()

  await user.click(within(aside()).getByRole('heading', { name: 'Ham' }))
  await user.keyboard('Nope{Escape}')
  expect(within(main()).getByText('Ham')).toBeInTheDocument()
  expect(screen.queryByText('Nope')).not.toBeInTheDocument()

  await menuAction(user, within(main()).getByText('Ham'), 'Delete')
  expect(within(main()).queryByText('Ham')).not.toBeInTheDocument()
})

test('rename and delete a subtask', async () => {
  const { user } = setup()
  await user.click(within(main()).getByText('Milk'))

  await rename(user, within(aside()).getByText('2% lactose free'), 'Skim')
  expect(subtasks()).toEqual(['Skim'])

  await menuAction(user, within(aside()).getByText('Skim'), 'Delete')
  expect(subtasks()).toEqual([])
  expect(screen.getByText('No subtasks yet')).toBeInTheDocument()
})

test('create, switch, rename and delete lists', async () => {
  const { user } = setup()
  await newList(user, 'Fun')
  expect(screen.getByRole('heading', { name: 'Fun' })).toBeInTheDocument()

  await user.click(within(nav()).getByText('Work'))
  expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()

  await user.click(within(nav()).getByText('Fun'))
  await rename(user, screen.getByRole('heading', { name: 'Fun' }), 'Play')
  expect(within(nav()).getByText('Play')).toBeInTheDocument()
  expect(within(nav()).queryByText('Fun')).not.toBeInTheDocument()

  await user.click(within(nav()).getByText('Work'))
  await menuAction(user, within(nav()).getByText('Work'), 'Delete')
  expect(within(nav()).queryByText('Work')).not.toBeInTheDocument()
  expect(screen.queryByText('Reply to emails')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
})

test('deleting every list falls back to the All view with all tasks', async () => {
  const { user } = setup()
  for (const name of ['Groceries', 'Work', 'Home']) {
    await menuAction(user, within(nav()).getByText(name), 'Delete')
  }
  expect(screen.getByRole('heading', { name: '📋 All' })).toBeInTheDocument()
  expect(tasks()).toHaveLength(5)
})

const allTexts = async (user: User) => {
  await user.click(within(nav()).getByText('📋 All'))
  return tasks()
}

test('All view shows tasks from every list', async () => {
  const { user } = setup()
  expect(await allTexts(user)).toEqual(['Milk', 'Eggs', 'Reply to emails', 'Update docs', 'Review PR'])
})

test('an edit made in a list is reflected in All', async () => {
  const { user } = setup()
  await user.click(within(main()).getByText('Milk'))
  await rename(user, within(aside()).getByRole('heading', { name: 'Milk' }), 'Oat milk')
  await user.selectOptions(stageSelect('Eggs'), 'done')
  await user.click(within(nav()).getByText('📋 All'))
  expect(screen.getByText('Oat milk')).toBeInTheDocument()
  expect(stageSelect('Eggs')).toHaveDisplayValue('✅ Done')
})

test('deleting a list keeps its tasks in All', async () => {
  const { user } = setup()
  await menuAction(user, within(nav()).getByText('Work'), 'Delete')
  expect(await allTexts(user)).toEqual(['Milk', 'Eggs', 'Reply to emails', 'Update docs', 'Review PR'])
})

test('adding in All creates a task visible only in All', async () => {
  const { user } = setup()
  await user.click(within(nav()).getByText('📋 All'))
  await user.type(screen.getByPlaceholderText(/new task/i), 'Loose{Enter}')
  expect(tasks()[0]).toBe('Loose')
  for (const name of ['Groceries', 'Work', 'Home']) {
    await user.click(within(nav()).getByText(name))
    expect(screen.queryByText('Loose')).not.toBeInTheDocument()
  }
})

test('whitespace-only names are ignored', async () => {
  const { user } = setup()
  await user.type(screen.getByPlaceholderText(/new task/i), '   {Enter}')
  expect(tasks()).toEqual(['Milk', 'Eggs'])

  await user.click(within(main()).getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/new subtask/i), '   {Enter}')
  expect(subtasks()).toEqual(['2% lactose free'])

  await newList(user, '   ')
  expect(lists()).toEqual(['Groceries', 'Work', 'Home'])
})

test('new list, task and subtask land in the right place', async () => {
  const { user } = setup()

  await newList(user, 'Fun')
  expect(screen.getByRole('heading', { name: 'Fun' })).toBeInTheDocument()
  expect(lists()).toEqual(['Groceries', 'Work', 'Home', 'Fun'])
  expect(within(main()).queryByText('Milk')).not.toBeInTheDocument()
  expect(within(main()).queryByText('Eggs')).not.toBeInTheDocument()

  await user.click(within(nav()).getByText('Work'))
  await user.type(screen.getByPlaceholderText(/new task/i), 'Plan{Enter}')
  expect(tasks()[0]).toBe('Plan')

  await user.click(within(nav()).getByText('Groceries'))
  expect(tasks()).toEqual(['Milk', 'Eggs'])

  await user.click(within(main()).getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/new subtask/i), 'Oat{Enter}')
  expect(tasks()).toEqual(['Milk', 'Eggs'])
  expect(subtasks()).toEqual(['Oat', '2% lactose free'])

  await user.click(within(main()).getByText('Eggs'))
  expect(screen.queryByText('Oat')).not.toBeInTheDocument()
  expect(screen.queryByText('2% lactose free')).not.toBeInTheDocument()
})

describe('side panel closes', () => {
  test('via the close button', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    await user.click(closeButton())
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  test('when switching lists', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    await user.click(within(nav()).getByText('Work'))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  test('when the selected task is deleted', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    await menuAction(user, within(screen.getByRole('main')).getByText('Milk'), 'Delete')
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })
})

describe('changes only affect the touched item', () => {
  const snapshot = async (user: User) => {
    const result: Record<string, string[]> = {}
    for (const name of ['Groceries', 'Work', 'Home']) {
      await user.click(within(nav()).getByText(name))
      result[name] = tasks()
    }
    await user.click(within(nav()).getByText('Groceries'))
    await user.click(within(main()).getByText('Milk'))
    result.milkSubs = subtasks()
    await user.click(within(main()).getByText('Eggs'))
    return result
  }

  test('task and subtask add, toggle, rename, delete leave the rest unchanged', async () => {
    const { user } = setup()
    const before = await snapshot(user)
    const order = lists()

    // Work tasks and Groceries subtasks untouched by Groceries task edits.
    await user.type(screen.getByPlaceholderText(/new task/i), 'Bread{Enter}')
    await user.click(within(main()).getByText('Bread'))
    await rename(user, within(aside()).getByRole('heading', { name: 'Bread' }), 'Rye')
    await menuAction(user, within(main()).getByText('Rye'), 'Delete')
    await user.click(within(main()).getByText('Milk'))
    expect(subtasks()).toEqual(before.milkSubs)
    await user.click(within(nav()).getByText('Work'))
    expect(tasks()).toEqual(before.Work)

    // Subtask edits leave sibling tasks and other tasks' subtasks untouched.
    await user.click(within(nav()).getByText('Groceries'))
    await user.click(within(main()).getByText('Milk'))
    await user.type(screen.getByPlaceholderText(/new subtask/i), 'Oat{Enter}')
    await toggle(user, 'Oat', aside())
    await rename(user, within(aside()).getByText('Oat'), 'Soy')
    await menuAction(user, within(aside()).getByText('Soy'), 'Delete')
    expect(subtasks()).toEqual(before.milkSubs)
    expect(tasks()).toEqual(before.Groceries)
    await user.click(within(main()).getByText('Eggs'))
    expect(subtasks()).toEqual([])
    expect(lists()).toEqual(order)
    for (const name of ['Work', 'Home']) {
      await user.click(within(nav()).getByText(name))
      expect(tasks()).toEqual(before[name])
    }
  })

  test('list add, rename, delete keep other lists and their tasks', async () => {
    const { user } = setup()
    await newList(user, 'Fun')
    await rename(user, screen.getByRole('heading', { name: 'Fun' }), 'Play')
    expect(lists()).toEqual(['Groceries', 'Work', 'Home', 'Play'])
    await menuAction(user, within(nav()).getByText('Play'), 'Delete')
    expect(lists()).toEqual(['Groceries', 'Work', 'Home'])
    await user.click(within(nav()).getByText('Work'))
    expect(tasks()).toEqual(['Reply to emails', 'Update docs', 'Review PR'])
    await user.click(within(nav()).getByText('Groceries'))
    expect(tasks()).toEqual(['Milk', 'Eggs'])
  })
})

describe('due dates', () => {
  const openMilk = (user: User) => user.click(within(main()).getByText('Milk'))
  const dueLabel = dueInput

  test('sidebar sets and removes a due date, subtext shows on the task row', async () => {
    const { user } = setup()
    await openMilk(user)
    setDue('2000-01-01')
    expect(dueLabel()).toHaveValue('2000-01-01')
    expect(within(main()).getByText(/^📅 /)).toBeInTheDocument()

    await user.click(removeDue())
    expect(dueLabel()).toHaveValue('')
    expect(within(main()).queryByText(/^📅 /)).toBeNull()
  })

  test('sidebar shows a relative label only for yesterday, today and tomorrow', async () => {
    const { user } = setup()
    const yesterday = new Date(`${today()}T00:00:00Z`)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    await openMilk(user)
    const side = within(aside())
    setDue(yesterday.toISOString().slice(0, 10))
    expect(side.getByText('Yesterday')).toBeInTheDocument()
    setDue(today())
    expect(side.getByText('Today')).toBeInTheDocument()
    setDue(tomorrow())
    expect(side.getByText('Tomorrow')).toBeInTheDocument()
    setDue('2099-01-01')
    expect(side.queryByText(/^(Yesterday|Today|Tomorrow)$/)).toBeNull()
  })

  test('subtasks show no due subtext', async () => {
    const { user } = setup()
    await openMilk(user)
    setDue('2000-01-01')
    expect(within(row('2% lactose free', aside())).queryByText(/^📅 /)).toBeNull()
  })

  test('context menu Due today sets today', async () => {
    const { user } = setup()
    await rightClick(user, within(main()).getByText('Milk'))
    await submenuClick(user, 'Set due date', 'Today')
    expect(screen.getByText('📅 Today')).toBeInTheDocument()
  })

  test('submenu is hidden until hovered', async () => {
    const { user } = setup()
    await rightClick(user, within(main()).getByText('Milk'))
    expect(screen.queryByText('Tomorrow')).toBeNull()
    await user.hover(screen.getByText('Set due date'))
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
  })

  test('task context menu has due options only for tasks', async () => {
    const { user } = setup()
    await rightClick(user, within(main()).getByText('Milk'))
    await user.hover(screen.getByText('Set due date'))
    expect(screen.queryByText('Remove')).toBeNull()
    await submenuClick(user, 'Set due date', 'Tomorrow')
    expect(screen.getByText('📅 Tomorrow')).toBeInTheDocument()

    await rightClick(user, within(main()).getByText('Milk'))
    await user.hover(screen.getByText('Set due date'))
    expect(screen.getByText('Next week')).toBeInTheDocument()
    await submenuClick(user, 'Set due date', 'Remove')
    expect(within(main()).queryByText(/^📅 /)).toBeNull()

    await user.click(within(main()).getByText('Milk'))
    await rightClick(user, screen.getByText('2% lactose free'))
    expect(screen.queryByText('Set due date')).toBeNull()
  })
})

describe('priority', () => {
  test('sidebar select sets priority, row shows it, medium clears it', async () => {
    const { user } = setup()
    await pick(user, 'Medium', '🔴 High')
    expect(within(main()).getByText('🔴 High priority')).toBeInTheDocument()
    await pick(user, '🔴 High', '🔵 Low')
    expect(within(main()).getByText('🔵 Low priority')).toBeInTheDocument()
    await pick(user, '🔵 Low', 'Medium')
    expect(screen.queryByText(/priority$/)).toBeNull()
  })

  test('context menu sets and clears priority', async () => {
    const { user } = setup()
    await rightClick(user, within(main()).getByText('Milk'))
    await submenuClick(user, 'Set priority', 'High')
    expect(screen.getByText('🔴 High priority')).toBeInTheDocument()
    await rightClick(user, within(main()).getByText('Milk'))
    await user.hover(screen.getByText('Set priority'))
    fireEvent.click(screen.getAllByText('Medium').at(-1)!)
    expect(screen.queryByText(/priority$/)).toBeNull()
  })

  test('subtasks show no priority', async () => {
    const { user } = setup()
    await pick(user, 'Medium', '🔴 High')
    expect(within(row('2% lactose free', aside())).queryByText(/priority$/)).toBeNull()
  })
})

describe('stage', () => {
  test('closing a task moves it right after the last open task', async () => {
    const { user } = setup()
    await user.click(within(nav()).getByText('Work'))
    await user.selectOptions(stageSelect('Review PR'), 'done')
    await user.selectOptions(stageSelect('Reply to emails'), 'cancelled')
    expect(tasks()).toEqual(['Update docs', 'Reply to emails', 'Review PR'])
  })

  test('reopening a task moves it to the bottom of the open section', async () => {
    const { user } = setup()
    await user.click(within(nav()).getByText('Work'))
    await user.selectOptions(stageSelect('Reply to emails'), 'done')
    await user.selectOptions(stageSelect('Update docs'), 'done')
    expect(tasks()).toEqual(['Review PR', 'Update docs', 'Reply to emails'])
    await user.selectOptions(stageSelect('Reply to emails'), 'inProgress')
    expect(tasks()).toEqual(['Review PR', 'Reply to emails', 'Update docs'])
  })

  test('switching from done to cancelled keeps position', async () => {
    const { user } = setup()
    await user.click(within(nav()).getByText('Work'))
    await user.selectOptions(stageSelect('Reply to emails'), 'done')
    await user.selectOptions(stageSelect('Update docs'), 'done')
    await user.selectOptions(stageSelect('Update docs'), 'cancelled')
    expect(tasks()).toEqual(['Review PR', 'Update docs', 'Reply to emails'])
  })

  test('switching between open stages keeps position', async () => {
    const { user } = setup()
    await user.click(within(nav()).getByText('Work'))
    await user.selectOptions(stageSelect('Reply to emails'), 'inProgress')
    await user.selectOptions(stageSelect('Reply to emails'), 'waiting')
    expect(tasks()).toEqual(['Reply to emails', 'Update docs', 'Review PR'])
  })


  test('closing a task in All moves it after the last open task across lists', async () => {
    const { user } = setup()
    await user.click(within(nav()).getByText('📋 All'))
    await user.selectOptions(stageSelect('Milk'), 'done')
    expect(tasks()).toEqual(['Eggs', 'Reply to emails', 'Update docs', 'Review PR', 'Milk'])
  })

  test('context menu has no stage options', async () => {
    const { user } = setup()
    await rightClick(user, within(main()).getByText('Milk'))
    expect(screen.queryByText(/^Set (open|in progress|waiting|done|cancelled)$/)).toBeNull()
  })

  test('subtasks have no stage select', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    expect(within(row('2% lactose free', aside())).queryByRole('combobox')).toBeNull()
  })
})

describe('task fields', () => {
  const setAll = async (user: User) => {
    await user.click(within(main()).getByText('Milk'))
    setDue('2000-01-01')
    await user.selectOptions(stageSelect('Milk'), 'inProgress')
    await user.selectOptions(within(aside()).getByDisplayValue('Medium'), '🔴 High')
  }

  test('remove due date button is hidden without a due date and clears it', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    expect(within(aside()).queryByText('×')).toBeNull()
    setDue('2000-01-01')
    await user.click(removeDue())
    expect(dueInput()).toHaveValue('')
    expect(within(main()).queryByText(/^📅 /)).toBeNull()
  })

  test('row subtext order is count, due, priority', async () => {
    const { user } = setup()
    await setAll(user)
    expect(row('Milk')).toHaveTextContent(/0\/1.*📅 Sat Jan 1.*🔴 High priority/)
  })

  test('fields survive rename', async () => {
    const { user } = setup()
    await setAll(user)
    await user.click(within(main()).getByText('Milk'))
    await rename(user, within(aside()).getByRole('heading', { name: 'Milk' }), 'Oat')
    const oat = within(row('Oat'))
    expect(oat.getByText(/^📅 /)).toBeInTheDocument()
    expect(oat.getByRole('combobox')).toHaveDisplayValue('⚡ In progress')
    expect(oat.getByText('🔴 High priority')).toBeInTheDocument()
  })

  test('sidebar shows the selected task own values', async () => {
    const { user } = setup()
    await setAll(user)
    await user.click(within(main()).getByText('Eggs'))
    expect(dueInput()).toHaveValue('')
    expect(within(aside()).getByDisplayValue('Medium')).toBeInTheDocument()
  })

  test('subtask context menu has only Delete', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    await rightClick(user, screen.getByText('2% lactose free'))
    expect(screen.queryByText('Rename')).toBeNull()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Set due date')).toBeNull()
    expect(screen.queryByText('Set priority')).toBeNull()
  })

  test('subtask toggle and delete leave a same-named task unchanged', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Eggs'))
    await user.click(within(main()).getByText('Milk'))
    await user.type(screen.getByPlaceholderText(/new subtask/i), 'Eggs{Enter}')
    const before = tasks()
    await toggle(user, 'Eggs', aside())
    expect(tasks()).toEqual(before)
    await menuAction(user, within(aside()).getByText('Eggs'), 'Delete')
    expect(tasks()).toEqual(before)
    expect(within(aside()).queryByText('Eggs')).toBeNull()
  })
})

test('adding in Today creates a task visible in Today and All', async () => {
  const { user } = setup()
  await user.click(within(nav()).getByText('☀️ Today'))
  expect(tasks()).toEqual([])
  await user.type(screen.getByPlaceholderText(/new task/i), 'Now{Enter}')
  expect(tasks()).toEqual(['Now'])
  await user.click(within(nav()).getByText('📋 All'))
  expect(screen.getByText('Now')).toBeInTheDocument()
  await user.click(within(nav()).getByText('Groceries'))
  expect(screen.queryByText('Now')).not.toBeInTheDocument()
})

test('Today shows overdue and due-today tasks but not others', async () => {
  const { user } = setup()
  const due = async (name: string, value: string) => {
    await user.click(screen.getByText(name))
    setDue(value)
  }
  await due('Milk', '2000-01-01')
  await due('Eggs', tomorrow())
  await user.click(within(nav()).getByText('Work'))
  await due('Review PR', today())
  await user.click(within(nav()).getByText('☀️ Today'))
  const view = within(main())
  expect(view.getByText('Milk')).toBeInTheDocument()
  expect(view.getByText('Review PR')).toBeInTheDocument()
  expect(view.queryByText('Eggs')).toBeNull()
  expect(view.queryByText('Update docs')).toBeNull()
})

describe('sidebar counts', () => {
  test('shown, hidden at 0, and updated on add/delete', async () => {
    const { user } = setup()
    expect(nav()).toHaveTextContent(/^☀️ Today📋 All5Groceries2Work3Home\+ New list$/)
    await user.type(screen.getByPlaceholderText(/new task/i), 'Bread{Enter}')
    expect(nav()).toHaveTextContent(/^☀️ Today📋 All6Groceries3Work3Home\+ New list$/)
    await menuAction(user, within(main()).getByText('Bread'), 'Delete')
    expect(nav()).toHaveTextContent(/^☀️ Today📋 All5Groceries2Work3Home\+ New list$/)
  })
})

describe('multi-select', () => {
  const ctrlClick = (user: User, name: string, root: HTMLElement = main()) =>
    user.keyboard('{Control>}').then(() => user.click(row(name, root))).then(() => user.keyboard('{/Control}'))
  const shiftClick = (user: User, name: string) =>
    user.keyboard('{Shift>}').then(() => user.click(row(name))).then(() => user.keyboard('{/Shift}'))
  const selectTwo = async (user: User) => {
    await user.click(row('Milk'))
    await ctrlClick(user, 'Eggs')
  }

  test('ctrl-click toggles, shift-click selects a range, panel only for one', async () => {
    const { user } = setup()
    await selectTwo(user)
    expect(screen.queryByRole('complementary')).toBeNull()
    await ctrlClick(user, 'Eggs')
    expect(aside()).toBeInTheDocument()
    await user.click(within(nav()).getByText(/All/))
    await user.click(row('Milk'))
    await shiftClick(user, 'Update docs')
    expect(row('Eggs')).toHaveClass('bg-gray-100')
    expect(row('Reply to emails')).toHaveClass('bg-gray-100')
    expect(row('Update docs')).toHaveClass('bg-gray-100')
    expect(row('Review PR')).not.toHaveClass('bg-gray-100')
  })

  test('bulk due and priority apply to all and keep selection', async () => {
    const { user } = setup()
    await selectTwo(user)
    await rightClick(user, row('Milk'))
    expect(screen.queryByText('Rename')).toBeNull()
    await submenuClick(user, 'Set due date', 'Today')
    await rightClick(user, row('Eggs'))
    await submenuClick(user, 'Set priority', 'High')
    expect(within(main()).getAllByText('🔴 High priority')).toHaveLength(2)
    expect(within(main()).getAllByText(/📅/)).toHaveLength(2)
    expect(row('Milk')).toHaveClass('bg-gray-100')
  })

  test('bulk delete tasks', async () => {
    const { user } = setup()
    await selectTwo(user)
    await user.pointer({ keys: '[MouseRight]', target: row('Eggs') })
    await user.click(screen.getByText('Delete'))
    expect(tasks()).toEqual([])
  })

  test('bulk delete subtasks', async () => {
    const { user } = setup()
    await user.click(row('Milk'))
    await user.type(within(aside()).getByPlaceholderText(/new subtask/i), 'Skim{Enter}')
    await user.click(row('Skim', aside()))
    await ctrlClick(user, '2% lactose free', aside())
    await rightClick(user, row('Skim', aside()))
    expect(screen.queryByText('Rename')).toBeNull()
    await user.click(screen.getByText('Delete'))
    expect(subtasks()).toEqual([])
  })

  test('modifier-click on subtask text selects without renaming', async () => {
    const { user } = setup()
    await user.click(row('Milk'))
    await user.type(within(aside()).getByPlaceholderText(/new subtask/i), 'Skim{Enter}')
    await user.click(row('Skim', aside()))
    const boxes = within(aside()).getAllByRole('textbox').length
    for (const key of ['Control', 'Shift']) {
      await user.keyboard(`{${key}>}`)
      await user.click(within(aside()).getByText('2% lactose free'))
      await user.keyboard(`{/${key}}`)
      expect(within(aside()).getAllByRole('textbox')).toHaveLength(boxes)
      expect(row('Skim', aside())).toHaveClass('bg-gray-200')
      expect(row('2% lactose free', aside())).toHaveClass('bg-gray-200')
      await user.click(row('Skim', aside()))
    }
  })
})
