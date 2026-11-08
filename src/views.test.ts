import type { Task } from './types'
import { TODAY_VIEW_ID, visibleTasks } from './views'

const makeTask = (id: string, listId: string): Task => ({ id, text: id, listId, subtasks: [] })
const ids = (items: { id: string }[]) => items.map((item) => item.id)

test('Today view shows flagged, due today and overdue tasks only', () => {
  const tasks: Task[] = [
    { ...makeTask('flag', 'A'), addedToToday: true },
    { ...makeTask('due', 'A'), due: '2026-01-02' },
    { ...makeTask('late', 'B'), due: '2026-01-01' },
    { ...makeTask('future', 'B'), due: '2026-01-03' },
    makeTask('plain', 'B'),
  ]
  expect(ids(visibleTasks(tasks, TODAY_VIEW_ID, '2026-01-02'))).toEqual(['flag', 'due', 'late'])
})
