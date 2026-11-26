import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faInfinity, faSun } from '@fortawesome/free-solid-svg-icons'
import type { Task } from './types'

export const ALL_LIST_ID = 'all'

export const TODAY_LIST_ID = 'today'

export const tasksInList = (tasks: Task[], listId: string) => {
  if (listId === ALL_LIST_ID) return tasks
  if (listId === TODAY_LIST_ID) return tasks.filter((task) => task.addedToToday)
  return tasks.filter((task) => task.listId === listId)
}

export const SMART_LIST_NAMES: Partial<Record<string, string>> = {
  [ALL_LIST_ID]: 'All',
  [TODAY_LIST_ID]: 'Today',
}

export const SMART_LIST_ICONS: Partial<Record<string, IconDefinition>> = {
  [ALL_LIST_ID]: faInfinity,
  [TODAY_LIST_ID]: faSun,
}
