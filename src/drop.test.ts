import { applyDrop, type BoardState } from './drop'
import type { Subtask, Task } from './types'
import { TODAY_VIEW_ID } from './views'

const makeSubtask = (id: string, done = false): Subtask => ({ id, text: id, done })
const makeTask = (id: string, listId: string, subtasks: Subtask[] = []): Task => ({ id, text: id, listId, subtasks })
const makeState = (): BoardState => ({
  lists: [
    { id: 'A', name: 'A' },
    { id: 'B', name: 'B' },
    { id: 'C', name: 'C' },
  ],
  tasks: [
    makeTask('a1', 'A', [makeSubtask('s1'), makeSubtask('s2'), makeSubtask('s3')]),
    makeTask('a2', 'A', [makeSubtask('x1'), makeSubtask('x2')]),
    makeTask('a3', 'A'),
    makeTask('b1', 'B', [makeSubtask('y1')]),
    makeTask('b2', 'B'),
    makeTask('c1', 'C', [makeSubtask('z1')]),
  ],
})
const baseDrop = { viewId: 'A', selectedTaskId: null as string | null }
const ids = (items: { id: string }[]) => items.map((item) => item.id)

test('reorder lists: only list order changes', () => {
  const result = applyDrop(makeState(), { ...baseDrop, dragKind: 'list', activeId: 'A', overId: 'C' })
  expect(ids(result.lists)).toEqual(['B', 'C', 'A'])
  expect(result.tasks).toEqual(makeState().tasks)
})

test('reorder tasks in a list: other tasks untouched', () => {
  const result = applyDrop(makeState(), { ...baseDrop, dragKind: 'task', activeId: 'a1', overId: 'a3' })
  expect(ids(result.tasks)).toEqual(['a2', 'a3', 'a1', 'b1', 'b2', 'c1'])
  expect(result.tasks.find((task) => task.id === 'a1')).toEqual(makeState().tasks[0])
  expect(result.lists).toEqual(makeState().lists)
})

test('reorder tasks in All', () => {
  const result = applyDrop(makeState(), { ...baseDrop, viewId: 'all', dragKind: 'task', activeId: 'c1', overId: 'a1' })
  expect(ids(result.tasks)).toEqual(['c1', 'a1', 'a2', 'a3', 'b1', 'b2'])
})

test('reorder subtasks: task order and other tasks untouched', () => {
  const result = applyDrop(makeState(), { ...baseDrop, selectedTaskId: 'a1', dragKind: 'subtask', activeId: 's1', overId: 's3' })
  const expected = makeState()
  expect(ids(result.tasks)).toEqual(ids(expected.tasks))
  expect(ids(result.tasks[0].subtasks)).toEqual(['s2', 's3', 's1'])
  expect(result.tasks.slice(1)).toEqual(expected.tasks.slice(1))
})

test('task dropped on a list sets its listId and moves to front', () => {
  const result = applyDrop(makeState(), { ...baseDrop, dragKind: 'task', activeId: 'a2', overId: 'B' })
  expect(ids(result.tasks)).toEqual(['a2', 'a1', 'a3', 'b1', 'b2', 'c1'])
  expect(result.tasks[0]).toEqual({ ...makeState().tasks[1], listId: 'B' })
  expect(result.tasks[0].subtasks).toEqual([makeSubtask('x1'), makeSubtask('x2')])
})

test('task dropped on a list from All sets its listId', () => {
  const result = applyDrop(makeState(), { ...baseDrop, viewId: 'all', dragKind: 'task', activeId: 'c1', overId: 'A' })
  expect(result.tasks[0]).toEqual({ ...makeState().tasks[5], listId: 'A' })
})

test('task dropped on its own list or on All is a no-op', () => {
  const state = makeState()
  expect(applyDrop(state, { ...baseDrop, dragKind: 'task', activeId: 'a1', overId: 'A' })).toBe(state)
  expect(applyDrop(state, { ...baseDrop, dragKind: 'task', activeId: 'a1', overId: 'all' })).toBe(state)
})

test('mismatched ids are no-ops', () => {
  const state = makeState()
  const expectNoop = (drop: Partial<Parameters<typeof applyDrop>[1]>) =>
    expect(applyDrop(state, { ...baseDrop, selectedTaskId: 'a1', dragKind: 'task', activeId: 'a1', overId: 'a2', ...drop })).toEqual(makeState())
  expectNoop({ dragKind: 'subtask', activeId: 's1', overId: 'a2' }) // subtask over task
  expectNoop({ dragKind: 'task', activeId: 'a1', overId: 's1' }) // task over subtask
  expectNoop({ dragKind: 'subtask', activeId: 's1', overId: 'x1' }) // subtask of another task
  expectNoop({ dragKind: 'list', activeId: 'A', overId: 'a1' }) // list over task
  expectNoop({ dragKind: 'task', activeId: 'b1', overId: 'a1' }) // task from unselected list
})

test('moving a task to another list keeps due, priority and stage', () => {
  const state = makeState()
  const task = { ...state.tasks[2], due: '2000-01-01', priority: 'high' as const, stage: 'waiting' as const }
  state.tasks[2] = task
  const result = applyDrop(state, { ...baseDrop, dragKind: 'task', activeId: 'a3', overId: 'C' })
  expect(result.tasks[0]).toEqual({ ...task, listId: 'C' })
})

test('dropping a task on Today flags it and keeps its list and position', () => {
  const result = applyDrop(makeState(), { ...baseDrop, dragKind: 'task', activeId: 'a2', overId: TODAY_VIEW_ID })
  expect(ids(result.tasks)).toEqual(ids(makeState().tasks))
  expect(result.tasks[1]).toEqual({ ...makeState().tasks[1], addedToToday: true })
})

