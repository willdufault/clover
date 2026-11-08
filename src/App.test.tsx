import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const setup = () => ({ user: userEvent.setup(), ...render(<App />) })
const texts = (root: HTMLElement = document.body) =>
  [...root.querySelectorAll('li')].map((li) => li.textContent!.replace(/^(?:[⬜⚡⏳✅❌]|\uFE0F)+/, ''))
const nav = () => screen.getByRole('navigation')
const aside = () => screen.getByRole('complementary')

type User = ReturnType<typeof userEvent.setup>
const rightClick = (user: User, el: HTMLElement) => user.pointer({ keys: '[MouseRight]', target: el })
const menuAction = async (user: User, el: HTMLElement, action: 'Rename' | 'Delete') => {
  await rightClick(user, el)
  await user.click(screen.getByText(action))
}
const newList = async (user: User, name: string) => {
  await user.click(screen.getByText('+ New list'))
  await user.type(screen.getByPlaceholderText('List name…'), `${name}{Enter}`)
}
const toggle = (user: User, text: string, root: { getByText: typeof screen.getByText } = screen) =>
  user.click(within(root.getByText(text).closest('li')!).getByRole('checkbox'))

test('add a task and set its stage from the row', async () => {
  const { user } = setup()
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Bread{Enter}')
  expect(texts()).toEqual(['Bread', 'Milk', 'Eggs'])

  const row = within(screen.getByText('Bread').closest('li')!)
  await user.selectOptions(row.getByLabelText('Task stage'), 'done')
  expect(screen.getByText('Bread')).toHaveClass('text-gray-400', 'line-through')
  expect(texts()).toEqual(['Bread', 'Milk', 'Eggs'])

  await user.selectOptions(row.getByLabelText('Task stage'), 'cancelled')
  expect(screen.getByText('Bread')).toHaveClass('line-through')

  await user.selectOptions(row.getByLabelText('Task stage'), 'progress')
  expect(screen.getByText('Bread')).not.toHaveClass('line-through')
  await user.selectOptions(row.getByLabelText('Task stage'), '')
  expect(row.getByLabelText('Task stage')).toHaveValue('')
})

test('open side panel, add and toggle a subtask', async () => {
  const { user } = setup()
  await user.click(screen.getByText('Milk'))
  expect(within(aside()).getByText('2% lactose free')).toBeInTheDocument()

  await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Oat{Enter}')
  expect(within(aside()).getByText('Oat')).toBeInTheDocument()
  expect(within(screen.getByRole('main')).queryByText('Oat')).not.toBeInTheDocument()

  const sub = within(aside()).getByText('Oat').closest('li')!
  await user.click(within(sub).getByRole('checkbox'))
  expect(within(sub).getByRole('checkbox')).toBeChecked()
})

