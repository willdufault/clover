import { today } from './due'
import type { Task } from './types'

export const ALL = 'all'

export const TODAY = 'today'

export const visibleTasks = (tasks: Task[], viewId: string, now = today()) =>
  viewId === ALL
    ? tasks
    : viewId === TODAY
      ? tasks.filter((task) => task.today || (task.due && task.due <= now))
      : tasks.filter((task) => task.listId === viewId)
