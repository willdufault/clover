import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App'
import { today, tomorrow } from '../src/due'

const setup = () => ({ user: userEvent.setup(), ...render(<App />) })
const nav = () => screen.getByRole('navigation')
const main = () => screen.getByRole('main')
const aside = () => screen.getByRole('complementary')
const STAGES = '⬜⚡⏳✅❌️'
const rowName = (rowElement: HTMLElement) =>
  (rowElement.textContent ?? '').replace(STAGES, '').replace(/(\d+\/\d+|Due |🔴|🔵).*$/, '')
const rowsIn = (root: HTMLElement) =>
  within(root).queryAllByRole('button').filter((button) => !/^[✕×]$/.test(button.textContent ?? ''))
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
const closeButton = () => within(aside()).getByText('✕')
const removeDue = () => within(aside()).getByText('×')

type User = ReturnType<typeof userEvent.setup>
const rightClick = (user: User, element: HTMLElement) => user.pointer({ keys: '[MouseRight]', target: element })
const menuAction = async (user: User, element: HTMLElement, action: 'Rename' | 'Delete') => {
  await rightClick(user, element)
  await user.click(screen.getByText(action))
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
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Bread{Enter}')
  expect(tasks()).toEqual(['Bread', 'Milk', 'Eggs'])

  const stage = stageSelect('Bread')
  await user.selectOptions(stage, '✅')
  expect(stage).toHaveDisplayValue('✅')
  expect(tasks()).toEqual(['Milk', 'Eggs', 'Bread'])

  await user.selectOptions(stage, '⚡')
  expect(stage).toHaveDisplayValue('⚡')
  await user.selectOptions(stage, '⬜')
  expect(stage).toHaveDisplayValue('⬜')
})

test('open side panel, add and toggle a subtask', async () => {
  const { user } = setup()
  await user.click(screen.getByText('Milk'))
  expect(within(aside()).getByText('2% lactose free')).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Oat{Enter}')
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
  await user.click(screen.getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Oat{Enter}')
  expect(subtasks()).toEqual(['Oat', '2% lactose free'])

  await toggle(user, 'Oat', aside())
  expect(subtasks()).toEqual(['2% lactose free', 'Oat'])
})

test('rename, cancel rename and delete a task', async () => {
  const { user } = setup()
  await menuAction(user, screen.getByText('Eggs'), 'Rename')
  await user.keyboard('Ham{Enter}')
  expect(screen.getByText('Ham')).toBeInTheDocument()
  expect(screen.queryByText('Eggs')).not.toBeInTheDocument()

  await menuAction(user, screen.getByText('Ham'), 'Rename')
  await user.keyboard('Nope{Escape}')
  expect(screen.getByText('Ham')).toBeInTheDocument()
  expect(screen.queryByText('Nope')).not.toBeInTheDocument()

  await menuAction(user, screen.getByText('Ham'), 'Delete')
  expect(screen.queryByText('Ham')).not.toBeInTheDocument()
})

test('rename and delete a subtask', async () => {
  const { user } = setup()
  await user.click(screen.getByText('Milk'))

  await menuAction(user, within(aside()).getByText('2% lactose free'), 'Rename')
  await user.keyboard('Skim{Enter}')
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

  await menuAction(user, within(nav()).getByText('Fun'), 'Rename')
  await user.keyboard('Play{Enter}')
  expect(within(nav()).getByText('Play')).toBeInTheDocument()
  expect(within(nav()).queryByText('Fun')).not.toBeInTheDocument()

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
  expect(screen.getByRole('heading', { name: 'All' })).toBeInTheDocument()
  expect(tasks()).toHaveLength(5)
})

const allTexts = async (user: User) => {
  await user.click(within(nav()).getByText('All'))
  return tasks()
}

test('All view shows tasks from every list', async () => {
  const { user } = setup()
  expect(await allTexts(user)).toEqual(['Milk', 'Eggs', 'Reply to emails', 'Update docs', 'Review PR'])
})

test('an edit made in a list is reflected in All', async () => {
  const { user } = setup()
  await menuAction(user, screen.getByText('Milk'), 'Rename')
  await user.keyboard('Oat milk{Enter}')
  await user.selectOptions(stageSelect('Eggs'), '✅')
  await user.click(within(nav()).getByText('All'))
  expect(screen.getByText('Oat milk')).toBeInTheDocument()
  expect(stageSelect('Eggs')).toHaveDisplayValue('✅')
})

test('deleting a list keeps its tasks in All', async () => {
  const { user } = setup()
  await menuAction(user, within(nav()).getByText('Work'), 'Delete')
  expect(await allTexts(user)).toEqual(['Milk', 'Eggs', 'Reply to emails', 'Update docs', 'Review PR'])
})

test('adding in All creates a task visible only in All', async () => {
  const { user } = setup()
  await user.click(within(nav()).getByText('All'))
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Loose{Enter}')
  expect(tasks()[0]).toBe('Loose')
  for (const name of ['Groceries', 'Work', 'Home']) {
    await user.click(within(nav()).getByText(name))
    expect(screen.queryByText('Loose')).not.toBeInTheDocument()
  }
})

test('whitespace-only names are ignored', async () => {
  const { user } = setup()
  await user.type(screen.getByPlaceholderText(/add a task/i), '   {Enter}')
  expect(tasks()).toEqual(['Milk', 'Eggs'])

  await user.click(screen.getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/add a subtask/i), '   {Enter}')
  expect(subtasks()).toEqual(['2% lactose free'])

  await newList(user, '   ')
  expect(lists()).toEqual(['Groceries', 'Work', 'Home'])
})

