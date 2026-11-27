import * as fc from 'fast-check'
import { byOrder, nextOrder, sortTasks } from '../../src/sort'
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

test('ties keep the unsorted order, newest first', () => {
  const tasks = [makeTask('old'), makeTask('mid'), makeTask('new')]
  expect(ids(sortTasks(tasks, 'stage'))).toEqual(['new', 'mid', 'old'])
})

test('property: byOrder sorts ascending, keeps every item, and keeps equal orders in place', () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: -3, max: 3 })), (orders) => {
      const items = orders.map((order, i) => ({ id: i, order }))
      const sorted = byOrder(items)
      expect(sorted.toSorted((a, b) => a.id - b.id)).toEqual(items)
      sorted.slice(1).forEach((item, i) => {
        const prev = sorted[i]
        if (!prev) throw new Error('No item')
        expect(prev.order < item.order || (prev.order === item.order && prev.id < item.id)).toBe(true)
      })
    }),
  )
})

test('nextOrder is one above the highest order, or 0 when empty', () => {
  expect(nextOrder([])).toBe(0)
  expect(nextOrder([{ order: -4 }, { order: 2 }, { order: 1 }])).toBe(3)
})
