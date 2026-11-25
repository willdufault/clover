import { isCompleted, PRIORITIES, STAGES } from './labels'
import type { Task } from './types'

export type SortCriteria = 'stage' | 'due' | 'priority'

export type Sort = { criteria: SortCriteria; descending: boolean }

const sortKey = {
  stage: (task: Task) => STAGES.indexOf(task.stage),
  due: (task: Task) => task.due ?? '9999-99-99',
  priority: (task: Task) => PRIORITIES.indexOf(task.priority),
}

const compare = <T>(a: T, b: T) => Number(a > b) - Number(a < b)

export const sortTasks = (tasks: Task[], sort: Sort | null) => {
  if (!sort) return tasks.toReversed()
  const key = sortKey[sort.criteria]
  const direction = sort.descending ? -1 : 1
  return tasks.toSorted(
    (a, b) => compare(isCompleted(a.stage), isCompleted(b.stage)) || compare(key(a), key(b)) * direction,
  )
}

export const applySort = (all: Task[], visible: Task[], sort: Sort | null) => {
  if (!sort) return all
  const sorted = sortTasks(visible, sort).toReversed()
  const visibleSet = new Set(visible)
  let sortedIndex = 0
  return all.map((task) => (visibleSet.has(task) ? (sorted[sortedIndex++] ?? task) : task))
}
