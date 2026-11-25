import { sortTasks } from '../../src/sort'
import type { Task } from '../../src/types'
import { makeTask } from './makeTask'

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
  const tasks = [makeTask('none'), makeTask('late', { due: '2026-03-01' }), makeTask('early', { due: '2026-01-01' })]
  expect(ids(sortTasks(tasks, 'due'))).toEqual(['early', 'late', 'none'])
})

test('sorts by priority, high first', () => {
  const tasks = [makeTask('low', { priority: 'low' }), makeTask('high', { priority: 'high' }), makeTask('medium')]
  expect(ids(sortTasks(tasks, 'priority'))).toEqual(['high', 'medium', 'low'])
})

test('done and cancelled tasks sink to the bottom', () => {
  const tasks = [
    makeTask('done', { stage: 'done', priority: 'high' }),
    makeTask('low', { priority: 'low' }),
    makeTask('cancelled', { stage: 'cancelled', priority: 'low' }),
    makeTask('high', { priority: 'high' }),
  ]
  expect(ids(sortTasks(tasks, 'priority'))).toEqual(['high', 'low', 'done', 'cancelled'])
})

test('no sort shows the newest task first', () => {
  const tasks = [makeTask('old'), makeTask('mid'), makeTask('new')]
  expect(ids(sortTasks(tasks, null))).toEqual(['new', 'mid', 'old'])
})

test('ties keep their current order', () => {
  const tasks = [makeTask('a'), makeTask('b'), makeTask('c')]
  expect(ids(sortTasks(tasks, 'stage'))).toEqual(['a', 'b', 'c'])
})
