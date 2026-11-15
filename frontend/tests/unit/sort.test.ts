import { applySort, sortTasks } from '../../src/sort'
import type { Task } from '../../src/types'

const makeTask = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  text: id,
  steps: [],
  stage: 'open',
  priority: 'medium',
  ...patch,
})
const ids = (tasks: Task[]) => tasks.map((task) => task.id)

test('sorts by stage order', () => {
  const tasks = [
    makeTask('cancelled', { stage: 'cancelled' }),
    makeTask('done', { stage: 'done' }),
    makeTask('waiting', { stage: 'waiting' }),
    makeTask('progress', { stage: 'inProgress' }),
    makeTask('open'),
  ]
  expect(ids(sortTasks(tasks, 'stage'))).toEqual(['open', 'progress', 'waiting', 'done', 'cancelled'])
})

test('sorts by due date, earliest first, undated last', () => {
  const tasks = [
    makeTask('none'),
    makeTask('late', { due: '2026-03-01' }),
    makeTask('early', { due: '2026-01-01' }),
  ]
  expect(ids(sortTasks(tasks, 'due'))).toEqual(['early', 'late', 'none'])
})

test('sorts by priority, high first', () => {
  const tasks = [
    makeTask('low', { priority: 'low' }),
    makeTask('high', { priority: 'high' }),
    makeTask('medium'),
  ]
  expect(ids(sortTasks(tasks, 'priority'))).toEqual(['high', 'medium', 'low'])
})

test('ties keep their current order', () => {
  const tasks = [makeTask('a'), makeTask('b'), makeTask('c')]
  expect(ids(sortTasks(tasks, 'stage'))).toEqual(['a', 'b', 'c'])
})

test('applySort reuses the slots the visible tasks occupied', () => {
  const [a, x, b, y, c] = [
    makeTask('a', { priority: 'low' }),
    makeTask('x'),
    makeTask('b', { priority: 'high' }),
    makeTask('y'),
    makeTask('c'),
  ]
  expect(ids(applySort([a, x, b, y, c], [a, b, c], 'priority'))).toEqual(['b', 'x', 'c', 'y', 'a'])
})
