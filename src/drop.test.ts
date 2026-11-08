import { applyDrop, type Subtask, type Task, type TaskList } from './drop'

const s = (id: string, done = false): Subtask => ({ id, text: id, done })
const t = (id: string, subtasks: Subtask[] = []): Task => ({ id, text: id, subtasks })
const make = (): TaskList[] => [
  { id: 'A', name: 'A', tasks: [t('a1', [s('s1'), s('s2'), s('s3')]), t('a2', [s('x1'), s('x2')]), t('a3')] },
  { id: 'B', name: 'B', tasks: [t('b1', [s('y1')]), t('b2')] },
  { id: 'C', name: 'C', tasks: [t('c1', [s('z1')])] },
]
const base = { selectedId: 'A', selectedItemId: null as string | null }
const ids = (items: { id: string }[]) => items.map((i) => i.id)

test('reorder lists: only list order changes', () => {
  const lists = make()
  const out = applyDrop(lists, { ...base, dragKind: 'list', activeId: 'A', overId: 'C' })
  expect(ids(out)).toEqual(['B', 'C', 'A'])
  expect(out.find((l) => l.id === 'A')).toEqual(make()[0])
  expect(out.find((l) => l.id === 'B')).toEqual(make()[1])
  expect(out.find((l) => l.id === 'C')).toEqual(make()[2])
})

test('reorder tasks: subtasks and other lists untouched', () => {
  const out = applyDrop(make(), { ...base, dragKind: 'task', activeId: 'a1', overId: 'a3' })
  expect(ids(out)).toEqual(['A', 'B', 'C'])
  expect(ids(out[0].tasks)).toEqual(['a2', 'a3', 'a1'])
  const expected = make()
  expect(out[0].tasks.find((x) => x.id === 'a1')).toEqual(expected[0].tasks[0])
  expect(out[0].tasks.find((x) => x.id === 'a2')).toEqual(expected[0].tasks[1])
  expect(out[1]).toEqual(expected[1])
  expect(out[2]).toEqual(expected[2])
})

test('reorder subtasks: task order and other tasks subtasks untouched', () => {
  const out = applyDrop(make(), { ...base, selectedItemId: 'a1', dragKind: 'subtask', activeId: 's1', overId: 's3' })
  const expected = make()
  expect(ids(out[0].tasks)).toEqual(['a1', 'a2', 'a3'])
  expect(ids(out[0].tasks[0].subtasks)).toEqual(['s2', 's3', 's1'])
  expect(out[0].tasks[1]).toEqual(expected[0].tasks[1])
  expect(out[0].tasks[2]).toEqual(expected[0].tasks[2])
  expect(out[1]).toEqual(expected[1])
  expect(out[2]).toEqual(expected[2])
})

test('task to another list: moves to front with subtasks, third list untouched', () => {
  const out = applyDrop(make(), { ...base, dragKind: 'task', activeId: 'a2', overId: 'B' })
  const expected = make()
  expect(ids(out)).toEqual(['A', 'B', 'C'])
  expect(out[0].tasks).toEqual([expected[0].tasks[0], expected[0].tasks[2]])
  expect(out[1].tasks).toEqual([expected[0].tasks[1], ...expected[1].tasks])
  expect(out[1].tasks[0].subtasks).toEqual([s('x1'), s('x2')])
  expect(out[2]).toEqual(expected[2])
})

test('task dropped on its own list is a no-op', () => {
  const lists = make()
  expect(applyDrop(lists, { ...base, dragKind: 'task', activeId: 'a1', overId: 'A' })).toBe(lists)
})

test('mismatched ids are no-ops', () => {
  const lists = make()
  const noop = (d: Partial<Parameters<typeof applyDrop>[1]>) =>
    expect(applyDrop(lists, { ...base, selectedItemId: 'a1', dragKind: 'task', activeId: 'a1', overId: 'a2', ...d })).toEqual(make())
  noop({ dragKind: 'subtask', activeId: 's1', overId: 'a2' }) // subtask over task
  noop({ dragKind: 'task', activeId: 'a1', overId: 's1' }) // task over subtask
  noop({ dragKind: 'subtask', activeId: 's1', overId: 'x1' }) // subtask of another task
  noop({ dragKind: 'list', activeId: 'A', overId: 'a1' }) // list over task
  noop({ dragKind: 'task', activeId: 'b1', overId: 'a1' }) // task from unselected list
})

test('moving a task to another list keeps due, priority and stage', () => {
  const lists = make()
  const task = { ...lists[0].tasks[2], due: '2000-01-01', priority: 'high' as const, stage: 'waiting' as const }
  lists[0].tasks[2] = task
  const out = applyDrop(lists, { ...base, dragKind: 'task', activeId: 'a3', overId: 'C' })
  expect(out[2].tasks[0]).toEqual(task)
})
