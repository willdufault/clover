import { applyDrop, type ListsAndTasks } from '../../src/drop'
import type { Step, Task } from '../../src/types'

const makeStep = (id: string, completed = false): Step => ({ id, taskId: '', title: id, completed })
const makeTask = (id: string, listId: string, steps: Step[] = []): Task => ({ id, title: id, listId, steps, stage: 'open', priority: 'medium', due: null, addedToToday: false })
const makeState = (): ListsAndTasks => ({
  lists: [
    { id: 'A', name: 'A' },
    { id: 'B', name: 'B' },
    { id: 'C', name: 'C' },
  ],
  tasks: [
    makeTask('a1', 'A', [makeStep('s1'), makeStep('s2'), makeStep('s3')]),
    makeTask('a2', 'A', [makeStep('x1'), makeStep('x2')]),
    makeTask('a3', 'A'),
    makeTask('b1', 'B', [makeStep('y1')]),
    makeTask('b2', 'B'),
    makeTask('c1', 'C', [makeStep('z1')]),
  ],
})
const baseDrop = { selectedListId: 'A', detailTaskId: null as string | null }
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

test('reorder tasks in All', () => {
  const result = applyDrop(makeState(), { ...baseDrop, selectedListId: 'all', activeId: 'c1', overId: 'a1' })
  expect(ids(result.tasks)).toEqual(['c1', 'a1', 'a2', 'a3', 'b1', 'b2'])
})

test('reorder steps: task order and other tasks untouched', () => {
  const result = applyDrop(makeState(), { ...baseDrop, detailTaskId: 'a1', activeId: 's1', overId: 's3' })
  const expected = makeState()
  expect(ids(result.tasks)).toEqual(ids(expected.tasks))
  expect(ids(result.tasks[0].steps)).toEqual(['s2', 's3', 's1'])
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
    expect(applyDrop(state, { ...baseDrop, detailTaskId: 'a1', activeId: 'a1', overId: 'a2', ...drop })).toEqual(makeState())
  expectNoop({ activeId: 's1', overId: 'a2' }) // step over task
  expectNoop({ activeId: 'a1', overId: 's1' }) // task over step
  expectNoop({ activeId: 's1', overId: 'x1' }) // step of another task
  expectNoop({ activeId: 'A', overId: 'a1' }) // list over task
  expectNoop({ activeId: 'b1', overId: 'a1' }) // task from unselected list
})
