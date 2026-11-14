import type { Task } from './types'

export const ALL_LIST_ID = 'all'

export const TODAY_LIST_ID = 'today'

export const tasksInList = (tasks: Task[], selectedListId: string) => {
  if (selectedListId === ALL_LIST_ID) return tasks
  if (selectedListId === TODAY_LIST_ID) return tasks.filter((task) => task.addedToToday)
  return tasks.filter((task) => task.listId === selectedListId)
}

export const ALL_LIST_NAME = '📋 All'

export const TODAY_LIST_NAME = '☀️ Today'

export const SMART_LIST_NAMES: Partial<Record<string, string>> = {
  [ALL_LIST_ID]: ALL_LIST_NAME,
  [TODAY_LIST_ID]: TODAY_LIST_NAME,
}
