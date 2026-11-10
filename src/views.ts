import { today } from './due'
import type { Task } from './types'

export const ALL_VIEW_ID = 'all'

export const TODAY_VIEW_ID = 'today'

export const visibleTasks = (tasks: Task[], viewId: string, now = today()) =>
  viewId === ALL_VIEW_ID
    ? tasks
    : viewId === TODAY_VIEW_ID
      ? tasks.filter((task) => task.addedToToday || (task.due && task.due <= now))
      : tasks.filter((task) => task.listId === viewId)

export const ALL_VIEW_NAME = '📋 All'

export const TODAY_VIEW_NAME = '☀️ Today'
