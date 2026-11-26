import { isCompleted, PRIORITIES, STAGES } from './labels'
import type { Task } from './types'

export type SortCriteria = 'stage' | 'due' | 'priority'

const sortKey = {
  stage: (task: Task) => STAGES.indexOf(task.stage),
  due: (task: Task) => task.due ?? '9999-99-99',
  priority: (task: Task) => PRIORITIES.indexOf(task.priority),
}

const compare = <T>(a: T, b: T) => Number(a > b) - Number(a < b)

export const sortTasks = (tasks: Task[], sort: SortCriteria | null) => {
  const newestFirst = tasks.toReversed()
  if (!sort) return newestFirst
  const key = sortKey[sort]
  return newestFirst.toSorted((a, b) => compare(isCompleted(a.stage), isCompleted(b.stage)) || compare(key(a), key(b)))
}
