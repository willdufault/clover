import { applyDrop, type State } from './drop'
import type { Subtask, Task } from './types'
import { TODAY_VIEW_ID } from './views'

const s = (id: string, done = false): Subtask => ({ id, text: id, done })
const t = (id: string, listId: string, subtasks: Subtask[] = []): Task => ({ id, text: id, listId, subtasks })
const make = (): State => ({
  lists: [
    { id: 'A', name: 'A' },
    { id: 'B', name: 'B' },
    { id: 'C', name: 'C' },
  ],
  tasks: [
    t('a1', 'A', [s('s1'), s('s2'), s('s3')]),
    t('a2', 'A', [s('x1'), s('x2')]),
    t('a3', 'A'),
    t('b1', 'B', [s('y1')]),
    t('b2', 'B'),
    t('c1', 'C', [s('z1')]),
  ],
})
const base = { viewId: 'A', selectedTaskId: null as string | null }
const ids = (items: { id: string }[]) => items.map((i) => i.id)

test('reorder lists: only list order changes', () => {
  const out = applyDrop(make(), { ...base, dragKind: 'list', activeId: 'A', overId: 'C' })
  expect(ids(out.lists)).toEqual(['B', 'C', 'A'])
  expect(out.tasks).toEqual(make().tasks)
})

test('reorder tasks in a list: other tasks untouched', () => {
  const out = applyDrop(make(), { ...base, dragKind: 'task', activeId: 'a1', overId: 'a3' })
  expect(ids(out.tasks)).toEqual(['a2', 'a3', 'a1', 'b1', 'b2', 'c1'])
  expect(out.tasks.find((x) => x.id === 'a1')).toEqual(make().tasks[0])
  expect(out.lists).toEqual(make().lists)
})

test('reorder tasks in All', () => {
  const out = applyDrop(make(), { ...base, viewId: 'all', dragKind: 'task', activeId: 'c1', overId: 'a1' })
  expect(ids(out.tasks)).toEqual(['c1', 'a1', 'a2', 'a3', 'b1', 'b2'])
})

test('reorder subtasks: task order and other tasks untouched', () => {
  const out = applyDrop(make(), { ...base, selectedTaskId: 'a1', dragKind: 'subtask', activeId: 's1', overId: 's3' })
  const expected = make()
  expect(ids(out.tasks)).toEqual(ids(expected.tasks))
  expect(ids(out.tasks[0].subtasks)).toEqual(['s2', 's3', 's1'])
  expect(out.tasks.slice(1)).toEqual(expected.tasks.slice(1))
})

test('task dropped on a list sets its listId and moves to front', () => {
  const out = applyDrop(make(), { ...base, dragKind: 'task', activeId: 'a2', overId: 'B' })
  expect(ids(out.tasks)).toEqual(['a2', 'a1', 'a3', 'b1', 'b2', 'c1'])
  expect(out.tasks[0]).toEqual({ ...make().tasks[1], listId: 'B' })
  expect(out.tasks[0].subtasks).toEqual([s('x1'), s('x2')])
})

test('task dropped on a list from All sets its listId', () => {
  const out = applyDrop(make(), { ...base, viewId: 'all', dragKind: 'task', activeId: 'c1', overId: 'A' })
  expect(out.tasks[0]).toEqual({ ...make().tasks[5], listId: 'A' })
})

test('task dropped on its own list or on All is a no-op', () => {
  const state = make()
  expect(applyDrop(state, { ...base, dragKind: 'task', activeId: 'a1', overId: 'A' })).toBe(state)
  expect(applyDrop(state, { ...base, dragKind: 'task', activeId: 'a1', overId: 'all' })).toBe(state)
})

test('mismatched ids are no-ops', () => {
  const state = make()
  const noop = (d: Partial<Parameters<typeof applyDrop>[1]>) =>
    expect(applyDrop(state, { ...base, selectedTaskId: 'a1', dragKind: 'task', activeId: 'a1', overId: 'a2', ...d })).toEqual(make())
  noop({ dragKind: 'subtask', activeId: 's1', overId: 'a2' }) // subtask over task
  noop({ dragKind: 'task', activeId: 'a1', overId: 's1' }) // task over subtask
  noop({ dragKind: 'subtask', activeId: 's1', overId: 'x1' }) // subtask of another task
  noop({ dragKind: 'list', activeId: 'A', overId: 'a1' }) // list over task
  noop({ dragKind: 'task', activeId: 'b1', overId: 'a1' }) // task from unselected list
})

test('moving a task to another list keeps due, priority and stage', () => {
  const state = make()
  const task = { ...state.tasks[2], due: '2000-01-01', priority: 'high' as const, stage: 'waiting' as const }
  state.tasks[2] = task
  const out = applyDrop(state, { ...base, dragKind: 'task', activeId: 'a3', overId: 'C' })
  expect(out.tasks[0]).toEqual({ ...task, listId: 'C' })
})

test('dropping a task on Today flags it and keeps its list and position', () => {
  const out = applyDrop(make(), { ...base, dragKind: 'task', activeId: 'a2', overId: TODAY_VIEW_ID })
  expect(ids(out.tasks)).toEqual(ids(make().tasks))
  expect(out.tasks[1]).toEqual({ ...make().tasks[1], today: true })
})

