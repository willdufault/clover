import * as fc from 'fast-check'
import { applyDrop, type ListsAndTasks } from '../../src/drop'
import { ALL_LIST_ID, TODAY_LIST_ID, tasksInList } from '../../src/smartLists'
import type { Step, Task } from '../../src/types'
import { makeTask } from './makeTask'

const makeStep = (id: string): Step => ({ id, taskId: '', title: id, completed: false })
const makeState = (): ListsAndTasks => ({
  lists: [
    { id: 'A', name: 'A' },
    { id: 'B', name: 'B' },
    { id: 'C', name: 'C' },
  ],
  tasks: [
    makeTask('a1', { listId: 'A', steps: [makeStep('s1'), makeStep('s2'), makeStep('s3')] }),
    makeTask('a2', { listId: 'A', steps: [makeStep('x1'), makeStep('x2')] }),
    makeTask('a3', { listId: 'A' }),
    makeTask('b1', { listId: 'B', steps: [makeStep('y1')] }),
    makeTask('b2', { listId: 'B' }),
    makeTask('c1', { listId: 'C', steps: [makeStep('z1')] }),
  ],
})
const baseDrop = { selectedListId: 'A', detailTask: undefined as Task | undefined }
const ids = (items: { id: string }[]) => items.map((item) => item.id)

test('reorder lists: only list order changes', () => {
  const result = applyDrop(makeState(), { ...baseDrop, activeId: 'A', overId: 'C' })
  expect(ids(result.lists)).toEqual(['B', 'C', 'A'])
  expect(result.tasks).toEqual(makeState().tasks)
})

test('reorder tasks in a list: other tasks untouched', () => {
  const result = applyDrop(makeState(), { ...baseDrop, activeId: 'a1', overId: 'a3' })
  expect(ids(result.tasks)).toEqual(['a2', 'a3', 'a1', 'b1', 'b2', 'c1'])
  expect(result.tasks.find((task) => task.id === 'a1')).toEqual(makeState().tasks[0])
  expect(result.lists).toEqual(makeState().lists)
})

test('reorder steps: task order and other tasks untouched', () => {
  const state = makeState()
  const result = applyDrop(state, { ...baseDrop, detailTask: state.tasks[0], activeId: 's1', overId: 's3' })
  const expected = makeState()
  expect(ids(result.tasks)).toEqual(ids(expected.tasks))
  const [task] = result.tasks
  if (!task) throw new Error('No task')
  expect(ids(task.steps)).toEqual(['s2', 's3', 's1'])
  expect(result.tasks.slice(1)).toEqual(expected.tasks.slice(1))
})

test('task dropped on its own list or on All is a no-op', () => {
  const state = makeState()
  expect(applyDrop(state, { ...baseDrop, activeId: 'a1', overId: 'A' })).toBe(state)
  expect(applyDrop(state, { ...baseDrop, activeId: 'a1', overId: 'all' })).toBe(state)
})

test('mismatched ids are no-ops', () => {
  const state = makeState()
  const expectNoop = (drop: Partial<Parameters<typeof applyDrop>[1]>) =>
    expect(
      applyDrop(state, { ...baseDrop, detailTask: state.tasks[0], activeId: 'a1', overId: 'a2', ...drop }),
    ).toEqual(makeState())
  expectNoop({ activeId: 's1', overId: 'a2' }) // step over task
  expectNoop({ activeId: 'a1', overId: 's1' }) // task over step
  expectNoop({ activeId: 's1', overId: 'x1' }) // step of another task
  expectNoop({ activeId: 'A', overId: 'a1' }) // list over task
  expectNoop({ activeId: 'b1', overId: 'a1' }) // task from unselected list
})

const stateArb = fc
  .record({
    listCount: fc.nat({ max: 4 }),
    tasks: fc.array(fc.record({ list: fc.nat(), addedToToday: fc.boolean(), stepCount: fc.nat({ max: 3 }) }), {
      maxLength: 6,
    }),
  })
  .map(({ listCount, tasks }): ListsAndTasks => ({
    lists: Array.from({ length: listCount }, (_, i) => ({ id: `L${i}`, name: `L${i}` })),
    tasks: tasks.map((task, i) =>
      makeTask(`T${i}`, {
        listId: listCount ? `L${task.list % listCount}` : null,
        addedToToday: task.addedToToday,
        steps: Array.from({ length: task.stepCount }, (_, j) => makeStep(`T${i}S${j}`)),
      }),
    ),
  }))

const caseArb = stateArb.chain((state) => {
  const listIds = ids(state.lists)
  const allIds = [...listIds, ...ids(state.tasks), ...state.tasks.flatMap((task) => ids(task.steps)), 'unknown']
  return fc.constantFrom(...listIds, ALL_LIST_ID, TODAY_LIST_ID, 'unknown').chain((selectedListId) =>
    fc.record({
      state: fc.constant(state),
      drop: fc.record({
        selectedListId: fc.constant(selectedListId),
        detailTask: fc.constantFrom(...tasksInList(state.tasks, selectedListId), undefined),
        activeId: fc.constantFrom(...allIds),
        overId: fc.constantFrom(...allIds),
      }),
    }),
  )
})

const has = (items: { id: string }[], id: string) => items.some((item) => item.id === id)
const sortedIds = (items: { id: string }[]) => ids(items).toSorted()
const stepIdsByTask = (state: ListsAndTasks) =>
  Object.fromEntries(state.tasks.map((task) => [task.id, sortedIds(task.steps)]))

test('property: no list, task, or step is lost or duplicated', () => {
  fc.assert(
    fc.property(caseArb, ({ state, drop }) => {
      const result = applyDrop(state, drop)
      expect(sortedIds(result.lists)).toEqual(sortedIds(state.lists))
      expect(sortedIds(result.tasks)).toEqual(sortedIds(state.tasks))
      expect(stepIdsByTask(result)).toEqual(stepIdsByTask(state))
    }),
  )
})

test('property: dropping an item on itself returns the same state', () => {
  fc.assert(
    fc.property(caseArb, ({ state, drop }) => {
      expect(applyDrop(state, { ...drop, overId: drop.activeId })).toBe(state)
    }),
  )
})

test('property: task fields other than step order are unchanged', () => {
  fc.assert(
    fc.property(caseArb, ({ state, drop }) => {
      for (const task of applyDrop(state, drop).tasks) {
        expect(task).toEqual({ ...state.tasks.find((original) => original.id === task.id), steps: task.steps })
      }
    }),
  )
})

test('property: drops outside lists, visible tasks, or detail steps return the same state', () => {
  fc.assert(
    fc.property(caseArb, ({ state, drop }) => {
      const both = (items: { id: string }[]) => has(items, drop.activeId) && has(items, drop.overId)
      const visible = tasksInList(state.tasks, drop.selectedListId)
      fc.pre(!both(state.lists) && !both(visible) && !(drop.detailTask && both(drop.detailTask.steps)))
      expect(applyDrop(state, drop)).toBe(state)
    }),
  )
})
