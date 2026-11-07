import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const setup = () => ({ user: userEvent.setup(), ...render(<App />) })
const texts = (root: HTMLElement = document.body) =>
  [...root.querySelectorAll('li')].map((li) => li.textContent)
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
const toggle = (user: User, text: string) =>
  user.click(within(screen.getByText(text).closest('li')!).getByRole('checkbox'))

test('add a task and toggle it done and back', async () => {
  const { user } = setup()
  await user.type(screen.getByPlaceholderText(/add a task/i), 'Bread{Enter}')
  expect(texts()).toEqual(['Bread', 'Milk', 'Eggs'])

  await toggle(user, 'Bread')
  expect(texts()).toEqual(['Milk', 'Eggs', 'Bread'])

  await toggle(user, 'Milk')
  expect(texts()).toEqual(['Eggs', 'Milk', 'Bread'])

  await toggle(user, 'Bread')
  expect(texts()).toEqual(['Eggs', 'Bread', 'Milk'])
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
    await toggle(user, 'Bread')
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
