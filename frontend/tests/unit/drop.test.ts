import * as fc from 'fast-check'
import { applyDrop, idsToMove, type ListsAndTasks } from '../../src/drop'
import { ALL_LIST_ID, TODAY_LIST_ID, tasksInList } from '../../src/smartLists'
import { sortTasks } from '../../src/sort'
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
const baseDrop = { selectedListId: 'A', detailTask: undefined as Task | undefined, after: true }
const ids = (items: { id: string }[]) => items.map((item) => item.id)

const shown = (state: ListsAndTasks) => ids(sortTasks(tasksInList(state.tasks, 'A'), null))

test('reorder lists: only list order changes', () => {
  const result = applyDrop(makeState(), { ...baseDrop, activeId: 'A', overId: 'C' })
  expect(ids(result.lists)).toEqual(['B', 'C', 'A'])
  expect(result.tasks).toEqual(makeState().tasks)
  expect(ids(applyDrop(makeState(), { ...baseDrop, activeId: 'A', overId: 'C', after: false }).lists)).toEqual([
    'B',
    'A',
    'C',
  ])
})

test('dropping next to the original spot keeps the order', () => {
  const state = makeState()
  expect(ids(applyDrop(state, { ...baseDrop, activeId: 'B', overId: 'A' }).lists)).toEqual(['A', 'B', 'C'])
  expect(ids(applyDrop(state, { ...baseDrop, activeId: 'B', overId: 'C', after: false }).lists)).toEqual([
    'A',
    'B',
    'C',
  ])
  expect(shown(applyDrop(state, { ...baseDrop, activeId: 'a2', overId: 'a3' }))).toEqual(['a3', 'a2', 'a1'])
  expect(shown(applyDrop(state, { ...baseDrop, activeId: 'a2', overId: 'a1', after: false }))).toEqual([
    'a3',
    'a2',
    'a1',
  ])
})

test('reorder tasks in a list: other tasks untouched', () => {
  const result = applyDrop(makeState(), { ...baseDrop, activeId: 'a1', overId: 'a3', after: false })
  expect(ids(result.tasks)).toEqual(['a2', 'a3', 'a1', 'b1', 'b2', 'c1'])
  expect(result.tasks.find((task) => task.id === 'a1')).toEqual(makeState().tasks[0])
  expect(result.lists).toEqual(makeState().lists)
})

