import type { Task } from '../../src/types'

export const makeTask = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  title: id,
  due: null,
  listId: null,
  addedToToday: false,
  steps: [],
  stage: 'open',
  priority: 'medium',
  ...patch,
})
