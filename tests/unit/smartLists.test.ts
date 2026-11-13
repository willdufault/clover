import type { Task } from '../../src/types'
import { TODAY_LIST_ID, tasksInList } from '../../src/smartLists'

const makeTask = (id: string, listId: string): Task => ({ id, text: id, listId, steps: [], stage: 'open', priority: 'medium' })
const ids = (items: { id: string }[]) => items.map((item) => item.id)

test('Today view shows flagged, due today and overdue tasks only', () => {
  const tasks: Task[] = [
    { ...makeTask('flag', 'A'), addedToToday: true },
    { ...makeTask('due', 'A'), due: '2026-01-02' },
    { ...makeTask('late', 'B'), due: '2026-01-01' },
    { ...makeTask('future', 'B'), due: '2026-01-03' },
    makeTask('plain', 'B'),
  ]
  expect(ids(tasksInList(tasks, TODAY_LIST_ID, '2026-01-02'))).toEqual(['flag', 'due', 'late'])
})
