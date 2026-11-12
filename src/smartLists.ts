import { today } from './dates'
import type { Task } from './types'

export const ALL_LIST_ID = 'all'

export const TODAY_LIST_ID = 'today'

export const tasksInList = (tasks: Task[], selectedListId: string, now = today()) => {
  if (selectedListId === ALL_LIST_ID) return tasks
  if (selectedListId === TODAY_LIST_ID) {
    return tasks.filter((task) => task.addedToToday || (task.due && task.due <= now))
  }
  return tasks.filter((task) => task.listId === selectedListId)
}

export const ALL_LIST_NAME = '📋 All'

export const TODAY_LIST_NAME = '☀️ Today'