test('a task dropped in the newest-first view lands where it was dropped', () => {
  expect(shown(makeState())).toEqual(['a3', 'a2', 'a1'])
  const down = applyDrop(makeState(), { ...baseDrop, activeId: 'a3', overId: 'a1' })
  expect(shown(down)).toEqual(['a2', 'a1', 'a3'])
  const up = applyDrop(makeState(), { ...baseDrop, activeId: 'a1', overId: 'a2', after: false })
  expect(shown(up)).toEqual(['a3', 'a1', 'a2'])
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
  expectNoop({ activeId: 's1', overId: 'a2' })
  expectNoop({ activeId: 'a1', overId: 's1' })
  expectNoop({ activeId: 's1', overId: 'x1' })
  expectNoop({ activeId: 'A', overId: 'a1' })
  expectNoop({ activeId: 'b1', overId: 'a1' })
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
        after: fc.boolean(),
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

const orderArb = fc.integer({ min: 2, max: 8 }).chain((count) =>
  fc.record({
    order: fc.constant(Array.from({ length: count }, (_, i) => `L${i}`)),
    from: fc.nat({ max: count - 1 }),
    over: fc.nat({ max: count - 1 }),
    after: fc.boolean(),
  }),
)
const listState = (order: string[]): ListsAndTasks => ({ lists: order.map((id) => ({ id, name: id })), tasks: [] })
const taskState = (order: string[]): ListsAndTasks => ({
  lists: [{ id: 'A', name: 'A' }],
  tasks: order.toReversed().map((id) => makeTask(id, { listId: 'A' })),
})
const views = [
  [listState, (state: ListsAndTasks) => ids(state.lists)],
  [taskState, shown],
] as const

test('property: dropping into the original gap leaves the order unchanged', () => {
  fc.assert(
    fc.property(orderArb, ({ order, from, after }) => {
      const overIndex = after ? from - 1 : from + 1
      fc.pre(overIndex >= 0 && overIndex < order.length)
      for (const [build, view] of views) {
        const drop = { ...baseDrop, activeId: order[from] ?? '', overId: order[overIndex] ?? '', after }
        expect(view(applyDrop(build(order), drop))).toEqual(order)
      }
    }),
  )
})

test('property: a drop lands before or after the hovered item and keeps the others in order', () => {
  fc.assert(
    fc.property(orderArb, ({ order, from, over, after }) => {
      fc.pre(from !== over)
      const activeId = order[from] ?? ''
      const overId = order[over] ?? ''
      for (const [build, view] of views) {
        const result = view(applyDrop(build(order), { ...baseDrop, activeId, overId, after }))
        expect(result.indexOf(activeId)).toBe(result.indexOf(overId) + (after ? 1 : -1))
        expect(result.filter((id) => id !== activeId)).toEqual(order.filter((id) => id !== activeId))
      }
    }),
  )
})

const fiveState = () => taskState(['t0', 't1', 't2', 't3', 't4'])
const multiDrop = (dragIds: string[], overId: string, after: boolean) =>
  shown(applyDrop(fiveState(), { ...baseDrop, activeId: dragIds[0] ?? '', dragIds, overId, after }))

test('dragging several tasks moves them together in their shown order', () => {
  expect(multiDrop(['t3', 't1'], 't0', false)).toEqual(['t1', 't3', 't0', 't2', 't4'])
  expect(multiDrop(['t1', 't3'], 't4', true)).toEqual(['t0', 't2', 't4', 't1', 't3'])
  expect(multiDrop(['t0', 't4'], 't2', true)).toEqual(['t1', 't2', 't0', 't4', 't3'])
  expect(multiDrop(['t0', 't4'], 't2', false)).toEqual(['t1', 't0', 't4', 't2', 't3'])
})

test('dropping several tasks on one of themselves is a no-op', () => {
  expect(multiDrop(['t1', 't3'], 't3', true)).toEqual(['t0', 't1', 't2', 't3', 't4'])
})

const multiArb = fc.integer({ min: 2, max: 8 }).chain((count) =>
  fc.record({
    order: fc.constant(Array.from({ length: count }, (_, i) => `T${i}`)),
    picks: fc.uniqueArray(fc.nat({ max: count - 1 }), { minLength: 1, maxLength: count }),
    over: fc.nat({ max: count - 1 }),
    after: fc.boolean(),
  }),
)

test('property: dragged tasks land as one block next to the hovered task in their shown order', () => {
  fc.assert(
    fc.property(multiArb, ({ order, picks, over, after }) => {
      const dragIds = picks.map((i) => order[i] ?? '')
      const overId = order[over] ?? ''
      const activeId = dragIds[0] ?? ''
      fc.pre(!dragIds.includes(overId))
      const result = shown(applyDrop(taskState(order), { ...baseDrop, activeId, dragIds, overId, after }))
      expect(result.toSorted()).toEqual(order.toSorted())
      const moved = order.filter((id) => dragIds.includes(id))
      const start = result.indexOf(overId) + (after ? 1 : -moved.length)
      expect(result.slice(start, start + moved.length)).toEqual(moved)
      expect(result.filter((id) => !dragIds.includes(id))).toEqual(order.filter((id) => !dragIds.includes(id)))
    }),
  )
})

test('property: dropping dragged tasks on one of themselves is a no-op', () => {
  fc.assert(
    fc.property(multiArb, ({ order, picks, after }) => {
      const dragIds = picks.map((i) => order[i] ?? '')
      for (const overId of dragIds) {
        const drop = { ...baseDrop, activeId: dragIds[0] ?? '', dragIds, overId, after }
        expect(shown(applyDrop(taskState(order), drop))).toEqual(order)
      }
    }),
  )
})

test('property: one dragged task moves the same with or without dragIds', () => {
  fc.assert(
    fc.property(caseArb, ({ state, drop }) => {
      expect(applyDrop(state, { ...drop, dragIds: [drop.activeId] })).toEqual(applyDrop(state, drop))
    }),
  )
})

test('idsToMove skips tasks already in the target list', () => {
  const tasks = [makeTask('a', { listId: 'A' }), makeTask('b', { listId: 'B' }), makeTask('c', { listId: 'C' })]
  expect(idsToMove(tasks, ['a', 'b'], 'B')).toEqual(['a'])
  expect(idsToMove(tasks, ['a', 'c'], 'B')).toEqual(['a', 'c'])
  expect(idsToMove(tasks, ['b'], 'B')).toEqual([])
})

test('idsToMove skips tasks already in Today', () => {
  const tasks = [makeTask('a'), makeTask('b', { addedToToday: true }), makeTask('c')]
  expect(idsToMove(tasks, ['a', 'b', 'c'], TODAY_LIST_ID)).toEqual(['a', 'c'])
  expect(idsToMove(tasks, ['b'], TODAY_LIST_ID)).toEqual([])
})
