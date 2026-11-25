import * as fc from 'fast-check'
import { PRIORITIES, STAGES } from '../../src/labels'
import { applySort, type SortCriteria, sortTasks } from '../../src/sort'
import type { Task } from '../../src/types'
import { makeTask } from './makeTask'

const ids = (tasks: Task[]) => tasks.map((task) => task.id)
const asc = (criteria: SortCriteria) => ({ criteria, descending: false })

test('sorts by stage order', () => {
  const tasks = [
    makeTask('cancelled', { stage: 'cancelled' }),
    makeTask('done', { stage: 'done' }),
    makeTask('waiting', { stage: 'waiting' }),
    makeTask('progress', { stage: 'inProgress' }),
    makeTask('open'),
  ]
  expect(ids(sortTasks(tasks, asc('stage')))).toEqual(['open', 'progress', 'waiting', 'done', 'cancelled'])
})

test('sorts by due date, earliest first, undated last', () => {
  const tasks = [makeTask('none'), makeTask('late', { due: '2026-03-01' }), makeTask('early', { due: '2026-01-01' })]
  expect(ids(sortTasks(tasks, asc('due')))).toEqual(['early', 'late', 'none'])
})

test('sorts by priority, high first', () => {
  const tasks = [makeTask('low', { priority: 'low' }), makeTask('high', { priority: 'high' }), makeTask('medium')]
  expect(ids(sortTasks(tasks, asc('priority')))).toEqual(['high', 'medium', 'low'])
})

test('descending reverses the order', () => {
  const tasks = [makeTask('low', { priority: 'low' }), makeTask('high', { priority: 'high' }), makeTask('medium')]
  expect(ids(sortTasks(tasks, { criteria: 'priority', descending: true }))).toEqual(['low', 'medium', 'high'])
})

test('done and cancelled tasks sink to the bottom in either direction', () => {
  const tasks = [
    makeTask('done', { stage: 'done', priority: 'high' }),
    makeTask('low', { priority: 'low' }),
    makeTask('cancelled', { stage: 'cancelled', priority: 'low' }),
    makeTask('high', { priority: 'high' }),
  ]
  expect(ids(sortTasks(tasks, asc('priority')))).toEqual(['high', 'low', 'done', 'cancelled'])
  expect(ids(sortTasks(tasks, { criteria: 'priority', descending: true }))).toEqual([
    'low',
    'high',
    'cancelled',
    'done',
  ])
  expect(
    ids(sortTasks(tasks, { criteria: 'stage', descending: true }))
      .slice(2)
      .toSorted(),
  ).toEqual(['cancelled', 'done'])
})

test('manual order shows the newest task first', () => {
  const tasks = [makeTask('old'), makeTask('mid'), makeTask('new')]
  expect(ids(sortTasks(tasks, null))).toEqual(['new', 'mid', 'old'])
})

test('ties keep their current order', () => {
  const tasks = [makeTask('a'), makeTask('b'), makeTask('c')]
  expect(ids(sortTasks(tasks, asc('stage')))).toEqual(['a', 'b', 'c'])
})

test('applySort reuses the slots the visible tasks occupied', () => {
  const [a, x, b, y, c] = [
    makeTask('a', { priority: 'low' }),
    makeTask('x'),
    makeTask('b', { priority: 'high' }),
    makeTask('y'),
    makeTask('c'),
  ]
  expect(ids(applySort([a, x, b, y, c], [a, b, c], asc('priority')))).toEqual(['a', 'x', 'c', 'y', 'b'])
})

const criteriaArb = fc.constantFrom<SortCriteria>('stage', 'due', 'priority')

const tasksArb = fc
  .array(
    fc.tuple(
      fc.record({
        stage: fc.constantFrom(...STAGES),
        priority: fc.constantFrom(...PRIORITIES),
        due: fc.constantFrom(null, '2026-01-01', '2026-02-15', '2026-12-31'),
      }),
      fc.boolean(),
    ),
  )
  .map((specs) => {
    const pairs = specs.map(([patch, isVisible], i) => ({ task: makeTask(`t${i}`, patch), isVisible }))
    return {
      all: pairs.map(({ task }) => task),
      visible: pairs.filter(({ isVisible }) => isVisible).map(({ task }) => task),
    }
  })

test('applySort returns a permutation of all tasks', () => {
  fc.assert(
    fc.property(tasksArb, criteriaArb, ({ all, visible }, criteria) => {
      const result = applySort(all, visible, asc(criteria))
      expect(ids(result).toSorted()).toEqual(ids(all).toSorted())
    }),
  )
})

test('applySort keeps hidden tasks at their index', () => {
  fc.assert(
    fc.property(tasksArb, criteriaArb, ({ all, visible }, criteria) => {
      const result = applySort(all, visible, asc(criteria))
      const hidden = (tasks: Task[]) => tasks.map((task, i) => (visible.includes(all[i] ?? task) ? null : task))
      expect(hidden(result)).toEqual(hidden(all))
    }),
  )
})

test('applySort keeps the sorted view once the sort is cleared', () => {
  fc.assert(
    fc.property(tasksArb, criteriaArb, ({ all, visible }, criteria) => {
      const result = applySort(all, visible, asc(criteria))
      const slots = result.filter((task) => visible.includes(task))
      expect(sortTasks(slots, null)).toEqual(sortTasks(visible, asc(criteria)))
    }),
  )
})
