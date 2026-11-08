import type { Task } from './types'
import { TODAY, visibleTasks } from './views'

const t = (id: string, listId: string): Task => ({ id, text: id, listId, subtasks: [] })
const ids = (items: { id: string }[]) => items.map((i) => i.id)

test('Today view shows flagged, due today and overdue tasks only', () => {
  const tasks: Task[] = [
    { ...t('flag', 'A'), today: true },
    { ...t('due', 'A'), due: '2026-01-02' },
    { ...t('late', 'B'), due: '2026-01-01' },
    { ...t('future', 'B'), due: '2026-01-03' },
    t('plain', 'B'),
  ]
  expect(ids(visibleTasks(tasks, TODAY, '2026-01-02'))).toEqual(['flag', 'due', 'late'])
})
