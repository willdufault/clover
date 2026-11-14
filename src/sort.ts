import { PRIORITIES, STAGES } from './labels'
import type { Task } from './types'

export type SortCriteria = 'stage' | 'due' | 'priority'

const sortKey = {
  stage: (task: Task) => STAGES.indexOf(task.stage),
  due: (task: Task) => task.due ?? '9999-99-99',
  priority: (task: Task) => PRIORITIES.indexOf(task.priority),
}

export const sortTasks = (tasks: Task[], criteria: SortCriteria) => {
  const key = sortKey[criteria]
  return [...tasks].sort((a, b) => {
    if (key(a) === key(b)) return 0
    return key(a) < key(b) ? -1 : 1
  })
}

// Puts the sorted visible tasks back into the slots the visible tasks occupied.
export const applySort = (all: Task[], visible: Task[], criteria: SortCriteria) => {
  const sorted = sortTasks(visible, criteria)
  const slots = new Set(visible)
  let next = 0
  return all.map((task) => (slots.has(task) ? sorted[next++] : task))
}