test('toggling a subtask moves it below open ones', async () => {
  const { user } = setup()
  await user.click(screen.getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Oat{Enter}')
  expect(texts(aside())).toEqual(['Oat', '2% lactose free'])

  await toggle(user, 'Oat')
  expect(texts(aside())).toEqual(['2% lactose free', 'Oat'])
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
  expect(texts(aside())).toEqual(['Skim'])

  await menuAction(user, within(aside()).getByText('Skim'), 'Delete')
  expect(texts(aside())).toEqual([])
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

test('deleting the last list shows an empty state', async () => {
  const { user } = setup()
  for (const name of ['Groceries', 'Work', 'Home']) {
    await menuAction(user, within(nav()).getByText(name), 'Delete')
  }
  expect(screen.getByText(/No lists yet/)).toBeInTheDocument()
})

test('whitespace-only names are ignored', async () => {
  const { user } = setup()
  await user.type(screen.getByPlaceholderText(/add a task/i), '   {Enter}')
  expect(texts()).toEqual(['Milk', 'Eggs'])

  await user.click(screen.getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/add a subtask/i), '   {Enter}')
  expect(texts(aside())).toEqual(['2% lactose free'])

  await newList(user, '   ')
  expect(nav().textContent).toBe('GroceriesWorkHome+ New list')
})

test('new list, task and subtask land in the right place', async () => {
  const { user } = setup()

  await newList(user, 'Fun')
  expect(screen.getByRole('heading', { name: 'Fun' })).toBeInTheDocument()
  expect(nav().textContent).toBe('GroceriesWorkHomeFun+ New list')
  expect(screen.queryByText('Milk')).not.toBeInTheDocument()
  expect(screen.queryByText('Eggs')).not.toBeInTheDocument()

  await user.click(within(nav()).getByText('Work'))
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Plan{Enter}')
  expect(texts()[0]).toBe('Plan')

  await user.click(within(nav()).getByText('Groceries'))
  expect(texts()).toEqual(['Milk', 'Eggs'])

  await user.click(screen.getByText('Milk'))
  await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Oat{Enter}')
  expect(texts(screen.getByRole('main'))).toEqual(['Milk', 'Eggs'])
  expect(texts(aside())).toEqual(['Oat', '2% lactose free'])

  await user.click(screen.getByText('Eggs'))
  expect(screen.queryByText('Oat')).not.toBeInTheDocument()
  expect(screen.queryByText('2% lactose free')).not.toBeInTheDocument()
})

describe('side panel closes', () => {
  test('via the close button', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Milk'))
    await user.click(screen.getByLabelText('Close panel'))
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
    const out: Record<string, (string | null)[]> = {}
    for (const name of ['Groceries', 'Work', 'Home']) {
      await user.click(within(nav()).getByText(name))
      out[name] = texts(screen.getByRole('main'))
    }
    await user.click(within(nav()).getByText('Groceries'))
    await user.click(screen.getByText('Milk'))
    out.milkSubs = texts(aside())
    await user.click(screen.getByText('Eggs'))
    return out
  }

  test('task and subtask add, toggle, rename, delete leave the rest unchanged', async () => {
    const { user } = setup()
    const before = await snapshot(user)
    const order = nav().textContent

    // Work tasks and Groceries subtasks untouched by Groceries task edits.
    await user.type(screen.getByPlaceholderText(/add a task/i), 'Bread{Enter}')
    await menuAction(user, screen.getByText('Bread'), 'Rename')
    await user.keyboard('Rye{Enter}')
    await menuAction(user, screen.getByText('Rye'), 'Delete')
    await user.click(screen.getByText('Milk'))
    expect(texts(aside())).toEqual(before.milkSubs)
    await user.click(within(nav()).getByText('Work'))
    expect(texts(screen.getByRole('main'))).toEqual(before.Work)

    // Subtask edits leave sibling tasks and other tasks' subtasks untouched.
    await user.click(within(nav()).getByText('Groceries'))
    await user.click(screen.getByText('Milk'))
    await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Oat{Enter}')
    await toggle(user, 'Oat')
    await menuAction(user, within(aside()).getByText('Oat'), 'Rename')
    await user.keyboard('Soy{Enter}')
    await menuAction(user, within(aside()).getByText('Soy'), 'Delete')
    expect(texts(aside())).toEqual(before.milkSubs)
    expect(texts(screen.getByRole('main'))).toEqual(before.Groceries)
    await user.click(screen.getByText('Eggs'))
    expect(texts(aside())).toEqual([])
    expect(nav().textContent).toBe(order)
    for (const name of ['Work', 'Home']) {
      await user.click(within(nav()).getByText(name))
      expect(texts(screen.getByRole('main'))).toEqual(before[name])
    }
  })

  test('list add, rename, delete keep other lists and their tasks', async () => {
    const { user } = setup()
    await newList(user, 'Fun')
    await menuAction(user, within(nav()).getByText('Fun'), 'Rename')
    await user.keyboard('Play{Enter}')
    expect(nav().textContent).toBe('GroceriesWorkHomePlay+ New list')
    await menuAction(user, within(nav()).getByText('Play'), 'Delete')
    expect(nav().textContent).toBe('GroceriesWorkHome+ New list')
    await user.click(within(nav()).getByText('Work'))
    expect(texts(screen.getByRole('main'))).toEqual(['Reply to emails', 'Update docs', 'Review PR'])
    await user.click(within(nav()).getByText('Groceries'))
    expect(texts(screen.getByRole('main'))).toEqual(['Milk', 'Eggs'])
  })
})

describe('due dates', () => {
  const setDate = async (user: User, value: string) => {
    await user.click(screen.getByText('Milk'))
    fireEvent.change(within(aside()).getByLabelText('Due date'), { target: { value } })
  }

  test('sidebar sets and removes a due date, subtext shows on the task row', async () => {
    const { user } = setup()
    await setDate(user, '2000-01-01')
    expect(within(aside()).getByLabelText('Due date')).toHaveValue('2000-01-01')
    expect(within(screen.getByRole('main')).getByText(/^Due /)).toBeInTheDocument()

    await user.click(within(aside()).getByRole('button', { name: 'Remove due date' }))
    expect(within(aside()).getByLabelText('Due date')).toHaveValue('')
    expect(screen.queryByText(/^Due (?!date$)/)).toBeNull()
  })

  test('subtasks show no due subtext', async () => {
    const { user } = setup()
    await setDate(user, '2000-01-01')
    expect(within(screen.getByText('2% lactose free').closest('li')!).queryByText(/^Due /)).toBeNull()
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
    expect(screen.getByText('Due next Monday')).toBeInTheDocument()
    expect(screen.getByText('Remove due date')).toBeInTheDocument()
    await user.click(screen.getByText('Remove due date'))
    expect(screen.queryByText(/^Due (?!date$)/)).toBeNull()

    await user.click(screen.getByText('Milk'))
    await rightClick(user, screen.getByText('2% lactose free'))
    expect(screen.queryByText('Due tomorrow')).toBeNull()
  })
})

describe('priority', () => {
  const setPriority = async (user: User, value: string) => {
    await user.click(within(screen.getByRole('main')).getByText('Milk'))
    await user.selectOptions(within(aside()).getByLabelText('Priority'), value)
  }

  test('sidebar select sets priority, row shows it, medium clears it', async () => {
    const { user } = setup()
    await setPriority(user, 'high')
    expect(within(screen.getByRole('main')).getByText('🔴 High priority')).toBeInTheDocument()
    await setPriority(user, 'low')
    expect(within(screen.getByRole('main')).getByText('🔵 Low priority')).toBeInTheDocument()
    await setPriority(user, 'Medium')
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
    await setPriority(user, 'high')
    expect(within(screen.getByText('2% lactose free').closest('li')!).queryByText(/priority$/)).toBeNull()
  })
})

describe('stage', () => {
  const setStage = async (user: User, value: string) => {
    await user.click(within(screen.getByRole('main')).getByText('Milk'))
    await user.selectOptions(within(aside()).getByLabelText('Stage'), value)
  }

  test('sidebar select sets stage, row select shows it, open clears it', async () => {
    const { user } = setup()
    const rowSelect = () => within(within(screen.getByRole('main')).getByText('Milk').closest('li')!).getByLabelText('Task stage')
    for (const v of ['progress', 'waiting', 'done', 'cancelled']) {
      await setStage(user, v)
      expect(rowSelect()).toHaveValue(v)
    }
    await setStage(user, 'Open')
    expect(rowSelect()).toHaveValue('')
  })

  test('context menu has no stage options', async () => {
    const { user } = setup()
    await rightClick(user, screen.getByText('Milk'))
    expect(screen.queryByText(/^Set (open|in progress|waiting|done|cancelled)$/)).toBeNull()
  })

  test('subtasks have no stage select', async () => {
    const { user } = setup()
    await setStage(user, 'progress')
    expect(within(screen.getByText('2% lactose free').closest('li')!).queryByLabelText('Task stage')).toBeNull()
  })
})

describe('task fields', () => {
  const main = () => screen.getByRole('main')
  const setDate = (value: string) =>
    fireEvent.change(within(aside()).getByLabelText('Due date'), { target: { value } })
  const setAll = async (user: User) => {
    await user.click(within(main()).getByText('Milk'))
    setDate('2000-01-01')
    await user.selectOptions(within(aside()).getByLabelText('Stage'), 'progress')
    await user.selectOptions(within(aside()).getByLabelText('Priority'), 'high')
  }
  const rowSub = (text: string) => within(within(main()).getByText(text).closest('li')!)

  test('overdue due date is red, future is not', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    setDate('2000-01-01')
    expect(within(main()).getByText(/^Due /)).toHaveClass('text-red-600')
    setDate('2999-01-01')
    const future = within(main()).getByText(/^Due /)
    expect(future.className).not.toMatch(/text-red-/)
  })

  test('remove due date button is hidden without a due date and clears it', async () => {
    const { user } = setup()
    await user.click(within(main()).getByText('Milk'))
    expect(within(aside()).queryByRole('button', { name: 'Remove due date' })).toBeNull()
    setDate('2000-01-01')
    await user.click(within(aside()).getByRole('button', { name: 'Remove due date' }))
    expect(within(aside()).getByLabelText('Due date')).toHaveValue('')
    expect(within(main()).queryByText(/^Due /)).toBeNull()
  })

  test('row subtext order is due, priority', async () => {
    const { user } = setup()
    await setAll(user)
    const spans = [...within(main()).getByText('Milk').nextElementSibling!.children].map((e) => e.textContent)
    expect(spans).toEqual(['Due Sat Jan 1', '🔴 High priority'])
  })

  test('fields survive rename', async () => {
    const { user } = setup()
    await setAll(user)
    await menuAction(user, within(main()).getByText('Milk'), 'Rename')
    await user.keyboard('Oat{Enter}')
    const row = rowSub('Oat')
    expect(row.getByText(/^Due /)).toBeInTheDocument()
    expect(row.getByLabelText('Task stage')).toHaveValue('progress')
    expect(row.getByText('🔴 High priority')).toBeInTheDocument()
  })

  test('sidebar shows the selected task own values', async () => {
    const { user } = setup()
    await setAll(user)
    await user.click(within(main()).getByText('Eggs'))
    expect(within(aside()).getByLabelText('Due date')).toHaveValue('')
    expect(within(aside()).getByLabelText('Stage')).toHaveValue('')
    expect(within(aside()).getByLabelText('Priority')).toHaveValue('')
    expect(within(aside()).getByRole('option', { name: 'Open', selected: true })).toBeInTheDocument()
    expect(within(aside()).getByRole('option', { name: 'Medium', selected: true })).toBeInTheDocument()
  })

  test('subtask context menu has only Rename and Delete', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Milk'))
    await rightClick(user, screen.getByText('2% lactose free'))
    expect(screen.getByText('Rename').parentElement!.querySelectorAll('button, hr')).toHaveLength(2)
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  test('subtask toggle and delete leave a same-named task unchanged', async () => {
    const { user } = setup()
    await user.click(screen.getByText('Eggs'))
    await user.click(within(main()).getByText('Milk'))
    await user.type(screen.getByPlaceholderText(/add a subtask/i), 'Eggs{Enter}')
    const before = texts(main())
    await toggle(user, 'Eggs', within(aside()))
    expect(texts(main())).toEqual(before)
    await menuAction(user, within(aside()).getByText('Eggs'), 'Delete')
    expect(texts(main())).toEqual(before)
    expect(within(aside()).queryByText('Eggs')).toBeNull()
  })
})
