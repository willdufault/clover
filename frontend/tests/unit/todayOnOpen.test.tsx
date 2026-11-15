import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { today } from '../../src/dates'

vi.mock('../../src/seed', () => ({
  SEED_LISTS: [{ id: 'work', name: 'Work' }],
  SEED_TASKS: [
    { id: 'a', text: 'Due today', stage: 'open', priority: 'medium', listId: 'work', steps: [], due: today() },
    { id: 'b', text: 'Overdue', stage: 'open', priority: 'medium', listId: 'work', steps: [], due: '2000-01-01' },
  ],
}))

test('tasks due today start in Today on open, overdue ones do not', async () => {
  const { default: App } = await import('../../src/App')
  render(<App />)
  await userEvent.click(within(screen.getByRole('navigation')).getByText('☀️ Today'))
  const main = within(screen.getByRole('main'))
  expect(main.getByText('Due today')).toBeInTheDocument()
  expect(main.queryByText('Overdue')).toBeNull()
})