test('new list, task and subtask land in the right place', async () => {
  const { user } = setup()

  await newList(user, 'Fun')
  expect(screen.getByRole('heading', { name: 'Fun' })).toBeInTheDocument()
  expect(lists()).toEqual(['Groceries', 'Work', 'Home', 'Fun'])
  expect(screen.queryByText('Milk')).not.toBeInTheDocument()
  expect(screen.queryByText('Eggs')).not.toBeInTheDocument()

  await user.click(within(nav()).getByText('Work'))
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Plan{Enter}')
  expect(tasks()[0]).toBe('Plan')

  await user.click(within(nav()).getByText('Groceries'))
  expect(tasks()).toEqual(['Milk', 'Eggs'])

  await user.click(screen.getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Oat{Enter}')
  expect(tasks()).toEqual(['Milk', 'Eggs'])
  expect(subtasks()).toEqual(['Oat', '2% lactose free'])

  await user.click(screen.getByText('Eggs'))
  expect(screen.queryByText('Oat')).not.toBeInTheDocument()
  expect(screen.queryByText('2% lactose free')).not.toBeInTheDocument()
})

describe('side panel closes', () => {
  test('via the close button', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Milk'))
    await user.click(closeButton())
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  test('when switching lists', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Milk'))
    await user.click(within(nav()).getByText('Work'))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  test('when the selected task is deleted', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Milk'))
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
    await user.click(screen.getByText('Milk'))
    result.milkSubs = subtasks()
    await user.click(screen.getByText('Eggs'))
    return result
  }

  test('task and subtask add, toggle, rename, delete leave the rest unchanged', async () => {
    const { user } = setup()
    const before = await snapshot(user)
    const order = lists()

    // Work tasks and Groceries subtasks untouched by Groceries task edits.
    await user.type(screen.getByPlaceholderText(/add a task/i), 'Bread{Enter}')
    await menuAction(user, screen.getByText('Bread'), 'Rename')
    await user.keyboard('Rye{Enter}')
    await menuAction(user, screen.getByText('Rye'), 'Delete')
    await user.click(screen.getByText('Milk'))
    expect(subtasks()).toEqual(before.milkSubs)
    await user.click(within(nav()).getByText('Work'))
    expect(tasks()).toEqual(before.Work)

    // Subtask edits leave sibling tasks and other tasks' subtasks untouched.
    await user.click(within(nav()).getByText('Groceries'))
    await user.click(screen.getByText('Milk'))
    await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Oat{Enter}')
    await toggle(user, 'Oat', aside())
    await menuAction(user, within(aside()).getByText('Oat'), 'Rename')
    await user.keyboard('Soy{Enter}')
    await menuAction(user, within(aside()).getByText('Soy'), 'Delete')
    expect(subtasks()).toEqual(before.milkSubs)
    expect(tasks()).toEqual(before.Groceries)
    await user.click(screen.getByText('Eggs'))
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
    await menuAction(user, within(nav()).getByText('Fun'), 'Rename')
    await user.keyboard('Play{Enter}')
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
  const openMilk = (user: User) => user.click(screen.getByText('Milk'))
  const dueLabel = dueInput

  test('sidebar sets and removes a due date, subtext shows on the task row', async () => {
    const { user } = setup()
    await openMilk(user)
    setDue('2000-01-01')
    expect(dueLabel()).toHaveValue('2000-01-01')
    expect(within(main()).getByText(/^Due /)).toBeInTheDocument()

    await user.click(removeDue())
    expect(dueLabel()).toHaveValue('')
    expect(within(main()).queryByText(/^Due /)).toBeNull()
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
    expect(within(row('2% lactose free', aside())).queryByText(/^Due /)).toBeNull()
  })

  test('context menu Due today sets today', async () => {
    const { user } = setup()
    await rightClick(user, screen.getByText('Milk'))
    await user.click(screen.getByText('Due today'))
    expect(screen.getByText('Due Today')).toBeInTheDocument()
  })

  test('task context menu has due options only for tasks', async () => {
    const { user } = setup()
    await rightClick(user, screen.getByText('Milk'))
    expect(screen.queryByText('Remove due date')).toBeNull()
    await user.click(screen.getByText('Due tomorrow'))
    expect(screen.getByText('Due Tomorrow')).toBeInTheDocument()

    await rightClick(user, screen.getByText('Milk'))
    expect(screen.getByText('Due next week')).toBeInTheDocument()
    await user.click(screen.getByText('Remove due date'))
    expect(within(main()).queryByText(/^Due /)).toBeNull()

    await user.click(screen.getByText('Milk'))
    await rightClick(user, screen.getByText('2% lactose free'))
    expect(screen.queryByText('Due tomorrow')).toBeNull()
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
    await rightClick(user, screen.getByText('Milk'))
    await user.click(screen.getByText('Set high priority'))
    expect(screen.getByText('🔴 High priority')).toBeInTheDocument()
    await rightClick(user, screen.getByText('Milk'))
    await user.click(screen.getByText('Set medium priority'))
    expect(screen.queryByText(/priority$/)).toBeNull()
  })

  test('subtasks show no priority', async () => {
    const { user } = setup()
    await pick(user, 'Medium', '🔴 High')
    expect(within(row('2% lactose free', aside())).queryByText(/priority$/)).toBeNull()
  })
})

describe('stage', () => {
  test('sidebar select sets stage, row select shows it, open clears it', async () => {
    const { user } = setup()
    const rowSelect = () => stageSelect('Milk')
    let prev = '⬜ Open'
    for (const [option, emoji] of [
      ['⚡ In progress', '⚡'],
      ['⏳ Waiting', '⏳'],
      ['✅ Done', '✅'],
      ['❌️ Cancelled', '❌️'],
    ]) {
      await pick(user, prev, option)
      expect(rowSelect()).toHaveDisplayValue(emoji)
      prev = option
    }
    await pick(user, prev, '⬜ Open')
    expect(rowSelect()).toHaveDisplayValue('⬜')
  })

  test('closing a task moves it right after the last open task', async () => {
    const { user } = setup()
    await user.click(within(nav()).getByText('Work'))
    await user.selectOptions(stageSelect('Review PR'), '✅')
    await user.selectOptions(stageSelect('Reply to emails'), '❌️')
    expect(tasks()).toEqual(['Update docs', 'Reply to emails', 'Review PR'])
  })

  test('reopening a task moves it to the bottom of the open section', async () => {
    const { user } = setup()
    await user.click(within(nav()).getByText('Work'))
    await user.selectOptions(stageSelect('Reply to emails'), '✅')
    await user.selectOptions(stageSelect('Update docs'), '✅')
    expect(tasks()).toEqual(['Review PR', 'Update docs', 'Reply to emails'])
    await user.selectOptions(stageSelect('Reply to emails'), '⚡')
    expect(tasks()).toEqual(['Review PR', 'Reply to emails', 'Update docs'])
  })

  test('switching from done to cancelled keeps position', async () => {
    const { user } = setup()
    await user.click(within(nav()).getByText('Work'))
    await user.selectOptions(stageSelect('Reply to emails'), '✅')
    await user.selectOptions(stageSelect('Update docs'), '✅')
    await user.selectOptions(stageSelect('Update docs'), '❌️')
    expect(tasks()).toEqual(['Review PR', 'Update docs', 'Reply to emails'])
  })

  test('context menu has no stage options', async () => {
    const { user } = setup()
    await rightClick(user, screen.getByText('Milk'))
    expect(screen.queryByText(/^Set (open|in progress|waiting|done|cancelled)$/)).toBeNull()
  })

  test('subtasks have no stage select', async () => {
    const { user } = setup()
    await pick(user, '⬜ Open', '⚡ In progress')
    expect(within(row('2% lactose free', aside())).queryByRole('combobox')).toBeNull()
  })
})

describe('task fields', () => {
  const setAll = async (user: User) => {
    await user.click(within(main()).getByText('Milk'))
    setDue('2000-01-01')
    await user.selectOptions(within(aside()).getByDisplayValue('⬜ Open'), '⚡ In progress')
    await user.selectOptions(within(aside()).getByDisplayValue('Medium'), '🔴 High')
  }

  test('remove due date button is hidden without a due date and clears it', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    expect(within(aside()).queryByText('×')).toBeNull()
    setDue('2000-01-01')
    await user.click(removeDue())
    expect(dueInput()).toHaveValue('')
    expect(within(main()).queryByText(/^Due /)).toBeNull()
  })

  test('row subtext order is count, due, priority', async () => {
    const { user } = setup()
    await setAll(user)
    expect(row('Milk')).toHaveTextContent(/0\/1.*Due Sat Jan 1.*🔴 High priority/)
  })

  test('fields survive rename', async () => {
    const { user } = setup()
    await setAll(user)
    await menuAction(user, within(main()).getByText('Milk'), 'Rename')
    await user.keyboard('Oat{Enter}')
    const oat = within(row('Oat'))
    expect(oat.getByText(/^Due /)).toBeInTheDocument()
    expect(oat.getByRole('combobox')).toHaveDisplayValue('⚡')
    expect(oat.getByText('🔴 High priority')).toBeInTheDocument()
  })

  test('sidebar shows the selected task own values', async () => {
    const { user } = setup()
    await setAll(user)
    await user.click(within(main()).getByText('Eggs'))
    expect(dueInput()).toHaveValue('')
    expect(aside()).toHaveTextContent('⬜ Open')
    expect(within(aside()).getByDisplayValue('Medium')).toBeInTheDocument()
  })

  test('subtask context menu has only Rename and Delete', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Milk'))
    await rightClick(user, screen.getByText('2% lactose free'))
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Due today')).toBeNull()
    expect(screen.queryByText('Set high priority')).toBeNull()
  })

  test('subtask toggle and delete leave a same-named task unchanged', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Eggs'))
    await user.click(within(main()).getByText('Milk'))
    await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Eggs{Enter}')
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
  await user.click(within(nav()).getByText('Today'))
  expect(tasks()).toEqual([])
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Now{Enter}')
  expect(tasks()).toEqual(['Now'])
  await user.click(within(nav()).getByText('All'))
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
  await user.click(within(nav()).getByText('Today'))
  const view = within(main())
  expect(view.getByText('Milk')).toBeInTheDocument()
  expect(view.getByText('Review PR')).toBeInTheDocument()
  expect(view.queryByText('Eggs')).toBeNull()
  expect(view.queryByText('Update docs')).toBeNull()
})

describe('sidebar counts', () => {
  test('shown, hidden at 0, and updated on add/delete', async () => {
    const { user } = setup()
    expect(nav()).toHaveTextContent(/^TodayAll5Groceries2Work3Home\+ New list$/)
    await user.type(screen.getByPlaceholderText(/add a task/i), 'Bread{Enter}')
    expect(nav()).toHaveTextContent(/^TodayAll6Groceries3Work3Home\+ New list$/)
    await menuAction(user, screen.getByText('Bread'), 'Delete')
    expect(nav()).toHaveTextContent(/^TodayAll5Groceries2Work3Home\+ New list$/)
  })
})
